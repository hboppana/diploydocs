from __future__ import annotations

import argparse
from datetime import datetime, timezone

from sqlalchemy import or_

from . import db
from .graphs.ingest import ingest_file
from .vectors import reset_all, upsert_claim


SEED_FILES = [
    {
        "id": "f_auth_v2",
        "name": "auth-spec-v2.pdf",
        "type": "pdf",
        "uploaded_at": "2026-05-27T14:12:00Z",
        "body": [
            {
                "paragraphs": [
                    "This service-side authentication specification supersedes old-auth.md as of v2. All consumer services must migrate to the new token format and rotation flow by end of Q3."
                ]
            },
            {
                "heading": "Session lifetime",
                "paragraphs": [
                    "All authenticated sessions expire 24 hours after issuance. Sliding refresh extends the window by 24 hours on each successful refresh, capped at 30 days of continuous activity. Sessions inactive for more than 7 days are revoked regardless of token validity."
                ],
            },
            {
                "heading": "Refresh token rotation",
                "paragraphs": [
                    "Refresh tokens are single-use. On every refresh, the server issues a new refresh token and revokes the prior one. If a previously rotated token is ever presented as a replay, the full session family is revoked and the user is signed out across all devices."
                ],
            },
            {
                "heading": "Signing algorithm",
                "paragraphs": [
                    "Access tokens use EdDSA with Ed25519. HS256 is deprecated as of v2; services still validating HS256-signed tokens must migrate by end of Q3. Public keys are distributed via the JWKS endpoint with a 24-hour cache TTL."
                ],
            },
        ],
    },
    {
        "id": "f_sec_guidelines",
        "name": "security-guidelines.md",
        "type": "md",
        "uploaded_at": "2026-03-31T09:02:00Z",
        "body": [
            {
                "paragraphs": [
                    "These guidelines apply to every service in the Diploy production environment. Exceptions require sign-off from the security team and must be tracked in the Vault exception registry."
                ]
            },
            {
                "heading": "4.2 Session policy",
                "paragraphs": [
                    "All user sessions must expire after 1 hour of inactivity. Privileged sessions expire after 15 minutes of inactivity and cannot be extended via refresh.",
                    "Note: this policy predates the v2 auth specification. See the Conflicts page if the new spec changes the inactivity window.",
                ],
            },
            {
                "heading": "5.1 Secrets",
                "paragraphs": [
                    "All secrets, including API keys, database credentials, and signing keys, live in Vault. Code that reads a secret from disk, env, or a checked-in file fails review on sight."
                ],
            },
            {
                "heading": "6.0 Password rotation",
                "paragraphs": [
                    "Service-account passwords rotate every 90 days. Human accounts use SSO and do not have rotation requirements."
                ],
            },
        ],
    },
]


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _body_size(body: list[dict]) -> int:
    return sum(len(p.encode("utf-8")) for section in body for p in section.get("paragraphs", []))


def _find_claim(session: db.Session, terms: list[str]) -> db.Claim | None:
    claims = session.query(db.Claim).all()
    for claim in claims:
        text = claim.text.lower()
        if all(term.lower() in text for term in terms):
            return claim
    return None


def _ensure_claim(session: db.Session, *, file_id: str, claim_id: str, text: str) -> db.Claim | None:
    existing = session.get(db.Claim, claim_id)
    if existing is not None:
        return existing
    file = session.get(db.File, file_id)
    chunk = session.query(db.Chunk).filter(db.Chunk.file_id == file_id).order_by(db.Chunk.idx).first()
    if file is None or chunk is None:
        return None
    claim = db.Claim(id=claim_id, file_id=file_id, chunk_id=chunk.id, text=text)
    session.add(claim)
    file.claim_count = (file.claim_count or 0) + 1
    session.flush()
    upsert_claim(claim_id=claim.id, file_id=file.id, file_name=file.name, chunk_id=chunk.id, text=text)
    return claim


def _ensure_conflict(session: db.Session, a_terms: list[str], b_terms: list[str]) -> None:
    a = _find_claim(session, a_terms)
    b = _find_claim(session, b_terms)
    if a is None or b is None or a.id == b.id:
        return
    existing = (
        session.query(db.Conflict)
        .filter(
            or_(
                (db.Conflict.claim_a_id == a.id) & (db.Conflict.claim_b_id == b.id),
                (db.Conflict.claim_a_id == b.id) & (db.Conflict.claim_b_id == a.id),
            )
        )
        .first()
    )
    if existing is None:
        session.add(db.Conflict(id=f"cf_seed_{a.id[-5:]}_{b.id[-5:]}", claim_a_id=a.id, claim_b_id=b.id, status="pending"))


def add_seed_conflict_backstops() -> None:
    with db.SessionLocal() as session:
        _ensure_claim(
            session,
            file_id="f_auth_v2",
            claim_id="cl_seed_auth_session_24h",
            text="All authenticated sessions expire 24 hours after issuance.",
        )
        _ensure_claim(
            session,
            file_id="f_sec_guidelines",
            claim_id="cl_seed_security_session_1h",
            text="All user sessions must expire after one hour of inactivity.",
        )
        _ensure_conflict(session, ["24", "session"], ["one hour", "session"])
        session.commit()


def reseed() -> None:
    db.init_db()
    with db.SessionLocal() as session:
        session.query(db.ChatRun).delete()
        session.query(db.Conflict).delete()
        session.query(db.Claim).delete()
        session.query(db.Chunk).delete()
        session.query(db.File).delete()
        session.commit()
    reset_all()

    for item in SEED_FILES:
        with db.SessionLocal() as session:
            session.add(
                db.File(
                    id=item["id"],
                    name=item["name"],
                    type=item["type"],
                    size_bytes=_body_size(item["body"]),
                    uploaded_at=_parse_dt(item["uploaded_at"]),
                    status="pending",
                    body=item["body"],
                )
            )
            session.commit()
        print(f"Indexing {item['name']}...")
        ingest_file(file_id=item["id"], file_name=item["name"], body_sections=item["body"])

    add_seed_conflict_backstops()
    print("Seed complete.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed DiployDocs with the two-file demo corpus.")
    parser.add_argument("--reseed", action="store_true", help="Clear SQLite and Chroma before loading seed data.")
    args = parser.parse_args()
    if not args.reseed:
        with db.SessionLocal() as session:
            if session.query(db.File).count() > 0:
                print("Seed data already exists. Use --reseed to rebuild it.")
                return
    reseed()


if __name__ == "__main__":
    main()
