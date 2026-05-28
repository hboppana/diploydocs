import type { ChatMessage, Chunk, Claim, Conflict, FileDoc } from "./types";

export const mockFiles: FileDoc[] = [
  {
    id: "f_auth_v2",
    name: "auth-spec-v2.pdf",
    type: "pdf",
    sizeBytes: 1_240_000,
    uploadedAt: "2026-05-27T14:12:00Z",
    status: "indexed",
    summary:
      "Refresh-token rotation replaces the long-lived session model; sessions now expire after 24 hours with sliding refresh.",
    topic: "Authentication",
    chunkCount: 47,
    claimCount: 18,
    body: [
      {
        paragraphs: [
          "This service-side authentication specification supersedes old-auth.md as of v2. All consumer services must migrate to the new token format and rotation flow by end of Q3.",
        ],
      },
      {
        heading: "Session lifetime",
        paragraphs: [
          "All authenticated sessions expire 24 hours after issuance. Sliding refresh extends the window by 24 hours on each successful refresh, capped at 30 days of continuous activity. Sessions inactive for more than 7 days are revoked regardless of token validity.",
        ],
      },
      {
        heading: "Refresh token rotation",
        paragraphs: [
          "Refresh tokens are single-use. On every refresh, the server issues a new refresh token and revokes the prior one. If a previously rotated token is ever presented (replay), the full session family is revoked and the user is signed out across all devices.",
        ],
      },
      {
        heading: "Signing algorithm",
        paragraphs: [
          "Access tokens use EdDSA (Ed25519). HS256 is deprecated as of v2 — services still validating HS256-signed tokens MUST migrate by end of Q3. Public keys are distributed via the JWKS endpoint with a 24-hour cache TTL.",
        ],
      },
    ],
  },
  {
    id: "f_sec_guidelines",
    name: "security-guidelines.md",
    type: "md",
    sizeBytes: 18_400,
    uploadedAt: "2026-03-31T09:02:00Z",
    status: "indexed",
    summary:
      "Baseline security guidelines for engineering: session timeout, password rotation, secret storage in Vault.",
    topic: "Security",
    chunkCount: 22,
    claimCount: 14,
    body: [
      {
        paragraphs: [
          "These guidelines apply to every service in the Diploy production environment. Exceptions require sign-off from the security team and must be tracked in the Vault exception registry.",
        ],
      },
      {
        heading: "4.2 Session policy",
        paragraphs: [
          "All user sessions must expire after 1 hour of inactivity. Privileged sessions (admin, ops) expire after 15 minutes of inactivity and cannot be extended via refresh.",
          "Note: this policy predates the v2 auth specification. See the Conflicts page if the new spec changes the inactivity window.",
        ],
      },
      {
        heading: "5.1 Secrets",
        paragraphs: [
          "All secrets — API keys, database credentials, signing keys — live in Vault. Code that reads a secret from disk, env, or a checked-in file fails review on sight.",
        ],
      },
      {
        heading: "6.0 Password rotation",
        paragraphs: [
          "Service-account passwords rotate every 90 days. Human accounts use SSO and do not have rotation requirements.",
        ],
      },
    ],
  },
  {
    id: "f_deploy_runbook",
    name: "deploy-runbook.md",
    type: "md",
    sizeBytes: 42_100,
    uploadedAt: "2026-05-20T17:33:00Z",
    status: "indexed",
    summary:
      "Canary rollout procedure for the Kubernetes deployment pipeline, including rollback and on-call escalation paths.",
    topic: "Deployment",
    chunkCount: 31,
    claimCount: 21,
    body: [
      {
        heading: "Overview",
        paragraphs: [
          "Every production deploy goes through a canary stage before promotion. The default policy is documented here; service-specific overrides live in each service's deploy.yaml.",
        ],
      },
      {
        heading: "Canary stage",
        paragraphs: [
          "Canary rollouts target 5% of traffic for a minimum of 15 minutes before full rollout. Error rate, P95 latency, and the service's golden-signal SLO must all stay green over the canary window.",
          "If any metric trips its threshold, the rollout halts automatically and pages the on-call.",
        ],
      },
      {
        heading: "Promotion",
        paragraphs: [
          "After 15 minutes of green canary, the rollout linearly ramps to 100% over 10 minutes. No manual approval is required for non-privileged services; privileged services (auth, billing) require a second engineer to click promote.",
        ],
      },
      {
        heading: "Rollback",
        paragraphs: [
          "Rollbacks are one-click and revert to the prior healthy revision. Rollback time is bounded at 2 minutes. After a rollback, the on-call must file a brief incident note even if no users were impacted.",
        ],
      },
    ],
  },
  {
    id: "f_brand_voice",
    name: "brand-voice-2026.pdf",
    type: "pdf",
    sizeBytes: 880_000,
    uploadedAt: "2026-05-25T11:00:00Z",
    status: "indexed",
    summary:
      "Voice and tone guide for marketing copy: direct, technical-but-approachable, no hype words.",
    topic: "Marketing",
    chunkCount: 19,
    claimCount: 12,
    body: [
      {
        heading: "Voice principles",
        paragraphs: [
          "We write like an engineer talking to another engineer over coffee. Direct, specific, and never breathless. If a sentence would feel out of place in a pull-request description, it doesn't belong on the marketing site either.",
        ],
      },
      {
        heading: "Words to avoid",
        paragraphs: [
          'Avoid: "revolutionary", "game-changing", "seamless", "world-class", "cutting-edge", "synergy", "leverage" (as a verb). These words signal hype and erode trust with technical buyers.',
        ],
      },
      {
        heading: "Words we like",
        paragraphs: [
          'Prefer: "fast", "honest", "measured", and verbs that describe what the product actually does. "Indexes your docs in under a minute" beats "leverages cutting-edge AI to revolutionize knowledge management."',
        ],
      },
      {
        heading: "Examples",
        paragraphs: [
          "Bad: \"Our seamless platform leverages best-in-class AI to deliver world-class document intelligence.\"",
          "Good: \"Upload a PDF. We extract the claims, check them against the rest of your docs, and tell you when something contradicts.\"",
        ],
      },
    ],
  },
  {
    id: "f_pricing",
    name: "pricing-proposal.docx",
    type: "docx",
    sizeBytes: 64_200,
    uploadedAt: "2026-05-27T15:48:00Z",
    status: "embedding",
    summary: "Draft pricing tiers for the Q3 launch.",
    topic: "Pricing",
    chunkCount: 9,
    claimCount: 0,
    body: [
      {
        heading: "Q3 launch pricing — DRAFT",
        paragraphs: [
          "This document is still being indexed. Claim extraction will complete shortly after the embedding stage finishes.",
        ],
      },
      {
        heading: "Tier sketch",
        paragraphs: [
          "Free: up to 50 documents, single workspace, community support.",
          "Team: $29/user/month, up to 5,000 documents, conflict detection, LangSmith traces visible.",
          "Business: custom, SSO, audit log, on-prem embedding model, dedicated support.",
        ],
      },
    ],
  },
  {
    id: "f_incident_apr12",
    name: "incident-2026-04-12.md",
    type: "md",
    sizeBytes: 11_900,
    uploadedAt: "2026-04-12T22:14:00Z",
    status: "indexed",
    summary:
      "Post-mortem of the April 12 outage caused by an unbounded session table during a misconfigured rollout.",
    topic: "Incidents",
    chunkCount: 14,
    claimCount: 9,
    body: [
      {
        heading: "Summary",
        paragraphs: [
          "On 2026-04-12 at 18:02 UTC, the auth service became unresponsive for 47 minutes. The root cause was an unbounded sessions table growing without TTL after a misconfigured rollout disabled the cleanup job.",
        ],
      },
      {
        heading: "Timeline",
        paragraphs: [
          "18:02 — Latency on /auth/refresh crosses SLO. On-call paged.",
          "18:09 — On-call identifies the sessions table at 41M rows, growing 200k/min.",
          "18:31 — Cleanup job re-enabled; backfill TTL applied to all rows older than 24h.",
          "18:49 — Latency returns to baseline. Incident closed.",
        ],
      },
      {
        heading: "Contributing factors",
        paragraphs: [
          "At time of incident, canary was configured at 50% of traffic, well above the documented policy. The misconfiguration shipped because the deploy.yaml override was never reviewed.",
        ],
      },
      {
        heading: "Action items",
        paragraphs: [
          "Deploy.yaml overrides above the policy threshold now require security sign-off. The sessions table has a hard cap and an alert at 80% capacity.",
        ],
      },
    ],
  },
  {
    id: "f_old_auth",
    name: "old-auth.md",
    type: "md",
    sizeBytes: 7_200,
    uploadedAt: "2025-11-04T08:30:00Z",
    status: "indexed",
    summary:
      "Legacy single-session model with 1-hour expiry. Superseded by auth-spec-v2.",
    topic: "Authentication",
    chunkCount: 8,
    claimCount: 6,
    body: [
      {
        paragraphs: [
          "Legacy authentication design — kept for historical reference. New services must use auth-spec-v2.pdf.",
        ],
      },
      {
        heading: "Session model",
        paragraphs: [
          "Each user has at most one active session at a time. Sessions expire after 1 hour of inactivity. Re-authenticating from a new device invalidates the existing session.",
        ],
      },
      {
        heading: "Token signing",
        paragraphs: [
          "Tokens are signed with HMAC-SHA256 using a shared service secret. Token signing: HMAC-SHA256, key rotated quarterly via Vault.",
        ],
      },
    ],
  },
  {
    id: "f_pricing_2",
    name: "campaign-brief-q3.pdf",
    type: "pdf",
    sizeBytes: 320_000,
    uploadedAt: "2026-05-27T15:59:00Z",
    status: "enriching",
    chunkCount: 11,
    claimCount: 0,
    body: [
      {
        heading: "Q3 launch campaign — brief",
        paragraphs: [
          "Currently being enriched. Claim extraction will run after enrichment finishes.",
        ],
      },
      {
        heading: "Audience",
        paragraphs: [
          "Senior engineers and engineering managers at 50-500 person companies who feel the pain of internal docs drifting out of sync.",
        ],
      },
      {
        heading: "Hook",
        paragraphs: [
          "\"Your internal docs lie to you. We catch it the moment a new doc contradicts an old one.\"",
        ],
      },
    ],
  },
];

