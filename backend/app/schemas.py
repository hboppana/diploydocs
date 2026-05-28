from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

IndexStatus = Literal["pending", "extracting", "enriching", "embedding", "indexed", "failed"]
FileType = Literal["pdf", "md", "txt", "docx"]
ClaimSupport = Literal["supported", "weak", "unsupported"]


class BodySection(BaseModel):
    heading: str | None = None
    paragraphs: list[str]


class FileDoc(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: FileType
    sizeBytes: int
    uploadedAt: datetime
    status: IndexStatus
    summary: str | None = None
    topic: str | None = None
    chunkCount: int
    claimCount: int
    body: list[BodySection] | None = None


class ChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    fileId: str
    index: int
    text: str
    tokens: int


class ClaimOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    fileId: str
    chunkId: str
    text: str


class ConflictSide(BaseModel):
    fileId: str
    fileName: str
    text: str
    chunkSnippet: str


class ConflictOut(BaseModel):
    id: str
    detectedAt: datetime
    status: Literal["pending", "resolved"]
    claimA: ConflictSide
    claimB: ConflictSide
    resolution: Literal["a-authoritative", "b-authoritative", "context-dependent"] | None = None


class Evidence(BaseModel):
    fileId: str
    fileName: str
    chunkId: str
    snippet: str


class VerifiedClaim(BaseModel):
    text: str
    support: ClaimSupport
    evidence: list[Evidence] | None = None


class Citation(BaseModel):
    n: int
    fileId: str
    fileName: str
    chunkId: str
    snippet: str


class TraceEvent(BaseModel):
    node: str
    ms: int
    meta: str | None = None


class ChatMessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    verified: list[VerifiedClaim] | None = None
    citations: list[Citation] | None = None
    trace: list[TraceEvent] | None = None
    langsmithUrl: str | None = None


class ChatRequest(BaseModel):
    question: str
    mode: Literal["quick", "research"] = "quick"


class ResolveConflictRequest(BaseModel):
    resolution: Literal["a-authoritative", "b-authoritative", "context-dependent"]


class StatsOut(BaseModel):
    files: int
    indexed: int
    processing: int
    chunks: int
    claims: int
    pendingConflicts: int
