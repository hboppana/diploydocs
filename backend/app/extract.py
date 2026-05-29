"""Turn uploaded file bytes into the `body_sections` shape the ingest graph expects.

Each extractor returns `list[dict]` matching the `BodySection` schema:
`[{"heading": str | None, "paragraphs": [str, ...]}, ...]`.

The ingest graph's `extract_text` node flattens these via `_flatten_body`, so anything
we produce here flows through chunk → enrich → embed → claims → conflicts unchanged.
"""

from __future__ import annotations

import io
import re

# Map file extension -> the `FileType` literal stored on the File row.
SUPPORTED_TYPES = {"txt": "txt", "md": "md", "markdown": "md", "pdf": "pdf"}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


class UnsupportedFileType(ValueError):
    pass


class EmptyDocument(ValueError):
    pass


def file_type_for(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in SUPPORTED_TYPES:
        raise UnsupportedFileType(
            f"Unsupported file type '.{ext}'. Supported: .txt, .md, .pdf"
        )
    return SUPPORTED_TYPES[ext]


def _paragraphs(text: str) -> list[str]:
    """Split on blank lines into paragraphs, dropping empties."""
    return [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]


def _extract_plain(text: str) -> list[dict]:
    paras = _paragraphs(text)
    if not paras:
        raise EmptyDocument("Document has no extractable text.")
    return [{"heading": None, "paragraphs": paras}]


def _extract_markdown(text: str) -> list[dict]:
    """Split on ATX headings (`#`, `##`, ...) so each section maps onto a BodySection."""
    sections: list[dict] = []
    current_heading: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            paras = _paragraphs("\n\n".join(buffer))
            if paras:
                sections.append({"heading": current_heading, "paragraphs": paras})

    for line in text.splitlines():
        m = re.match(r"^#{1,6}\s+(.*)", line)
        if m:
            flush()
            current_heading = m.group(1).strip()
            buffer = []
        else:
            buffer.append(line)
    flush()

    if not sections:
        # No headings at all — fall back to plain paragraph splitting.
        return _extract_plain(text)
    return sections


def _extract_pdf(data: bytes) -> list[dict]:
    try:
        from pypdf import PdfReader
    except ImportError as e:  # pragma: no cover - dependency guard
        raise RuntimeError("pypdf is required to parse PDFs. Run `pip install pypdf`.") from e

    reader = PdfReader(io.BytesIO(data))
    sections: list[dict] = []
    for i, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip()
        paras = _paragraphs(text)
        if paras:
            sections.append({"heading": f"Page {i + 1}", "paragraphs": paras})
    if not sections:
        raise EmptyDocument(
            "No extractable text found in the PDF (it may be scanned images)."
        )
    return sections


def extract_body_sections(*, filename: str, data: bytes) -> list[dict]:
    """Dispatch on file type. Raises UnsupportedFileType / EmptyDocument on bad input."""
    file_type = file_type_for(filename)
    if file_type == "pdf":
        return _extract_pdf(data)

    text = data.decode("utf-8", errors="replace")
    if file_type == "md":
        return _extract_markdown(text)
    return _extract_plain(text)
