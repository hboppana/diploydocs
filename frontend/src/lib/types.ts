export type IndexStatus =
  | "pending"
  | "extracting"
  | "enriching"
  | "embedding"
  | "indexed"
  | "failed";

export interface BodySection {
  heading?: string;
  paragraphs: string[];
}

export interface FileDoc {
  id: string;
  name: string;
  type: "pdf" | "md" | "txt" | "docx";
  sizeBytes: number;
  uploadedAt: string;
  status: IndexStatus;
  summary?: string;
  topic?: string;
  chunkCount: number;
  claimCount: number;
  body?: BodySection[];
}

export interface Claim {
  id: string;
  fileId: string;
  chunkId: string;
  text: string;
}

export interface Chunk {
  id: string;
  fileId: string;
  index: number;
  text: string;
  tokens: number;
}

export type ClaimSupport = "supported" | "weak" | "unsupported";

export interface VerifiedClaim {
  text: string;
  support: ClaimSupport;
  evidence?: { chunkId: string; fileId: string; fileName: string; snippet: string }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  verified?: VerifiedClaim[];
  citations?: { n: number; fileId: string; fileName: string; chunkId: string; snippet: string }[];
  trace?: { node: string; ms: number; meta?: string }[];
  langsmithUrl?: string;
}

export interface Conflict {
  id: string;
  detectedAt: string;
  status: "pending" | "resolved";
  claimA: { fileId: string; fileName: string; text: string; chunkSnippet: string };
  claimB: { fileId: string; fileName: string; text: string; chunkSnippet: string };
  resolution?: "a-authoritative" | "b-authoritative" | "context-dependent";
}
