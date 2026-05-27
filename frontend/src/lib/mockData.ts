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
  },
];

export const mockClaims: Record<string, Claim[]> = {
  f_auth_v2: [
    { id: "c1", fileId: "f_auth_v2", chunkId: "ch_3", text: "Sessions expire after 24 hours with sliding refresh." },
    { id: "c2", fileId: "f_auth_v2", chunkId: "ch_7", text: "Refresh tokens rotate on every use; reuse triggers session revocation." },
    { id: "c3", fileId: "f_auth_v2", chunkId: "ch_12", text: "Access tokens are signed with EdDSA, not HS256." },
    { id: "c4", fileId: "f_auth_v2", chunkId: "ch_18", text: "Token introspection is rate-limited to 200 req/s per service." },
  ],
};

export const mockChunks: Record<string, Chunk[]> = {
  f_auth_v2: [
    { id: "ch_3", fileId: "f_auth_v2", index: 3, tokens: 184, text: "All authenticated sessions expire 24 hours after issuance. Sliding refresh extends the window by 24 hours on each successful refresh, capped at 30 days of continuous activity..." },
    { id: "ch_7", fileId: "f_auth_v2", index: 7, tokens: 211, text: "Refresh tokens are single-use. On every refresh, the server issues a new refresh token and revokes the prior one. If a previously rotated token is presented, the full session family is revoked..." },
    { id: "ch_12", fileId: "f_auth_v2", index: 12, tokens: 165, text: "Access tokens use EdDSA (Ed25519). HS256 is deprecated as of v2 — services still validating HS256-signed tokens MUST migrate by end of Q3..." },
    { id: "ch_18", fileId: "f_auth_v2", index: 18, tokens: 142, text: "Token introspection (POST /oauth/introspect) is rate-limited to 200 requests per second per service identity. Bursts above this threshold receive 429 with a Retry-After header..." },
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
