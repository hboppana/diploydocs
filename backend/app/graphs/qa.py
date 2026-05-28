"""Self-correcting RAG with per-claim verification, expressed as a LangGraph.

Flow:

    START
      └─> retrieve
            └─> grade_relevance
                  ├─[score < threshold and retries < cap]─> rewrite_query ─> retrieve
                  └─[else]──────────────────────────────────> generate
                                                                └─> decompose_claims
                                                                      └─> verify_claims
                                                                            └─> END

State is a TypedDict so it serializes cleanly into the SSE event stream and the
ChatRun row.
"""

from __future__ import annotations

import time
from typing import Annotated, Literal, TypedDict
from uuid import uuid4

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field

from ..config import settings
from ..llm import get_llm
from ..vectors import RetrievedChunk, search_chunks


# ---------- structured-output models ----------

class RelevanceGrade(BaseModel):
    score: float = Field(description="0.0 (none of the chunks help) to 1.0 (chunks fully answer the question)")
    reason: str = Field(description="One short sentence explaining the score")


class RewrittenQuery(BaseModel):
    query: str = Field(description="A rewritten search query that should retrieve better chunks")
    added_terms: list[str] = Field(default_factory=list, description="Terms or sub-topics added")


class ClaimList(BaseModel):
    claims: list[str] = Field(description="Atomic factual claims, one per item, each fully self-contained")


class Verdict(BaseModel):
    support: Literal["supported", "weak", "unsupported"]
    reason: str


# ---------- LangGraph state ----------

def _append(left: list, right: list) -> list:
    return left + right


class QAState(TypedDict, total=False):
    question: str
    query: str  # current effective query (rewritten or original)
    retrieved: list[RetrievedChunk]
    relevance_score: float
    retries: int
    answer: str
    verified: list[dict]
    citations: list[dict]
    trace: Annotated[list[dict], _append]


# ---------- node helpers ----------

def _trace(node: str, started: float, meta: str | None = None) -> dict:
    return {"node": node, "ms": int((time.perf_counter() - started) * 1000), "meta": meta}


# ---------- nodes ----------

def node_retrieve(state: QAState) -> QAState:
    t0 = time.perf_counter()
    query = state.get("query") or state["question"]
    hits = search_chunks(query, k=settings.retrieval_k)
    return {
        "retrieved": hits,
        "trace": [_trace("retrieve", t0, f"{len(hits)} hits")],
    }


def node_grade_relevance(state: QAState) -> QAState:
    t0 = time.perf_counter()
    hits = state.get("retrieved", [])
    if not hits:
        return {
            "relevance_score": 0.0,
            "trace": [_trace("grade_relevance", t0, "score 0.00 — no hits")],
        }

    snippets = "\n\n".join(f"[{i + 1}] {h.text[:400]}" for i, h in enumerate(hits[:5]))
    grader = get_llm().with_structured_output(RelevanceGrade)
    grade: RelevanceGrade = grader.invoke([
        SystemMessage(content=(
            "You are a relevance grader. Decide how well the retrieved chunks answer the question. "
            "Return a score from 0.0 (irrelevant) to 1.0 (fully sufficient)."
        )),
        HumanMessage(content=f"Question: {state['question']}\n\nChunks:\n{snippets}"),
    ])
    return {
        "relevance_score": grade.score,
        "trace": [_trace("grade_relevance", t0, f"score {grade.score:.2f} — {grade.reason[:60]}")],
    }


def node_rewrite_query(state: QAState) -> QAState:
    t0 = time.perf_counter()
    rewriter = get_llm().with_structured_output(RewrittenQuery)
    rewritten: RewrittenQuery = rewriter.invoke([
        SystemMessage(content=(
            "The initial retrieval was weak. Rewrite the user's question into a search query "
            "that surfaces relevant internal documentation. Expand with synonyms and sub-topics."
        )),
        HumanMessage(content=f"Original question: {state['question']}"),
    ])
    return {
        "query": rewritten.query,
        "retries": state.get("retries", 0) + 1,
        "trace": [_trace("rewrite_query", t0, f"expanded with: {', '.join(rewritten.added_terms[:4]) or '—'}")],
    }


