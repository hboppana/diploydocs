import type { ChatMessage, Chunk, Claim, Conflict, FileDoc, Projection, Stats, TraceEvent } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  files: () => fetchJson<FileDoc[]>("/files"),
  file: (id: string) => fetchJson<FileDoc>(`/files/${id}`),
  chunks: (id: string) => fetchJson<Chunk[]>(`/files/${id}/chunks`),
  claims: (id: string) => fetchJson<Claim[]>(`/files/${id}/claims`),
  conflicts: () => fetchJson<Conflict[]>("/conflicts"),
  resolveConflict: (id: string, resolution: NonNullable<Conflict["resolution"]>) =>
    fetchJson<Conflict>(`/conflicts/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),
  stats: () => fetchJson<Stats>("/stats"),
  embeddingProjection: (kind: "chunks" | "claims" = "chunks") =>
    fetchJson<Projection>(`/embeddings/projection?kind=${kind}`),
  uploadFile: async (file: File): Promise<FileDoc> => {
    const form = new FormData();
    form.append("upload", file);
    const res = await fetch(`${API_BASE}/files`, { method: "POST", body: form });
    if (!res.ok) {
      let detail = await res.text();
      try {
        detail = JSON.parse(detail).detail ?? detail;
      } catch {
        /* keep raw text */
      }
      throw new Error(detail || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<FileDoc>;
  },
  createDoc: (title: string, content: string) =>
    fetchJson<FileDoc>("/files/compose", {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }),
  updateFile: (id: string, title: string, content: string) =>
    fetchJson<FileDoc>(`/files/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, content }),
    }),
  reindexFile: (id: string) => fetchJson<FileDoc>(`/files/${id}/reindex`, { method: "POST" }),
  deleteFile: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/files/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) throw new Error((await res.text()) || `Delete failed: ${res.status}`);
  },
  chat: (question: string, mode: "quick" | "research", onTrace?: (event: TraceEvent) => void) =>
    streamChat(question, mode, onTrace),
};

async function streamChat(
  question: string,
  mode: "quick" | "research",
  onTrace?: (event: TraceEvent) => void,
): Promise<ChatMessage> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, mode }),
  });
  if (!res.ok || !res.body) {
    throw new Error(await res.text() || `Chat failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: ChatMessage | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      const event = parseSseEvent(raw);
      if (!event) continue;
      if (event.type === "trace_event") onTrace?.(JSON.parse(event.data));
      if (event.type === "final") final = JSON.parse(event.data);
    }
  }

  if (final) return final;
  throw new Error("Chat stream ended without a final answer");
}

function parseSseEvent(raw: string): { type: string; data: string } | null {
  let type = "message";
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  return { type, data: data.join("\n") };
}