export const mockClaims: Record<string, Claim[]> = {
  f_auth_v2: [
    { id: "c1", fileId: "f_auth_v2", chunkId: "ch_3", text: "Sessions expire after 24 hours with sliding refresh." },
    { id: "c2", fileId: "f_auth_v2", chunkId: "ch_7", text: "Refresh tokens rotate on every use; reuse triggers session revocation." },
    { id: "c3", fileId: "f_auth_v2", chunkId: "ch_12", text: "Access tokens are signed with EdDSA, not HS256." },
    { id: "c4", fileId: "f_auth_v2", chunkId: "ch_18", text: "Token introspection is rate-limited to 200 req/s per service." },
  ],
  f_sec_guidelines: [
    { id: "sg_c1", fileId: "f_sec_guidelines", chunkId: "ch_4", text: "User sessions must expire after 1 hour of inactivity." },
    { id: "sg_c2", fileId: "f_sec_guidelines", chunkId: "ch_4", text: "Privileged sessions expire after 15 minutes of inactivity." },
    { id: "sg_c3", fileId: "f_sec_guidelines", chunkId: "ch_5", text: "All secrets must be stored in Vault." },
    { id: "sg_c4", fileId: "f_sec_guidelines", chunkId: "ch_6", text: "Service-account passwords rotate every 90 days." },
  ],
  f_deploy_runbook: [
    { id: "dr_c1", fileId: "f_deploy_runbook", chunkId: "ch_2", text: "Canary rollouts target 5% of traffic for at least 15 minutes." },
    { id: "dr_c2", fileId: "f_deploy_runbook", chunkId: "ch_3", text: "Privileged services require a second engineer to promote a rollout." },
    { id: "dr_c3", fileId: "f_deploy_runbook", chunkId: "ch_4", text: "Rollback time is bounded at 2 minutes." },
  ],
  f_brand_voice: [
    { id: "bv_c1", fileId: "f_brand_voice", chunkId: "ch_2", text: "Avoid hype words like 'revolutionary' and 'world-class'." },
    { id: "bv_c2", fileId: "f_brand_voice", chunkId: "ch_1", text: "Marketing copy should sound like one engineer talking to another." },
    { id: "bv_c3", fileId: "f_brand_voice", chunkId: "ch_3", text: "Prefer concrete verbs that describe what the product does." },
  ],
  f_incident_apr12: [
    { id: "ic_c1", fileId: "f_incident_apr12", chunkId: "ch_1", text: "Outage lasted 47 minutes starting 18:02 UTC on 2026-04-12." },
    { id: "ic_c2", fileId: "f_incident_apr12", chunkId: "ch_3", text: "Canary was configured at 50% of traffic at time of incident." },
    { id: "ic_c3", fileId: "f_incident_apr12", chunkId: "ch_4", text: "Deploy overrides above policy now require security sign-off." },
  ],
  f_old_auth: [
    { id: "oa_c1", fileId: "f_old_auth", chunkId: "ch_2", text: "Users have at most one active session at a time." },
    { id: "oa_c2", fileId: "f_old_auth", chunkId: "ch_2", text: "Sessions expire after 1 hour of inactivity." },
    { id: "oa_c3", fileId: "f_old_auth", chunkId: "ch_3", text: "Tokens are signed with HMAC-SHA256 using a shared service secret." },
  ],
};

