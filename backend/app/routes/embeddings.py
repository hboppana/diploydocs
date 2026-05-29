"""Project high-dimensional embeddings down to 2D (PCA) for the visualization page."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Query

from ..vectors import all_embeddings

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


@router.get("/projection")
def projection(kind: str = Query("chunks", pattern="^(chunks|claims)$")) -> dict:
    data = all_embeddings(kind)
    embs = data["embeddings"]
    n = len(embs)
    if n == 0:
        return {"kind": kind, "count": 0, "points": [], "varianceExplained": [0.0, 0.0]}

    X = np.asarray(embs, dtype=float)
    Xc = X - X.mean(axis=0)

    if n == 1:
        coords = np.zeros((1, 2))
        variance = [0.0, 0.0]
    else:
        # PCA via SVD: project centered vectors onto the top-2 principal components.
        _, S, Vt = np.linalg.svd(Xc, full_matrices=False)
        coords = Xc @ Vt[:2].T
        total = float((S ** 2).sum()) or 1.0
        variance = [float((S[i] ** 2) / total) if i < len(S) else 0.0 for i in range(2)]
        if coords.shape[1] < 2:  # degenerate (e.g. 1 effective dimension)
            coords = np.column_stack([coords, np.zeros(n)])

    points = []
    for i, cid in enumerate(data["ids"]):
        meta = data["metadatas"][i] or {}
        doc = data["documents"][i] or ""
        points.append({
            "id": cid,
            "x": float(coords[i, 0]),
            "y": float(coords[i, 1]),
            "fileId": meta.get("file_id"),
            "fileName": meta.get("file_name"),
            "snippet": doc[:160],
        })

    return {"kind": kind, "count": n, "points": points, "varianceExplained": variance}