def node_generate(state: QAState) -> QAState:
    t0 = time.perf_counter()
    hits = state.get("retrieved", [])
    # Build a numbered context block and a citations map
    citations: list[dict] = []
    seen: dict[str, int] = {}
    context_blocks = []
    for h in hits:
        if h.chunk_id not in seen:
            seen[h.chunk_id] = len(seen) + 1
            citations.append({
                "n": seen[h.chunk_id],
                "fileId": h.file_id,
                "fileName": h.file_name,
                "chunkId": h.chunk_id,
                "snippet": h.text[:240],
            })
        context_blocks.append(f"[{seen[h.chunk_id]}] ({h.file_name}) {h.text}")
    context = "\n\n".join(context_blocks)

    resp = get_llm().invoke([
        SystemMessage(content=(
            "You answer questions about an internal engineering knowledge base. "
            "Use ONLY the retrieved context. Cite chunks with [n] markers inline. "
            "If the context is insufficient, say so plainly. Keep the answer tight (4-6 sentences)."
        )),
        HumanMessage(content=f"Question: {state['question']}\n\nContext:\n{context}"),
    ])
    answer = resp.content if isinstance(resp.content, str) else str(resp.content)
    approx_tokens = max(1, len(answer) // 4)
    return {
        "answer": answer,
        "citations": citations,
        "trace": [_trace("generate", t0, f"{approx_tokens} tokens")],
    }


def node_decompose_claims(state: QAState) -> QAState:
    t0 = time.perf_counter()
    decomposer = get_llm().with_structured_output(ClaimList)
    result: ClaimList = decomposer.invoke([
        SystemMessage(content=(
            "Split the answer into a list of atomic factual claims. Each claim must be a single, "
            "self-contained sentence understandable without surrounding context. Do not include "
            "fluff, hedging, or restating the question. Maximum 6 claims."
        )),
        HumanMessage(content=state["answer"]),
    ])
    return {
        # Stash claims temporarily under verified — verify step will replace them with full objects
        "verified": [{"text": c, "support": "weak"} for c in result.claims[:6]],
        "trace": [_trace("decompose_claims", t0, f"{len(result.claims[:6])} atomic claims")],
    }


def node_verify_claims(state: QAState) -> QAState:
    t0 = time.perf_counter()
    hits = state.get("retrieved", [])
    pending = state.get("verified", [])
    verified: list[dict] = []

    verifier = get_llm().with_structured_output(Verdict)
    for claim in pending:
        # For each claim, find the best-matching chunk by simple lexical overlap with retrieved set.
        # Then ask the LLM to grade entailment against that single chunk.
        best: RetrievedChunk | None = None
        best_overlap = 0
        claim_tokens = {w.lower() for w in claim["text"].split() if len(w) > 3}
        for h in hits:
            ov = len(claim_tokens & {w.lower() for w in h.text.split() if len(w) > 3})
            if ov > best_overlap:
                best_overlap, best = ov, h

        if best is None or best_overlap == 0:
            verified.append({"text": claim["text"], "support": "unsupported"})
            continue

        verdict: Verdict = verifier.invoke([
            SystemMessage(content=(
                "Judge whether the CLAIM is supported by the CHUNK. "
                "'supported' = chunk clearly states or directly entails the claim. "
                "'weak' = chunk loosely relates but doesn't fully back it. "
                "'unsupported' = chunk does not back the claim."
            )),
            HumanMessage(content=f"CLAIM: {claim['text']}\n\nCHUNK: {best.text}"),
        ])
        verified.append({
            "text": claim["text"],
            "support": verdict.support,
            "evidence": [{
                "fileId": best.file_id,
                "fileName": best.file_name,
                "chunkId": best.chunk_id,
                "snippet": best.text[:240],
            }],
        })

    sup = sum(1 for v in verified if v["support"] == "supported")
    weak = sum(1 for v in verified if v["support"] == "weak")
    unsup = sum(1 for v in verified if v["support"] == "unsupported")
    return {
        "verified": verified,
        "trace": [_trace("verify_claims", t0, f"{sup} supported, {weak} weak, {unsup} unsupported")],
    }


# ---------- graph wiring ----------

def _should_rewrite(state: QAState) -> str:
    if (
        state.get("relevance_score", 0.0) < settings.relevance_threshold
        and state.get("retries", 0) < settings.max_query_rewrites
    ):
        return "rewrite_query"
    return "generate"


def build_qa_graph():
    g = StateGraph(QAState)
    g.add_node("retrieve", node_retrieve)
    g.add_node("grade_relevance", node_grade_relevance)
    g.add_node("rewrite_query", node_rewrite_query)
    g.add_node("generate", node_generate)
    g.add_node("decompose_claims", node_decompose_claims)
    g.add_node("verify_claims", node_verify_claims)

    g.add_edge(START, "retrieve")
    g.add_edge("retrieve", "grade_relevance")
    g.add_conditional_edges("grade_relevance", _should_rewrite, {
        "rewrite_query": "rewrite_query",
        "generate": "generate",
    })
    g.add_edge("rewrite_query", "retrieve")
    g.add_edge("generate", "decompose_claims")
    g.add_edge("decompose_claims", "verify_claims")
    g.add_edge("verify_claims", END)
    return g.compile()


def run_qa(question: str) -> dict:
    """Synchronous one-shot for the seed script. Returns a ChatRun-ready dict."""
    graph = build_qa_graph()
    run_id = str(uuid4())
    final: QAState = graph.invoke(
        {"question": question, "trace": []},
        config={"run_id": run_id, "tags": ["qa-graph"]},
    )
    return {
        "id": run_id,
        "question": question,
        "answer": final.get("answer", ""),
        "verified": final.get("verified", []),
        "citations": final.get("citations", []),
        "trace": final.get("trace", []),
        "langsmith_url": _langsmith_url_for(run_id) if settings.langchain_tracing_v2 else None,
    }


def _langsmith_url_for(run_id: str) -> str | None:
    try:
        from langsmith import Client
        client = Client(api_key=settings.langchain_api_key or None)
        run = client.read_run(run_id)
        return getattr(run, "url", None)
    except Exception:
        return None
