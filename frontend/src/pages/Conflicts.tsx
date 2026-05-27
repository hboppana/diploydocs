import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, GitMerge, FileText, ChevronDown } from "lucide-react";
import { mockConflicts } from "../lib/mockData";
import type { Conflict } from "../lib/types";
import { cn, timeAgo } from "../lib/utils";

export function ConflictsPage() {
  const pending = mockConflicts.filter(c => c.status === "pending");
  const resolved = mockConflicts.filter(c => c.status === "resolved");
  const [resolvedOpen, setResolvedOpen] = useState(false);

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tighter2 text-ink-900">Conflicts</h1>
          {pending.length > 0 && (
            <span className="text-2xs font-mono font-semibold text-support-amber bg-amber-50 border border-amber-200 rounded px-1.5 h-5 inline-flex items-center">
              {pending.length} pending
            </span>
          )}
        </div>
        <p className="text-sm text-ink-500 mt-1 max-w-2xl">
          When a new document is ingested, agents check its claims against the rest of your corpus. Contradictions surface here for review — pick one as authoritative, or mark both as context-dependent.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 border border-emerald-200 grid place-items-center">
            <CheckCircle2 size={18} className="text-support-green" />
          </div>
          <div className="mt-3 text-sm font-medium text-ink-900">No pending conflicts</div>
          <p className="text-xs text-ink-500 mt-1">Your corpus is internally consistent.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map(c => <ConflictCard key={c.id} c={c} />)}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setResolvedOpen(o => !o)}
            className="flex items-center gap-2 text-xs font-semibold text-ink-600 hover:text-ink-900"
          >
            <ChevronDown size={12} className={cn("transition-transform", resolvedOpen && "rotate-180")} />
            Resolved ({resolved.length})
          </button>
          {resolvedOpen && (
            <div className="mt-3 space-y-3 opacity-80">
              {resolved.map(c => <ConflictCard key={c.id} c={c} compact />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConflictCard({ c, compact }: { c: Conflict; compact?: boolean }) {
  return (
    <div className={cn("card", compact && "bg-ink-50/40")}>
      <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {c.status === "pending" ? (
            <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-support-amber bg-amber-50 border border-amber-200 rounded px-1.5 h-5">
              <AlertTriangle size={10} /> Possible contradiction
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-2xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 h-5">
              <CheckCircle2 size={10} /> Resolved
            </span>
          )}
          <span className="text-2xs font-mono text-ink-500">detected {timeAgo(c.detectedAt)}</span>
        </div>
        <div className="text-2xs font-mono text-ink-400">#{c.id}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-ink-100">
        <ClaimSide side="A" claim={c.claimA} authoritative={c.resolution === "a-authoritative"} />
        <ClaimSide side="B" claim={c.claimB} authoritative={c.resolution === "b-authoritative"} />
      </div>

      {c.status === "pending" && (
        <div className="px-4 py-3 border-t border-ink-100 flex flex-wrap items-center gap-2 justify-end bg-ink-50/40">
          <button className="btn-ghost btn-sm">Mark A authoritative</button>
          <button className="btn-ghost btn-sm">Mark B authoritative</button>
          <button className="btn-ghost btn-sm">
            <GitMerge size={12} /> Both valid (context-dependent)
          </button>
        </div>
      )}
    </div>
  );
}

function ClaimSide({ side, claim, authoritative }: { side: "A" | "B"; claim: Conflict["claimA"]; authoritative?: boolean }) {
  return (
    <div className={cn("p-4 relative", authoritative && "bg-emerald-50/40")}>
      <div className="flex items-center gap-2 mb-2">
        <span className={cn(
          "font-mono text-2xs font-bold w-5 h-5 rounded grid place-items-center",
          authoritative ? "bg-support-green text-white" : "bg-ink-900 text-white"
        )}>{side}</span>
        <Link to={`/files/${claim.fileId}`} className="text-xs font-medium text-ink-900 hover:text-brand-700 inline-flex items-center gap-1 truncate">
          <FileText size={11} className="text-ink-400" />
          {claim.fileName}
        </Link>
        {authoritative && <span className="chip border-emerald-200 bg-emerald-50 text-emerald-700">authoritative</span>}
      </div>
      <p className="text-sm text-ink-900 leading-relaxed font-medium">{claim.text}</p>
      <div className="mt-2 p-2 rounded border border-ink-100 bg-ink-50/60 text-2xs text-ink-600 leading-relaxed font-mono">
        {claim.chunkSnippet}
      </div>
    </div>
  );
}
