from __future__ import annotations

from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

from .config import settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class File(Base):
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String, default="pending")
    summary: Mapped[str | None] = mapped_column(String, nullable=True)
    topic: Mapped[str | None] = mapped_column(String, nullable=True)
    body = Column(JSON, nullable=True)  # list[BodySection]
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    claim_count: Mapped[int] = mapped_column(Integer, default=0)

    chunks: Mapped[list["Chunk"]] = relationship(back_populates="file", cascade="all, delete-orphan")
    claims: Mapped[list["Claim"]] = relationship(back_populates="file", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    file_id: Mapped[str] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"))
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(String, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0)

    file: Mapped[File] = relationship(back_populates="chunks")
    claims: Mapped[list["Claim"]] = relationship(back_populates="chunk")


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    file_id: Mapped[str] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"))
    chunk_id: Mapped[str] = mapped_column(ForeignKey("chunks.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(String, nullable=False)

    file: Mapped[File] = relationship(back_populates="claims")
    chunk: Mapped[Chunk] = relationship(back_populates="claims")


class Conflict(Base):
    __tablename__ = "conflicts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    claim_a_id: Mapped[str] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    claim_b_id: Mapped[str] = mapped_column(ForeignKey("claims.id", ondelete="CASCADE"))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String, default="pending")  # pending | resolved
    resolution: Mapped[str | None] = mapped_column(String, nullable=True)  # a-authoritative | b-authoritative | context-dependent


class ChatRun(Base):
    __tablename__ = "chat_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    question: Mapped[str] = mapped_column(String, nullable=False)
    answer: Mapped[str] = mapped_column(String, nullable=False)
    verified = Column(JSON, nullable=False, default=list)     # list[VerifiedClaim]
    citations = Column(JSON, nullable=False, default=list)    # list[Citation]
    trace = Column(JSON, nullable=False, default=list)        # list[TraceEvent]
    langsmith_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


engine = create_engine(f"sqlite:///{settings.sqlite_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
