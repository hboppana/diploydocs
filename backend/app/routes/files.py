from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import db
from ..schemas import ChunkOut, ClaimOut, FileDoc, StatsOut

router = APIRouter(prefix="/files", tags=["files"])


def _file_out(row: db.File) -> FileDoc:
    return FileDoc(
        id=row.id,
        name=row.name,
        type=row.type,
        sizeBytes=row.size_bytes,
        uploadedAt=row.uploaded_at,
        status=row.status,
        summary=row.summary,
        topic=row.topic,
        chunkCount=row.chunk_count,
        claimCount=row.claim_count,
        body=row.body,
    )


@router.get("", response_model=list[FileDoc])
def list_files(session: Session = Depends(db.get_session)) -> list[FileDoc]:
    rows = session.query(db.File).order_by(db.File.uploaded_at.desc()).all()
    return [_file_out(row) for row in rows]


@router.get("/{file_id}", response_model=FileDoc)
def get_file(file_id: str, session: Session = Depends(db.get_session)) -> FileDoc:
    row = session.get(db.File, file_id)
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")
    return _file_out(row)


@router.get("/{file_id}/chunks", response_model=list[ChunkOut])
def get_chunks(file_id: str, session: Session = Depends(db.get_session)) -> list[ChunkOut]:
    if session.get(db.File, file_id) is None:
        raise HTTPException(status_code=404, detail="File not found")
    rows = session.query(db.Chunk).filter(db.Chunk.file_id == file_id).order_by(db.Chunk.idx).all()
    return [
        ChunkOut(id=row.id, fileId=row.file_id, index=row.idx, text=row.text, tokens=row.token_count)
        for row in rows
    ]


@router.get("/{file_id}/claims", response_model=list[ClaimOut])
def get_claims(file_id: str, session: Session = Depends(db.get_session)) -> list[ClaimOut]:
    if session.get(db.File, file_id) is None:
        raise HTTPException(status_code=404, detail="File not found")
    rows = session.query(db.Claim).filter(db.Claim.file_id == file_id).order_by(db.Claim.id).all()
    return [ClaimOut(id=row.id, fileId=row.file_id, chunkId=row.chunk_id, text=row.text) for row in rows]


def get_stats(session: Session) -> StatsOut:
    files = session.query(func.count(db.File.id)).scalar() or 0
    indexed = session.query(func.count(db.File.id)).filter(db.File.status == "indexed").scalar() or 0
    processing = (
        session.query(func.count(db.File.id))
        .filter(db.File.status.in_(["pending", "extracting", "enriching", "embedding"]))
        .scalar()
        or 0
    )
    chunks = session.query(func.count(db.Chunk.id)).scalar() or 0
    claims = session.query(func.count(db.Claim.id)).scalar() or 0
    pending = session.query(func.count(db.Conflict.id)).filter(db.Conflict.status == "pending").scalar() or 0
    return StatsOut(
        files=files,
        indexed=indexed,
        processing=processing,
        chunks=chunks,
        claims=claims,
        pendingConflicts=pending,
    )