export const mockChunks: Record<string, Chunk[]> = {
  f_auth_v2: [
    { id: "ch_3", fileId: "f_auth_v2", index: 3, tokens: 184, text: "All authenticated sessions expire 24 hours after issuance. Sliding refresh extends the window by 24 hours on each successful refresh, capped at 30 days of continuous activity..." },
    { id: "ch_7", fileId: "f_auth_v2", index: 7, tokens: 211, text: "Refresh tokens are single-use. On every refresh, the server issues a new refresh token and revokes the prior one. If a previously rotated token is presented, the full session family is revoked..." },
    { id: "ch_12", fileId: "f_auth_v2", index: 12, tokens: 165, text: "Access tokens use EdDSA (Ed25519). HS256 is deprecated as of v2 — services still validating HS256-signed tokens MUST migrate by end of Q3..." },
    { id: "ch_18", fileId: "f_auth_v2", index: 18, tokens: 142, text: "Token introspection (POST /oauth/introspect) is rate-limited to 200 requests per second per service identity. Bursts above this threshold receive 429 with a Retry-After header..." },
  ],
  f_sec_guidelines: [
    { id: "ch_4", fileId: "f_sec_guidelines", index: 4, tokens: 132, text: "Section 4.2 — Session policy: All user sessions must expire after 1 hour of inactivity. Privileged sessions expire after 15 minutes and cannot be extended via refresh." },
    { id: "ch_5", fileId: "f_sec_guidelines", index: 5, tokens: 98, text: "Section 5.1 — Secrets: All secrets live in Vault. Code that reads a secret from disk, env, or a checked-in file fails review on sight." },
    { id: "ch_6", fileId: "f_sec_guidelines", index: 6, tokens: 84, text: "Section 6.0 — Password rotation: Service-account passwords rotate every 90 days. Human accounts use SSO and have no rotation requirement." },
  ],
  f_deploy_runbook: [
    { id: "ch_2", fileId: "f_deploy_runbook", index: 2, tokens: 156, text: "Canary stage: 5% of traffic for a minimum of 15 minutes. Error rate, P95 latency, and the service's golden-signal SLO must all stay green over the canary window." },
    { id: "ch_3", fileId: "f_deploy_runbook", index: 3, tokens: 121, text: "Promotion: after 15 minutes of green canary, the rollout linearly ramps to 100% over 10 minutes. Privileged services require a second engineer to click promote." },
    { id: "ch_4", fileId: "f_deploy_runbook", index: 4, tokens: 88, text: "Rollback: one-click revert to the prior healthy revision. Rollback time is bounded at 2 minutes." },
  ],
  f_brand_voice: [
    { id: "ch_1", fileId: "f_brand_voice", index: 1, tokens: 102, text: "We write like an engineer talking to another engineer over coffee. Direct, specific, and never breathless." },
    { id: "ch_2", fileId: "f_brand_voice", index: 2, tokens: 88, text: "Avoid: revolutionary, game-changing, seamless, world-class, cutting-edge, synergy, leverage (as a verb)." },
    { id: "ch_3", fileId: "f_brand_voice", index: 3, tokens: 95, text: "Prefer fast, honest, measured, and verbs that describe what the product actually does." },
  ],
  f_incident_apr12: [
    { id: "ch_1", fileId: "f_incident_apr12", index: 1, tokens: 124, text: "On 2026-04-12 at 18:02 UTC, the auth service became unresponsive for 47 minutes. Root cause: unbounded sessions table after a misconfigured rollout disabled the cleanup job." },
    { id: "ch_3", fileId: "f_incident_apr12", index: 3, tokens: 76, text: "At time of incident, canary was configured at 50% of traffic, well above the documented policy." },
    { id: "ch_4", fileId: "f_incident_apr12", index: 4, tokens: 92, text: "Deploy.yaml overrides above the policy threshold now require security sign-off. The sessions table has a hard cap and an alert at 80% capacity." },
  ],
  f_old_auth: [
    { id: "ch_2", fileId: "f_old_auth", index: 2, tokens: 110, text: "Each user has at most one active session at a time. Sessions expire after 1 hour of inactivity. Re-authenticating from a new device invalidates the existing session." },
    { id: "ch_3", fileId: "f_old_auth", index: 3, tokens: 64, text: "Token signing: HMAC-SHA256, key rotated quarterly via Vault." },
  ],
};

