"""Ingestion LangGraph — runs once per file at upload (or seed) time.

Flow:

    START → extract_text → chunk → enrich → embed → extract_claims → detect_conflicts → END

Each node updates `files.status` so the Library page reflects progress.
For the demo MVP we feed pre-extracted body sections in directly (no PDF parsing yet),
so `extract_text` is a passthrough that records timing.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import db
from ..llm import get_llm
from ..vectors import delete_for_file, search_similar_claims, upsert_chunk, upsert_claim


# ---------- structured-output models ----------

class FileEnrichment(BaseModel):
    summary: str = Field(description="One sentence — the document's core point in plain prose")
    topic: str = Field(description="A short topic label, 1-2 words, Title Case (e.g. 'Authentication')")


class ClaimList(BaseModel):
    claims: list[str] = Field(description="Atomic factual claims from this chunk, each self-contained")


class ContradictionJudgment(BaseModel):
    contradicts: bool
    reason: str


# ---------- state ----------

def _append(left: list, right: list) -> list:
    return left + right


class IngestState(TypedDict, total=False):
    file_id: str
    file_name: str
    body_sections: list[dict]   # [{heading?, paragraphs: [str]}]
    plain_text: str
    chunk_records: list[dict]   # [{chunk_id, file_id, idx, text, tokens}]
    summary: str
    topic: str
    claim_records: list[dict]   # [{claim_id, file_id, chunk_id, text}]
    conflicts: list[dict]       # [{claim_a_id, claim_b_id}]
    trace: Annotated[list[dict], _append]


# ---------- helpers ----------

def _trace(node: str, t0: float, meta: str | None = None) -> dict:
    return {"node": node, "ms": int((time.perf_counter() - t0) * 1000), "meta": meta}


def _set_status(file_id: str, status: str) -> None:
    with db.SessionLocal() as s:
        row = s.get(db.File, file_id)
        if row:
            row.status = status
            s.commit()


def _flatten_body(sections: list[dict]) -> str:
    parts: list[str] = []
    for sec in sections:
        if h := sec.get("heading"):
            parts.append(f"## {h}")
        parts.extend(sec.get("paragraphs", []))
    return "\n\n".join(parts)


def _chunk(text: str, target_tokens: int = 220, overlap_tokens: int = 30) -> list[str]:
    """Cheap whitespace-token chunker — adequate for ~1k token docs in the demo corpus."""
    words = text.split()
    if not words:
        return []
    chunks: list[str] = []
    step = max(1, target_tokens - overlap_tokens)
    for i in range(0, len(words), step):
        window = words[i : i + target_tokens]
        if window:
            chunks.append(" ".join(window))
        if i + target_tokens >= len(words):
            break
    return chunks


# ---------- nodes ----------

def node_extract_text(state: IngestState) -> IngestState:
    t0 = time.perf_counter()
    _set_status(state["file_id"], "extracting")
    text = _flatten_body(state.get("body_sections") or [])
    return {"plain_text": text, "trace": [_trace("extract_text", t0, f"{len(text)} chars")]}


def node_chunk(state: IngestState) -> IngestState:
    t0 = time.perf_counter()
    pieces = _chunk(state["plain_text"])
    records = [
        {
            "chunk_id": f"ch_{state['file_id']}_{i}",
            "file_id": state["file_id"],
            "idx": i,
            "text": p,
            "tokens": len(p.split()),
        }
        for i, p in enumerate(pieces)
    ]
    return {"chunk_records": records, "trace": [_trace("chunk", t0, f"{len(records)} chunks")]}


def node_enrich(state: IngestState) -> IngestState:
    t0 = time.perf_counter()
    _set_status(state["file_id"], "enriching")
    enricher = get_llm().with_structured_output(FileEnrichment)
    truncated = state["plain_text"][:6000]
    result: FileEnrichment = enricher.invoke([
        SystemMessage(content="Summarize the document in one tight sentence, and assign a 1-2 word topic label."),
        HumanMessage(content=f"Document: {state['file_name']}\n\n{truncated}"),
    ])
    return {
        "summary": result.summary,
        "topic": result.topic,
        "trace": [_trace("enrich", t0, f"topic: {result.topic}")],
    }


def node_embed(state: IngestState) -> IngestState:
    t0 = time.perf_counter()
    _set_status(state["file_id"], "embedding")

    # Clear stale rows/vectors for idempotent seed and reindex runs.
    delete_for_file(state["file_id"])

    with db.SessionLocal() as s:
        old_claim_ids = [row.id for row in s.query(db.Claim.id).filter(db.Claim.file_id == state["file_id"]).all()]
        if old_claim_ids:
            s.query(db.Conflict).filter(db.Conflict.claim_a_id.in_(old_claim_ids)).delete(synchronize_session=False)
            s.query(db.Conflict).filter(db.Conflict.claim_b_id.in_(old_claim_ids)).delete(synchronize_session=False)
        s.query(db.Claim).filter(db.Claim.file_id == state["file_id"]).delete(synchronize_session=False)
        s.query(db.Chunk).filter(db.Chunk.file_id == state["file_id"]).delete()
        for c in state["chunk_records"]:
            s.add(db.Chunk(id=c["chunk_id"], file_id=c["file_id"], idx=c["idx"], text=c["text"], token_count=c["tokens"]))
        f = s.get(db.File, state["file_id"])
        if f:
            f.summary = state.get("summary")
            f.topic = state.get("topic")
            f.chunk_count = len(state["chunk_records"])
        s.commit()

    # Push to Chroma
    for c in state["chunk_records"]:
        upsert_chunk(
            chunk_id=c["chunk_id"],
            file_id=state["file_id"],
            file_name=state["file_name"],
            idx=c["idx"],
            text=c["text"],
        )

    return {"trace": [_trace("embed", t0, f"{len(state['chunk_records'])} vectors")]}


def node_extract_claims(state: IngestState) -> IngestState:
    t0 = time.perf_counter()
    decomposer = get_llm().with_structured_output(ClaimList)
    claim_records: list[dict] = []

    for c in state["chunk_records"]:
        result: ClaimList = decomposer.invoke([
            SystemMessage(content=(
                "Extract atomic factual claims from the chunk. Each claim must be a complete, "
                "standalone sentence (no pronouns referring outside the claim). Max 4 per chunk. "
                "If the chunk has no factual claims (e.g. headings, table of contents), return an empty list."
            )),
            HumanMessage(content=c["text"]),
        ])
        for ct in result.claims[:4]:
            cid = f"cl_{uuid.uuid4().hex[:10]}"
            claim_records.append({
                "claim_id": cid,
                "file_id": state["file_id"],
                "chunk_id": c["chunk_id"],
                "text": ct,
            })

    # Persist claims
    with db.SessionLocal() as s:
        s.query(db.Claim).filter(db.Claim.file_id == state["file_id"]).delete()
        for c in claim_records:
            s.add(db.Claim(id=c["claim_id"], file_id=c["file_id"], chunk_id=c["chunk_id"], text=c["text"]))
        f = s.get(db.File, state["file_id"])
        if f:
            f.claim_count = len(claim_records)
        s.commit()

    for c in claim_records:
        upsert_claim(
            claim_id=c["claim_id"],
            file_id=c["file_id"],
            file_name=state["file_name"],
            chunk_id=c["chunk_id"],
            text=c["text"],
        )

    return {"claim_records": claim_records, "trace": [_trace("extract_claims", t0, f"{len(claim_records)} claims")]}


def node_detect_conflicts(state: IngestState) -> IngestState:
    t0 = time.perf_counter()
    judge = get_llm().with_structured_output(ContradictionJudgment)
    conflicts: list[dict] = []

    for new_claim in state.get("claim_records", []):
        similar = search_similar_claims(new_claim["text"], k=3, exclude_file_id=state["file_id"])
        for s_claim in similar:
            if s_claim["score"] < 0.45:  # only check meaningfully similar pairs
                continue
            verdict: ContradictionJudgment = judge.invoke([
                SystemMessage(content=(
                    "You are checking two factual claims from different internal documents. "
                    "Return contradicts=true ONLY if they cannot both be true at the same time about the same system. "
                    "Different topics or harmless variation = false."
                )),
                HumanMessage(content=f"Claim A: {new_claim['text']}\nClaim B: {s_claim['text']}"),
            ])
            if verdict.contradicts:
                conflicts.append({
                    "claim_a_id": new_claim["claim_id"],
                    "claim_b_id": s_claim["claim_id"],
                })

    with db.SessionLocal() as s:
        for c in conflicts:
            s.add(db.Conflict(
                id=f"cf_{uuid.uuid4().hex[:10]}",
                claim_a_id=c["claim_a_id"],
                claim_b_id=c["claim_b_id"],
                detected_at=datetime.now(timezone.utc),
                status="pending",
            ))
        f = s.get(db.File, state["file_id"])
        if f:
            f.status = "indexed"
        s.commit()

    return {"conflicts": conflicts, "trace": [_trace("detect_conflicts", t0, f"{len(conflicts)} new conflicts")]}


# ---------- graph wiring ----------

def build_ingest_graph():
    g = StateGraph(IngestState)
    g.add_node("extract_text", node_extract_text)
    g.add_node("chunk", node_chunk)
    g.add_node("enrich", node_enrich)
    g.add_node("embed", node_embed)
    g.add_node("extract_claims", node_extract_claims)
    g.add_node("detect_conflicts", node_detect_conflicts)

    g.add_edge(START, "extract_text")
    g.add_edge("extract_text", "chunk")
    g.add_edge("chunk", "enrich")
    g.add_edge("enrich", "embed")
    g.add_edge("embed", "extract_claims")
    g.add_edge("extract_claims", "detect_conflicts")
    g.add_edge("detect_conflicts", END)
    return g.compile()


def ingest_file(*, file_id: str, file_name: str, body_sections: list[dict]) -> dict:
    graph = build_ingest_graph()
    return graph.invoke(
        {
            "file_id": file_id,
            "file_name": file_name,
            "body_sections": body_sections,
            "trace": [],
        },
        config={"tags": ["ingest-graph", file_id]},
    )
