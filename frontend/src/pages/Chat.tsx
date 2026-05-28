import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  MinusCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../lib/api";
import type { ChatMessage, ClaimSupport, VerifiedClaim } from "../lib/types";
import { cn } from "../lib/utils";
import { Logo } from "../components/Logo";

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"quick" | "research">("quick");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    setMessages((m) => [...m, { id: `u_${Date.now()}`, role: "user", content: text }]);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const trace: NonNullable<ChatMessage["trace"]> = [];
      const answer = await api.chat(text, mode, (event) => trace.push(event));
      setMessages((m) => [...m, { ...answer, trace: answer.trace ?? trace }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to get an answer");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="px-6 pt-5 pb-3 border-b border-ink-200">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tightish text-ink-900">Ask Diploy Docs</h1>
            <p className="text-xs text-ink-500 mt-0.5">
              Self-correcting retrieval - per-claim citation verification - LangSmith traced
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="chip-brand"><span className="font-mono">All files</span></span>
            <ModeToggle mode={mode} setMode={setMode} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} m={m} /> : <AssistantBubble key={m.id} m={m} />))}
          {pending && <PendingBubble />}
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
          <ClaimLegend />
        </div>
      </div>

      <div className="border-t border-ink-200 bg-white px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <form
            onSubmit={submit}
            className="flex items-center gap-2 rounded-lg border border-ink-200 focus-within:border-brand-600 focus-within:ring-1 focus-within:ring-brand-600 bg-white px-3 py-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question - try 'how long do auth sessions last?'"
              className="flex-1 bg-transparent text-sm placeholder:text-ink-400 outline-none"
              disabled={pending}
            />
            <button type="submit" className="btn-brand btn-sm" disabled={pending || !input.trim()}>
              <Send size={12} /> Send
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-2xs text-ink-500 font-mono">
            <span>Press <span className="kbd">Enter</span> to send</span>
            <span>Powered by LangGraph + Gemini Flash</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PendingBubble() {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-md overflow-hidden grid place-items-center shrink-0">
        <Logo size={28} className="rounded-md" />
      </div>
      <div className="card p-4 flex items-center gap-2 text-xs text-ink-500">
        <span className="inline-flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-pulse-soft" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-pulse-soft" style={{ animationDelay: "0.15s" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-pulse-soft" style={{ animationDelay: "0.3s" }} />
        </span>
        Retrieving and verifying...
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: "quick" | "research";
  setMode: (mode: "quick" | "research") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-white">
      {(["quick", "research"] as const).map(m => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            "h-7 px-2.5 rounded text-2xs font-medium capitalize transition-colors",
            mode === m ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
          )}
        >{m}</button>
      ))}
    </div>
  );
}

function UserBubble({ m }: { m: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-ink-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed">
        {m.content}
      </div>
    </div>
  );
}