export const mockConflicts: Conflict[] = [
  {
    id: "cf_1",
    detectedAt: "2026-05-27T14:13:00Z",
    status: "pending",
    claimA: {
      fileId: "f_auth_v2",
      fileName: "auth-spec-v2.pdf",
      text: "Sessions expire after 24 hours with sliding refresh.",
      chunkSnippet: "All authenticated sessions expire 24 hours after issuance...",
    },
    claimB: {
      fileId: "f_sec_guidelines",
      fileName: "security-guidelines.md",
      text: "All user sessions must expire after 1 hour of inactivity.",
      chunkSnippet: "Section 4.2 — Session policy: All user sessions must expire after 1 hour of inactivity...",
    },
  },
  {
    id: "cf_2",
    detectedAt: "2026-05-27T13:48:00Z",
    status: "pending",
    claimA: {
      fileId: "f_auth_v2",
      fileName: "auth-spec-v2.pdf",
      text: "Access tokens are signed with EdDSA, not HS256.",
      chunkSnippet: "Access tokens use EdDSA (Ed25519). HS256 is deprecated as of v2...",
    },
    claimB: {
      fileId: "f_old_auth",
      fileName: "old-auth.md",
      text: "Tokens are signed with HMAC-SHA256 using a shared service secret.",
      chunkSnippet: "Token signing: HMAC-SHA256, key rotated quarterly via Vault...",
    },
  },
  {
    id: "cf_3",
    detectedAt: "2026-05-26T18:21:00Z",
    status: "resolved",
    resolution: "a-authoritative",
    claimA: {
      fileId: "f_deploy_runbook",
      fileName: "deploy-runbook.md",
      text: "Canary rollouts target 5% of traffic for 15 minutes before full rollout.",
      chunkSnippet: "Canary stage: 5% of traffic for a minimum of 15 minutes...",
    },
    claimB: {
      fileId: "f_incident_apr12",
      fileName: "incident-2026-04-12.md",
      text: "Canary was set to 50% of traffic, which is the standard policy at the time.",
      chunkSnippet: "At time of incident, canary was configured at 50%...",
    },
  },
];

