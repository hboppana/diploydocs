import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Upload, Sparkles, Plus, Filter, ArrowUpRight, Loader2, Search, X, FilePlus2, PenLine } from "lucide-react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { FileTypeIcon } from "../components/FileTypeIcon";
import { formatBytes, timeAgo, cn } from "../lib/utils";
import type { FileDoc, Stats } from "../lib/types";

const ACCEPT = ".txt,.md,.markdown,.pdf";
const TERMINAL = new Set(["indexed", "failed"]);

export function LibraryPage() {
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "indexed" | "processing" | "failed">("all");
  const [showFilter, setShowFilter] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [nextFiles, nextStats] = await Promise.all([api.files(), api.stats()]);
    setFiles(nextFiles);
    setStats(nextStats);
  }, []);

  useEffect(() => {
    refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Unable to load library"),
    );
  }, [refresh]);

  // Poll while anything is still moving through the ingest pipeline.
  const anyProcessing = files.some((f) => !TERMINAL.has(f.status));
  useEffect(() => {
    if (!anyProcessing) return;
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, 1500);
    return () => clearInterval(id);
  }, [anyProcessing, refresh]);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(fileList)) {
          const created = await api.uploadFile(file);
          setFiles((prev) => [created, ...prev.filter((f) => f.id !== created.id)]);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [refresh],
  );

  const pickFiles = () => inputRef.current?.click();

  const indexedCount = stats?.indexed ?? files.filter(f => f.status === "indexed").length;
  const inFlight = stats?.processing ?? files.filter(f => f.status !== "indexed" && f.status !== "failed").length;

  const q = query.trim().toLowerCase();
  const matchesStatus = (f: FileDoc) =>
    statusFilter === "all" ||
    (statusFilter === "indexed" && f.status === "indexed") ||
    (statusFilter === "failed" && f.status === "failed") ||
    (statusFilter === "processing" && !TERMINAL.has(f.status));
  const filtered = files.filter(
    (f) =>
      matchesStatus(f) &&
      (!q ||
        f.name.toLowerCase().includes(q) ||
        (f.topic?.toLowerCase().includes(q) ?? false) ||
        (f.summary?.toLowerCase().includes(q) ?? false)),
  );
  const filtering = q !== "" || statusFilter !== "all";

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
          <button
            className={cn("btn-ghost btn-sm", (showFilter || filtering) && "border-brand-400 text-brand-700")}
            onClick={() => setShowFilter((v) => !v)}
          >
            <Filter size={13} /> Filter
          </button>
          <Link to="/new" className="btn-ghost btn-sm">
            <FilePlus2 size={13} /> New doc
          </Link>
          <button className="btn-primary" onClick={pickFiles} disabled={uploading}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {showFilter && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, topic, or summary..."
              className="w-full rounded-md border border-ink-200 bg-white pl-8 pr-3 py-1.5 text-sm
                text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "indexed", "processing", "failed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-2xs font-medium capitalize transition-colors",
                  statusFilter === s
                    ? "bg-brand-100 text-brand-700 border border-brand-300"
                    : "text-ink-500 border border-ink-200 hover:border-ink-300",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          {filtering && (
            <button
              onClick={() => { setQuery(""); setStatusFilter("all"); }}
              className="text-2xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

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

      {filtering && (
        <div className="mb-3 text-xs text-ink-500">
          {filtered.length} of {files.length} files match
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {!filtering && <NewUploadCard onClick={pickFiles} uploading={uploading} />}
        {!filtering && <WriteDocCard />}
        {filtered.map((f) => (
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

function NewUploadCard({ onClick, uploading }: { onClick: () => void; uploading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={uploading}
      className="card border-dashed border-ink-300 hover:border-brand-600 hover:bg-brand-50/40
      p-4 flex flex-col items-center justify-center text-center min-h-[180px] transition-colors group
      disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span className="w-9 h-9 rounded-full bg-ink-100 group-hover:bg-brand-100 grid place-items-center transition-colors">
        {uploading
          ? <Loader2 size={16} className="text-brand-700 animate-spin" />
          : <Plus size={16} className="text-ink-600 group-hover:text-brand-700" />}
      </span>
      <div className="mt-2 text-sm font-medium text-ink-900">
        {uploading ? "Uploading..." : "Upload a document"}
      </div>
      <div className="text-2xs text-ink-500 mt-0.5 font-mono">PDF - MD - TXT</div>
    </button>
  );
}

function WriteDocCard() {
  return (
    <Link
      to="/new"
      className="card border-dashed border-ink-300 hover:border-brand-600 hover:bg-brand-50/40
      p-4 flex flex-col items-center justify-center text-center min-h-[180px] transition-colors group"
    >
      <span className="w-9 h-9 rounded-full bg-ink-100 group-hover:bg-brand-100 grid place-items-center transition-colors">
        <PenLine size={16} className="text-ink-600 group-hover:text-brand-700" />
      </span>
      <div className="mt-2 text-sm font-medium text-ink-900">Write a document</div>
      <div className="text-2xs text-ink-500 mt-0.5 font-mono">Author in Markdown</div>
    </Link>
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
