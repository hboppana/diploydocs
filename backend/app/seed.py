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


# Five extra docs engineered to contradict each other and the two base docs above.
# Conflict map (subject -> who disagrees):
#   idle session timeout : security-guidelines (1h) vs api-gateway (30m) vs mobile (never)
#   token signing alg    : auth-spec-v2 (EdDSA) vs api-gateway (HS256)
#   refresh token reuse  : auth-spec-v2 (single-use) vs mobile (reusable 90d)
#   password rotation    : security-guidelines (humans none / svc 90d) vs account-policy (all 60d)
#   log/data retention   : data-retention (30d then deleted) vs backup-dr (kept indefinitely)
CONFLICT_DEMO_FILES = [
    {
        "id": "f_api_gateway",
        "name": "api-gateway-config.md",
        "type": "md",
        "uploaded_at": "2026-05-20T10:00:00Z",
        "body": [
            {"paragraphs": ["Production API gateway configuration for all north-south traffic into Diploy services."]},
            {
                "heading": "Session handling",
                "paragraphs": [
                    "Idle user sessions are terminated after 30 minutes of inactivity. The gateway does not distinguish between privileged and standard sessions for idle timeout purposes."
                ],
            },
            {
                "heading": "Token verification",
                "paragraphs": [
                    "The gateway signs and verifies all access tokens using the HS256 symmetric algorithm. The shared signing secret is loaded from the gateway environment variable at boot."
                ],
            },
            {
                "heading": "Rate limiting",
                "paragraphs": [
                    "Each client IP is limited to 100 requests per minute. Requests above the limit receive an HTTP 429 response with a Retry-After header."
                ],
            },
        ],
    },
    {
        "id": "f_mobile_client",
        "name": "mobile-client-guide.md",
        "type": "md",
        "uploaded_at": "2026-05-18T16:30:00Z",
        "body": [
            {"paragraphs": ["Guidance for engineers building the Diploy mobile applications for iOS and Android."]},
            {
                "heading": "Session persistence",
                "paragraphs": [
                    "Mobile sessions remain active indefinitely and never expire as long as the application stays installed on the device. Users are not forced to re-authenticate during normal use."
                ],
            },
            {
                "heading": "Refresh tokens",
                "paragraphs": [
                    "A single refresh token can be reused repeatedly for up to 90 days. The mobile client stores the refresh token and presents the same token on every refresh without rotation."
                ],
            },
        ],
    },
    {
        "id": "f_account_policy",
        "name": "account-and-password-policy.md",
        "type": "md",
        "uploaded_at": "2026-04-10T08:00:00Z",
        "body": [
            {"paragraphs": ["Company-wide policy for the credential lifecycle across all account types."]},
            {
                "heading": "Rotation",
                "paragraphs": [
                    "Every account password, including both human and service accounts, must be rotated every 60 days without exception. Automated reminders are sent seven days before expiry."
                ],
            },
            {
                "heading": "Multi-factor authentication",
                "paragraphs": [
                    "All human accounts must enroll in multi-factor authentication using a hardware security key or an authenticator app."
                ],
            },
        ],
    },
    {
        "id": "f_data_retention",
        "name": "data-retention-policy.md",
        "type": "md",
        "uploaded_at": "2026-02-15T11:00:00Z",
        "body": [
            {"paragraphs": ["Defines how long each category of data is kept in Diploy systems."]},
            {
                "heading": "Activity logs",
                "paragraphs": [
                    "User activity logs are retained for 30 days and then permanently deleted. No copies are kept after the retention window closes."
                ],
            },
            {
                "heading": "Personal data",
                "paragraphs": [
                    "Personal data is permanently deleted within 30 days of an account being closed."
                ],
            },
        ],
    },
    {
        "id": "f_backup_dr",
        "name": "backup-and-dr-plan.md",
        "type": "md",
        "uploaded_at": "2026-01-22T13:45:00Z",
        "body": [
            {"paragraphs": ["Backup and disaster-recovery plan for Diploy production data stores."]},
            {
                "heading": "Retention",
                "paragraphs": [
                    "All user activity logs and database backups are retained indefinitely for audit and compliance purposes. Nothing is ever permanently deleted from cold storage."
                ],
            },
            {
                "heading": "Schedule",
                "paragraphs": [
                    "Full backups run nightly and are replicated to a second region within one hour."
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


def add_conflict_demo_docs() -> None:
    """Additively ingest the five conflict-demo docs (skips any already present)."""
    db.init_db()
    for item in CONFLICT_DEMO_FILES:
        with db.SessionLocal() as session:
            if session.get(db.File, item["id"]) is not None:
                print(f"Skipping {item['name']} (already present).")
                continue
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
    print("Conflict demo docs loaded.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed DiployDocs with the demo corpus.")
    parser.add_argument("--reseed", action="store_true", help="Clear SQLite and Chroma before loading seed data.")
    parser.add_argument("--add-conflicts", action="store_true", help="Additively load 5 docs engineered to create conflicts.")
    args = parser.parse_args()
    if args.add_conflicts:
        add_conflict_demo_docs()
        return
    if not args.reseed:
        with db.SessionLocal() as session:
            if session.query(db.File).count() > 0:
                print("Seed data already exists. Use --reseed to rebuild it.")
                return
    reseed()


if __name__ == "__main__":
    main()