export const mockChat: ChatMessage[] = [
  { id: "m1", role: "user", content: "How long do auth sessions last and how is rotation handled?" },
  {
    id: "m2",
    role: "assistant",
    content:
      "Sessions expire after 24 hours from issuance, with sliding refresh extending the window on each successful refresh. Refresh tokens are single-use and rotate on every refresh — presenting a previously rotated token revokes the entire session family. Tokens are signed using EdDSA, replacing the legacy HS256 scheme. Sessions are stored in Redis with a 7-day hard cap regardless of activity.",
    verified: [
      {
        text: "Sessions expire after 24 hours from issuance, with sliding refresh extending the window on each successful refresh.",
        support: "supported",
        evidence: [
          {
            fileId: "f_auth_v2",
            fileName: "auth-spec-v2.pdf",
            chunkId: "ch_3",
            snippet: "All authenticated sessions expire 24 hours after issuance. Sliding refresh extends the window by 24 hours on each successful refresh...",
          },
        ],
      },
      {
        text: "Refresh tokens are single-use and rotate on every refresh — presenting a previously rotated token revokes the entire session family.",
        support: "supported",
        evidence: [
          {
            fileId: "f_auth_v2",
            fileName: "auth-spec-v2.pdf",
            chunkId: "ch_7",
            snippet: "Refresh tokens are single-use. On every refresh, the server issues a new refresh token and revokes the prior one...",
          },
        ],
      },
      {
        text: "Tokens are signed using EdDSA, replacing the legacy HS256 scheme.",
        support: "supported",
        evidence: [
          {
            fileId: "f_auth_v2",
            fileName: "auth-spec-v2.pdf",
            chunkId: "ch_12",
            snippet: "Access tokens use EdDSA (Ed25519). HS256 is deprecated as of v2...",
          },
        ],
      },
      {
        text: "Sessions are stored in Redis with a 7-day hard cap regardless of activity.",
        support: "unsupported",
      },
    ],
    citations: [
      { n: 1, fileId: "f_auth_v2", fileName: "auth-spec-v2.pdf", chunkId: "ch_3", snippet: "All authenticated sessions expire 24 hours after issuance..." },
      { n: 2, fileId: "f_auth_v2", fileName: "auth-spec-v2.pdf", chunkId: "ch_7", snippet: "Refresh tokens are single-use..." },
      { n: 3, fileId: "f_auth_v2", fileName: "auth-spec-v2.pdf", chunkId: "ch_12", snippet: "Access tokens use EdDSA (Ed25519)..." },
    ],
    trace: [
      { node: "retrieve", ms: 84, meta: "8 hits" },
      { node: "grade_relevance", ms: 220, meta: "score 0.42 — weak" },
      { node: "rewrite_query", ms: 310, meta: "expanded with: rotation, refresh, expiry" },
      { node: "retrieve", ms: 71, meta: "5 hits" },
      { node: "grade_relevance", ms: 190, meta: "score 0.86 — ok" },
      { node: "generate", ms: 1840, meta: "402 tokens" },
      { node: "decompose_claims", ms: 410, meta: "4 atomic claims" },
      { node: "verify_claims", ms: 720, meta: "3 supported, 1 unsupported" },
    ],
    langsmithUrl: "https://smith.langchain.com/o/diploy-docs/r/example-trace",
  },
];
