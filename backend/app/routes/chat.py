from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session

from .. import db
from ..graphs.qa import run_qa
from ..schemas import ChatMessageOut, ChatRequest

router = APIRouter(prefix="/chat", tags=["chat"])


def _chat_out(row: db.ChatRun) -> ChatMessageOut:
    return ChatMessageOut(
        id=row.id,
        role="assistant",
        content=row.answer,
        verified=row.verified,
        citations=row.citations,
        trace=row.trace,
        langsmithUrl=row.langsmith_url,
    )


@router.post("")
def chat(payload: ChatRequest):
    def events():
        result = run_qa(payload.question)
        with db.SessionLocal() as session:
            session.add(
                db.ChatRun(
                    id=result["id"],
                    question=payload.question,
                    answer=result["answer"],
                    verified=result["verified"],
                    citations=result["citations"],
                    trace=result["trace"],
                    langsmith_url=result["langsmith_url"],
                )
            )
            session.commit()

        for trace_event in result["trace"]:
            yield {"event": "trace_event", "data": json.dumps(trace_event)}
        yield {
            "event": "final",
            "data": json.dumps(
                {
                    "id": result["id"],
                    "role": "assistant",
                    "content": result["answer"],
                    "verified": result["verified"],
                    "citations": result["citations"],
                    "trace": result["trace"],
                    "langsmithUrl": result["langsmith_url"],
                }
            ),
        }

    return EventSourceResponse(events())


@router.get("/{run_id}", response_model=ChatMessageOut)
def get_chat_run(run_id: str, session: Session = Depends(db.get_session)) -> ChatMessageOut:
    row = session.get(db.ChatRun, run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Chat run not found")
    return _chat_out(row)
