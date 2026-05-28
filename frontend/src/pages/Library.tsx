import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, Sparkles, Plus, Filter, ArrowUpRight } from "lucide-react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { FileTypeIcon } from "../components/FileTypeIcon";
import { formatBytes, timeAgo } from "../lib/utils";
import type { FileDoc, Stats } from "../lib/types";

export function LibraryPage() {
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.files(), api.stats()])
      .then(([nextFiles, nextStats]) => {
        setFiles(nextFiles);
        setStats(nextStats);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load library"));
  }, []);

  const indexedCount = stats?.indexed ?? files.filter(f => f.status === "indexed").length;
  const inFlight = stats?.processing ?? files.filter(f => f.status !== "indexed" && f.status !== "failed").length;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter2 text-ink-900">Library</h1>
          <p className="text-sm text-ink-500 mt-1 max-w-xl">
            Every file is indexed the moment it's uploaded - agents extract summaries, claims, and check for contradictions in the background.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm">
            <Filter size={13} /> Filter
          </button>
          <button className="btn-primary">
            <Upload size={14} /> Upload
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-5 text-xs text-ink-500 font-medium">
        <Stat label="Files" value={stats?.files ?? files.length} />
        <Divider />
        <Stat label="Indexed" value={indexedCount} accent="green" />
        <Divider />
        <Stat label="Processing" value={inFlight} accent="brand" />
        <Divider />
        <Stat label="Total chunks" value={stats?.chunks ?? files.reduce((sum, f) => sum + f.chunkCount, 0)} />
        <Divider />
        <Stat label="Claims extracted" value={stats?.claims ?? files.reduce((sum, f) => sum + f.claimCount, 0)} />
      </div>

      <div className="mt-6 mb-3 flex items-center gap-2">
        <Sparkles size={14} className="text-brand-600" />
        <span className="text-xs text-ink-600 font-medium">
          {inFlight} files currently in pipeline - live updates via polling
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <NewUploadCard />
        {files.map((f) => (
          <Link to={`/files/${f.id}`} key={f.id} className="card-hover p-4 group block">
            <div className="flex items-start gap-3">
              <FileTypeIcon type={f.type} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-ink-900 truncate tracking-tightish">
                    {f.name}
                  </div>
                  <ArrowUpRight size={14} className="text-ink-300 group-hover:text-ink-700 transition-colors shrink-0 mt-0.5" />
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-500 font-mono">
                  <span>{formatBytes(f.sizeBytes)}</span>
                  <span>-</span>
                  <span>{timeAgo(f.uploadedAt)}</span>
                </div>
              </div>
            </div>

            <p className="mt-3 text-sm text-ink-700 leading-relaxed line-clamp-2 text-balance">
              {f.summary ?? <span className="text-ink-400 italic">Summary pending...</span>}
            </p>

            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={f.status} />
              {f.topic && <span className="chip">{f.topic}</span>}
            </div>

            <div className="mt-3 pt-3 border-t border-ink-100 flex items-center justify-between text-2xs font-mono text-ink-500">
              <span>{f.chunkCount} chunks</span>
              <span>{f.claimCount} claims</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewUploadCard() {
  return (
    <button className="card border-dashed border-ink-300 hover:border-brand-600 hover:bg-brand-50/40
      p-4 flex flex-col items-center justify-center text-center min-h-[180px] transition-colors group">
      <span className="w-9 h-9 rounded-full bg-ink-100 group-hover:bg-brand-100 grid place-items-center transition-colors">
        <Plus size={16} className="text-ink-600 group-hover:text-brand-700" />
      </span>
      <div className="mt-2 text-sm font-medium text-ink-900">Upload a document</div>
      <div className="text-2xs text-ink-500 mt-0.5 font-mono">PDF - MD - TXT - DOCX</div>
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "green" | "brand" }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={
        accent === "green" ? "text-support-green font-mono font-semibold tabular-nums" :
        accent === "brand" ? "text-brand-700 font-mono font-semibold tabular-nums" :
        "text-ink-900 font-mono font-semibold tabular-nums"
      }>{value}</span>
      <span className="text-ink-500">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-ink-300">-</span>;
}
