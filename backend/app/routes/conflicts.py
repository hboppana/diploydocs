from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import db
from ..schemas import ConflictOut, ConflictSide, ResolveConflictRequest

router = APIRouter(prefix="/conflicts", tags=["conflicts"])


def _side(session: Session, claim_id: str) -> ConflictSide:
    claim = session.get(db.Claim, claim_id)
    if claim is None:
        raise HTTPException(status_code=500, detail=f"Conflict references missing claim {claim_id}")
    file = session.get(db.File, claim.file_id)
    chunk = session.get(db.Chunk, claim.chunk_id)
    return ConflictSide(
        claimId=claim_id,
        fileId=claim.file_id,
        fileName=file.name if file else "Unknown file",
        text=claim.text,
        chunkSnippet=(chunk.text[:260] if chunk else ""),
    )


def _conflict_out(session: Session, row: db.Conflict) -> ConflictOut:
    return ConflictOut(
        id=row.id,
        detectedAt=row.detected_at,
        status=row.status,
        resolution=row.resolution,
        claimA=_side(session, row.claim_a_id),
        claimB=_side(session, row.claim_b_id),
    )


@router.get("", response_model=list[ConflictOut])
def list_conflicts(session: Session = Depends(db.get_session)) -> list[ConflictOut]:
    rows = session.query(db.Conflict).order_by(db.Conflict.detected_at.desc()).all()
    return [_conflict_out(session, row) for row in rows]


@router.post("/{conflict_id}/resolve", response_model=ConflictOut)
def resolve_conflict(
    conflict_id: str,
    payload: ResolveConflictRequest,
    session: Session = Depends(db.get_session),
) -> ConflictOut:
    row = session.get(db.Conflict, conflict_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Conflict not found")
    row.status = "resolved"
    row.resolution = payload.resolution
    session.commit()
    session.refresh(row)
    return _conflict_out(session, row)