function AssistantBubble({ m }: { m: ChatMessage }) {
  const [showTrace, setShowTrace] = useState(false);
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-md overflow-hidden grid place-items-center shrink-0">
        <Logo size={28} className="rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="card p-4 leading-relaxed">
          <p className="text-sm text-ink-800">
            {m.verified?.length ? (
              <VerifiedAnswer claims={m.verified} citations={m.citations ?? []} />
            ) : (
              m.content
            )}
          </p>

          {m.citations && m.citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-ink-100">
              <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold mb-1.5">Citations</div>
              <ol className="space-y-1">
                {m.citations.map(c => (
                  <li key={c.n} className="text-xs text-ink-700 flex gap-2">
                    <span className="font-mono text-ink-400 shrink-0">[{c.n}]</span>
                    <Link to={`/files/${c.fileId}`} className="text-brand-700 hover:underline font-medium truncate">{c.fileName}</Link>
                    <span className="text-ink-400 truncate hidden sm:inline">- {c.snippet}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-3 text-2xs">
          <button
            onClick={() => setShowTrace(s => !s)}
            className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900 font-medium"
          >
            <Sparkles size={11} className="text-brand-600" />
            Show reasoning
            <ChevronDown size={11} className={cn("transition-transform", showTrace && "rotate-180")} />
          </button>
          {m.langsmithUrl && (
            <a href={m.langsmithUrl} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900 font-medium">
              View trace in LangSmith <ExternalLink size={10} />
            </a>
          )}
        </div>

        {showTrace && m.trace && (
          <div className="mt-2 card p-3 bg-ink-50/60">
            <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold mb-2">LangGraph execution</div>
            <ol className="space-y-1">
              {m.trace.map((t, i) => (
                <li key={i} className="text-2xs font-mono text-ink-700 flex items-center gap-2">
                  <span className="text-ink-400 w-4 text-right">{i + 1}</span>
                  <span className="text-brand-700 font-semibold min-w-[120px]">{t.node}</span>
                  <span className="text-ink-500 min-w-[60px] text-right tabular-nums">{t.ms}ms</span>
                  {t.meta && <span className="text-ink-500 truncate">- {t.meta}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function VerifiedAnswer({ claims, citations }: { claims: VerifiedClaim[]; citations: ChatMessage["citations"] }) {
  return (
    <>
      {claims.map((c, i) => (
        <ClaimSpan key={i} claim={c} citationsByFile={citations} />
      ))}
    </>
  );
}

function ClaimSpan({ claim, citationsByFile }: { claim: VerifiedClaim; citationsByFile: ChatMessage["citations"] }) {
  const map: Record<ClaimSupport, { underline: string; tag: string; tagBg: string; Icon: typeof ShieldCheck; label: string }> = {
    supported:   { underline: "decoration-emerald-400/80 hover:decoration-emerald-600",  tag: "text-emerald-700", tagBg: "bg-emerald-50 border-emerald-200", Icon: ShieldCheck,   label: "Supported" },
    weak:        { underline: "decoration-amber-400/80 hover:decoration-amber-600",      tag: "text-amber-700",   tagBg: "bg-amber-50 border-amber-200",     Icon: AlertTriangle, label: "Weakly supported" },
    unsupported: { underline: "decoration-red-400/80 hover:decoration-red-600",          tag: "text-red-700",     tagBg: "bg-red-50 border-red-200",         Icon: MinusCircle,   label: "Unsupported" },
  };
  const s = map[claim.support];
  const ev = claim.evidence?.[0];
  const cite = ev ? citationsByFile?.find(c => c.fileId === ev.fileId && c.chunkId === ev.chunkId) : undefined;

  return (
    <span className="relative group inline">
      <span className={cn("underline decoration-2 underline-offset-[3px] transition-colors cursor-help", s.underline)}>
        {claim.text}
      </span>
      {cite && <sup className="text-2xs font-mono text-brand-700 ml-0.5">[{cite.n}]</sup>}{" "}
      <span className="hidden group-hover:block absolute left-0 top-full mt-1 z-20 w-[420px] max-w-[90vw]
                       rounded-md border border-ink-200 bg-white shadow-soft p-3 text-xs leading-relaxed">
        <span className={cn("inline-flex items-center gap-1 border rounded px-1.5 h-5 text-2xs font-medium mb-2", s.tagBg, s.tag)}>
          <s.Icon size={10} /> {s.label}
        </span>
        {ev ? (
          <>
            <div className="text-2xs font-mono text-ink-500 mb-1">{ev.fileName} - chunk {ev.chunkId}</div>
            <div className="text-ink-700">{ev.snippet}</div>
          </>
        ) : (
          <div className="text-red-700">No retrieved chunk supports this claim. Treat with caution.</div>
        )}
      </span>
    </span>
  );
}

function ClaimLegend() {
  return (
    <div className="flex items-center gap-3 text-2xs font-medium text-ink-500 pt-2">
      <span className="text-ink-400 uppercase tracking-wider font-semibold">Claim verification</span>
      <Legend color="emerald" label="Supported" />
      <Legend color="amber" label="Weak" />
      <Legend color="red" label="Unsupported" />
    </div>
  );
}

function Legend({ color, label }: { color: "emerald" | "amber" | "red"; label: string }) {
  const colors = {
    emerald: "decoration-emerald-400/80 text-emerald-700",
    amber:   "decoration-amber-400/80 text-amber-700",
    red:     "decoration-red-400/80 text-red-700",
  } as const;
  return (
    <span className={cn("underline decoration-2 underline-offset-[3px]", colors[color])}>{label}</span>
  );
}
