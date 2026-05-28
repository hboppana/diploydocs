"""Chroma wrapper. We use Chroma's default embedding function (ONNX MiniLM-L6-v2)
so we don't need torch / sentence-transformers as a separate heavy dependency.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from .config import settings

CHUNK_COLLECTION = "chunks"
CLAIM_COLLECTION = "claims"


@lru_cache(maxsize=1)
def _client() -> chromadb.api.ClientAPI:
    return chromadb.PersistentClient(
        path=str(settings.chroma_path),
        settings=ChromaSettings(anonymized_telemetry=False, allow_reset=True),
    )


def _collection(name: str):
    # Uses Chroma's default embedding function (all-MiniLM-L6-v2 via ONNX).
    return _client().get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def chunks_col():
    return _collection(CHUNK_COLLECTION)


def claims_col():
    return _collection(CLAIM_COLLECTION)


@dataclass
class RetrievedChunk:
    chunk_id: str
    file_id: str
    file_name: str
    text: str
    score: float  # 1 - cosine distance, so higher = better
    idx: int


def upsert_chunk(*, chunk_id: str, file_id: str, file_name: str, idx: int, text: str) -> None:
    chunks_col().upsert(
        ids=[chunk_id],
        documents=[text],
        metadatas=[{"file_id": file_id, "file_name": file_name, "idx": idx}],
    )


def upsert_claim(*, claim_id: str, file_id: str, file_name: str, chunk_id: str, text: str) -> None:
    claims_col().upsert(
        ids=[claim_id],
        documents=[text],
        metadatas=[{"file_id": file_id, "file_name": file_name, "chunk_id": chunk_id}],
    )


def search_chunks(query: str, k: int = 8) -> list[RetrievedChunk]:
    col = chunks_col()
    res: dict[str, Any] = col.query(query_texts=[query], n_results=k)
    hits: list[RetrievedChunk] = []
    ids = res.get("ids", [[]])[0]
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]
    for cid, doc, meta, dist in zip(ids, docs, metas, dists):
        hits.append(
            RetrievedChunk(
                chunk_id=cid,
                file_id=meta["file_id"],
                file_name=meta["file_name"],
                text=doc,
                score=max(0.0, 1.0 - float(dist)),
                idx=int(meta.get("idx", 0)),
            )
        )
    return hits


def search_similar_claims(query: str, k: int = 3, exclude_file_id: str | None = None) -> list[dict]:
    """For conflict detection: find claims similar to a given one (optionally excluding the same file)."""
    col = claims_col()
    # Pull a few extras so we can filter same-file out
    res = col.query(query_texts=[query], n_results=k + 5)
    out: list[dict] = []
    ids = res.get("ids", [[]])[0]
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    dists = res.get("distances", [[]])[0]
    for cid, doc, meta, dist in zip(ids, docs, metas, dists):
        if exclude_file_id and meta.get("file_id") == exclude_file_id:
            continue
        out.append(
            {
                "claim_id": cid,
                "file_id": meta["file_id"],
                "file_name": meta["file_name"],
                "chunk_id": meta.get("chunk_id"),
                "text": doc,
                "score": max(0.0, 1.0 - float(dist)),
            }
        )
        if len(out) >= k:
            break
    return out


def delete_for_file(file_id: str) -> None:
    chunks_col().delete(where={"file_id": file_id})
    claims_col().delete(where={"file_id": file_id})


def reset_all() -> None:
    """Drop both collections — used by `seed.py --reseed`."""
    try:
        _client().delete_collection(CHUNK_COLLECTION)
    except Exception:
        pass
    try:
        _client().delete_collection(CLAIM_COLLECTION)
    except Exception:
        pass
