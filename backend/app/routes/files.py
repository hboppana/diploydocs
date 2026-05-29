from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import db
from ..extract import (
    MAX_UPLOAD_BYTES,
    EmptyDocument,
    UnsupportedFileType,
    extract_body_sections,
    file_type_for,
)
from ..graphs.ingest import ingest_file
from ..schemas import ChunkOut, ClaimOut, ComposeRequest, FileDoc, StatsOut
from ..vectors import delete_for_file

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


def _run_ingest(file_id: str, file_name: str, body_sections: list[dict]) -> None:
    """Background worker. On any failure, mark the file 'failed' so the UI stops spinning."""
    try:
        ingest_file(file_id=file_id, file_name=file_name, body_sections=body_sections)
    except Exception:
        with db.SessionLocal() as session:
            row = session.get(db.File, file_id)
            if row:
                row.status = "failed"
                session.commit()
        raise


@router.post("", response_model=FileDoc, status_code=201)
async def upload_file(
    background: BackgroundTasks,
    upload: UploadFile = File(...),
    session: Session = Depends(db.get_session),
) -> FileDoc:
    filename = upload.filename or "untitled"
    try:
        file_type = file_type_for(filename)
    except UnsupportedFileType as e:
        raise HTTPException(status_code=415, detail=str(e))

    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(data)} bytes). Limit is {MAX_UPLOAD_BYTES} bytes.",
        )

    try:
        body_sections = extract_body_sections(filename=filename, data=data)
    except EmptyDocument as e:
        raise HTTPException(status_code=422, detail=str(e))
    except UnsupportedFileType as e:
        raise HTTPException(status_code=415, detail=str(e))

    file_id = f"f_{uuid.uuid4().hex[:12]}"
    row = db.File(
        id=file_id,
        name=filename,
        type=file_type,
        size_bytes=len(data),
        status="pending",
        body=body_sections,
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    # Run the ingest graph after the response is sent; status flows pending -> indexed.
    background.add_task(_run_ingest, file_id, filename, body_sections)
    return _file_out(row)


@router.post("/compose", response_model=FileDoc, status_code=201)
def compose_file(
    payload: ComposeRequest,
    background: BackgroundTasks,
    session: Session = Depends(db.get_session),
) -> FileDoc:
    title = payload.title.strip()
    content = payload.content.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required.")
    if not content:
        raise HTTPException(status_code=422, detail="Content is required.")

    # Treat the authored content as Markdown so `#` headings become document sections.
    name = title if title.lower().endswith((".md", ".markdown")) else f"{title}.md"
    data = content.encode("utf-8")
    try:
        body_sections = extract_body_sections(filename=name, data=data)
    except EmptyDocument as e:
        raise HTTPException(status_code=422, detail=str(e))

    file_id = f"f_{uuid.uuid4().hex[:12]}"
    row = db.File(
        id=file_id,
        name=name,
        type="md",
        size_bytes=len(data),
        status="pending",
        body=body_sections,
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    background.add_task(_run_ingest, file_id, name, body_sections)
    return _file_out(row)


@router.put("/{file_id}", response_model=FileDoc)
def edit_file(
    file_id: str,
    payload: ComposeRequest,
    background: BackgroundTasks,
    session: Session = Depends(db.get_session),
) -> FileDoc:
    row = session.get(db.File, file_id)
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")

    title = payload.title.strip()
    content = payload.content.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title is required.")
    if not content:
        raise HTTPException(status_code=422, detail="Content is required.")

    # We only ever stored the extracted body, so every file type is edited as Markdown text.
    # Keep the name<->type alignment: reuse the existing extension if the title omits one.
    name = title if "." in title.rsplit("/", 1)[-1] else f"{title}.{row.type}"
    data = content.encode("utf-8")
    try:
        # The editor is Markdown, so parse edits as Markdown (headings -> sections) for every file type.
        body_sections = extract_body_sections(filename="_.md", data=data)
    except EmptyDocument as e:
        raise HTTPException(status_code=422, detail=str(e))

    row.name = name
    row.size_bytes = len(data)
    row.body = body_sections
    row.status = "pending"
    session.commit()
    session.refresh(row)

    # Idempotent ingest rebuilds chunks/claims/conflicts from the edited body.
    background.add_task(_run_ingest, file_id, name, body_sections)
    return _file_out(row)


@router.post("/{file_id}/reindex", response_model=FileDoc)
def reindex_file(
    file_id: str,
    background: BackgroundTasks,
    session: Session = Depends(db.get_session),
) -> FileDoc:
    row = session.get(db.File, file_id)
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")
    if not row.body:
        raise HTTPException(status_code=422, detail="File has no stored body to re-index.")

    body_sections = [dict(section) for section in row.body]
    row.status = "pending"
    session.commit()
    session.refresh(row)

    # The ingest graph is idempotent — its embed node clears stale chunks/claims/conflicts first.
    background.add_task(_run_ingest, file_id, row.name, body_sections)
    return _file_out(row)


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: str, session: Session = Depends(db.get_session)) -> None:
    row = session.get(db.File, file_id)
    if row is None:
        raise HTTPException(status_code=404, detail="File not found")

    # Conflicts reference claims but aren't covered by the ORM relationship cascade,
    # so clear any that touch this file's claims before deleting the file.
    claim_ids = [c.id for c in session.query(db.Claim.id).filter(db.Claim.file_id == file_id).all()]
    if claim_ids:
        session.query(db.Conflict).filter(db.Conflict.claim_a_id.in_(claim_ids)).delete(synchronize_session=False)
        session.query(db.Conflict).filter(db.Conflict.claim_b_id.in_(claim_ids)).delete(synchronize_session=False)

    session.delete(row)  # cascades to chunks + claims via the relationship config
    session.commit()

    # Drop the file's vectors from Chroma too.
    delete_for_file(file_id)


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
