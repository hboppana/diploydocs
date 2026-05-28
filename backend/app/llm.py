"""Lazy singletons for the LLM and any structured-output helpers.

We keep these here so test code and graphs share one configured instance.
"""

from __future__ import annotations

from functools import lru_cache

from langchain_google_genai import ChatGoogleGenerativeAI

from .config import settings


@lru_cache(maxsize=1)
def get_llm() -> ChatGoogleGenerativeAI:
    if not settings.google_api_key:
        raise RuntimeError(
            "GOOGLE_API_KEY is not set. Copy backend/.env.example to backend/.env and fill it in."
        )
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.google_api_key,
        temperature=0.2,
    )
