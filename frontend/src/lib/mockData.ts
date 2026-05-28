import type { Chunk, Claim, Conflict, FileDoc } from "./types";

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
    chunkCount: 3,
    claimCount: 4,
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
        heading: "Signing algorithm",
        paragraphs: [
          "Access tokens use EdDSA with Ed25519. HS256 is deprecated as of v2; services still validating HS256-signed tokens must migrate by end of Q3.",
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
      "Baseline security guidelines for engineering: session timeout, password rotation, and secret storage in Vault.",
    topic: "Security",
    chunkCount: 3,
    claimCount: 4,
    body: [
      {
        heading: "4.2 Session policy",
        paragraphs: [
          "All user sessions must expire after 1 hour of inactivity. Privileged sessions expire after 15 minutes of inactivity and cannot be extended via refresh.",
        ],
      },
      {
        heading: "5.1 Secrets",
        paragraphs: [
          "All secrets, including API keys, database credentials, and signing keys, live in Vault.",
        ],
      },
    ],
  },
];

export const mockClaims: Record<string, Claim[]> = {
  f_auth_v2: [
    { id: "c1", fileId: "f_auth_v2", chunkId: "ch_0", text: "Sessions expire after 24 hours with sliding refresh." },
    { id: "c2", fileId: "f_auth_v2", chunkId: "ch_1", text: "Access tokens use EdDSA with Ed25519." },
  ],
  f_sec_guidelines: [
    { id: "sg_c1", fileId: "f_sec_guidelines", chunkId: "ch_0", text: "All user sessions must expire after 1 hour of inactivity." },
    { id: "sg_c2", fileId: "f_sec_guidelines", chunkId: "ch_1", text: "All secrets must be stored in Vault." },
  ],
};

export const mockChunks: Record<string, Chunk[]> = {
  f_auth_v2: [
    { id: "ch_0", fileId: "f_auth_v2", index: 0, tokens: 62, text: "All authenticated sessions expire 24 hours after issuance. Sliding refresh extends the window by 24 hours on each successful refresh." },
    { id: "ch_1", fileId: "f_auth_v2", index: 1, tokens: 40, text: "Access tokens use EdDSA with Ed25519. HS256 is deprecated as of v2." },
  ],
  f_sec_guidelines: [
    { id: "ch_0", fileId: "f_sec_guidelines", index: 0, tokens: 42, text: "All user sessions must expire after 1 hour of inactivity. Privileged sessions expire after 15 minutes." },
    { id: "ch_1", fileId: "f_sec_guidelines", index: 1, tokens: 24, text: "All secrets, including API keys, database credentials, and signing keys, live in Vault." },
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
      chunkSnippet: "All user sessions must expire after 1 hour of inactivity...",
    },
  },
];
