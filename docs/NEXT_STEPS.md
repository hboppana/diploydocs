# DiployDocs — Next Steps & State

> Reminder note from a local working session. Snapshot of where things stand and what to pick up next.

## Where things stand

DiployDocs is a locally-running, single-user demo of an agentic internal knowledge base:
FastAPI + SQLAlchemy/SQLite + ChromaDB + LangGraph/LangChain on Gemini (`gemini-2.5-flash`),
with a React/Vite/Tailwind frontend.

**Two LangGraph pipelines** do the work:
- **Ingest** (`backend/app/graphs/ingest.py`): extract → chunk → enrich → embed → extract claims → detect conflicts.
- **QA / self-correcting RAG** (`backend/app/graphs/qa.py`): retrieve → grade relevance → (rewrite + retry) → generate → decompose claims → verify each claim.

### Built this session
- **Upload** files (`.txt` / `.md` / `.pdf`) — `POST /files`, background ingestion, live status polling.
- **Author docs in-app** (Markdown editor) — `POST /files/compose`, page `frontend/src/pages/ComposeDoc.tsx` at `/new`.
- **Edit any file** (including uploaded ones — we only store the extracted body) — `PUT /files/{id}`, reuses the editor at `/files/:id/edit`.
- **Re-index** — `POST /files/{id}/reindex` (idempotent).
- **Delete** — `DELETE /files/{id}` (clears DB rows + Chroma vectors).
- **Search / filter** in the Library (name / topic / status).
- **Embedding map** — `GET /embeddings/projection?kind=chunks|claims`, PCA (numpy) to 2D, SVG scatter at `/embeddings`, with **conflict links** on the claims view (hover to isolate).

### Data currently populated
Loaded via `python -m app.seed --add-conflicts`: **7 files, ~28 claims, 16 conflicts**.
The 5 conflict-demo docs live in `backend/app/seed.py` (`CONFLICT_DEMO_FILES`).

## Next steps (priority order)

### 1. Eval harness — HIGHEST LEVERAGE
The most credible thing missing. Build a small labeled set + scoring script:
- ~20–30 hand-labeled Q&A pairs over the current 7-doc corpus.
- Use the 16 planted conflicts as ground truth.
- Score: **retrieval hit-rate**, **claim-verification accuracy** (supported/weak/unsupported vs human labels),
  **conflict precision/recall**.
- CLI-runnable, prints a summary table.
- Why: turns "I built it" into "I built it and measured it" — flips the hardest interview/demo question into a strength.

### 2. Visualization upgrade (optional)
Swap PCA for a neighborhood-preserving projection (UMAP or t-SNE) so "close on screen" actually means
"close in embedding space" — makes the conflict links land where the eye expects. Needs a dependency
(`umap-learn`); treat as its own task. PCA only captures ~31% variance on the claims view, so current line
geometry isn't fully meaningful (that's why the links are an exploratory hover layer, not the default story).

### 3. Smaller feature wins
- **DOCX upload** support (add `python-docx`, one extractor branch, restore the `.docx` chip).
- **Delete button on Library cards** (currently only on FileDetail; cards are `<Link>`s so it needs a hover affordance).
- **Drag-and-drop** onto the upload card.
- Inline "edit just this section" on FileDetail.

### 4. Path to a real product (bigger)
Auth + multi-tenancy, async job queue for ingestion (currently FastAPI BackgroundTasks),
LLM cost/latency controls (ingest fires 10+ sequential calls per doc), tests, deployment.

## How to run

Backend (from `backend/`, needs `GOOGLE_API_KEY` in `.env`):
```
uvicorn app.main:app --reload
```
Frontend (from `frontend/`):
```
npm run dev
```
Re-seed / add conflict demo data (from `backend/`):
```
python -m app.seed --reseed          # wipe + rebuild base corpus
python -m app.seed --add-conflicts   # additively load the 5 conflict docs
```

## Notes / gotchas
- Venv lives at `backend/.venv`; `pypdf` is installed there (used for PDF extraction).
- `all_embeddings()` returns Chroma embeddings as a numpy array — don't use `or []` truthiness on it.
- Conflict detection only checks a NEW doc's claims against EXISTING claims in OTHER files at ingest time,
  so re-indexing rebuilds a file's conflicts from scratch.
- No auth, CORS hardcoded to `localhost:5173`, data in `backend/data/` (SQLite + Chroma).
