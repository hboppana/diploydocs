from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import db
from .routes import chat, conflicts, files
from .schemas import StatsOut

app = FastAPI(title="DiployDocs API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(chat.router)
app.include_router(conflicts.router)


@app.on_event("startup")
def startup() -> None:
    db.init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true"}


@app.get("/stats", response_model=StatsOut)
def stats(session: Session = Depends(db.get_session)) -> StatsOut:
    return files.get_stats(session)
