import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, RotateCw, Trash2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { mockChunks, mockClaims, mockFiles } from "../lib/mockData";
import { FileTypeIcon } from "../components/FileTypeIcon";
import { StatusBadge } from "../components/StatusBadge";
import { formatBytes, timeAgo, cn } from "../lib/utils";

export function FileDetailPage() {
  const { id = "" } = useParams();
  const file = mockFiles.find(f => f.id === id) ?? mockFiles[0];
  const claims = mockClaims[file.id] ?? [];
  const chunks = mockChunks[file.id] ?? [];
  const [openChunks, setOpenChunks] = useState<Record<string, boolean>>({ ch_3: true });

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 text-xs text-ink-500 mb-4">
        <Link to="/" className="hover:text-ink-900 inline-flex items-center gap-1">
          <ArrowLeft size={12} /> Library
        </Link>
        <span className="text-ink-300">/</span>
        <span className="font-mono text-ink-700">{file.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <FileTypeIcon type={file.type} size={18} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tighter2 text-ink-900 truncate">{file.name}</h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <StatusBadge status={file.status} />
              {file.topic && <span className="chip">{file.topic}</span>}
              <span className="text-2xs font-mono text-ink-500">
                {formatBytes(file.sizeBytes)} · uploaded {timeAgo(file.uploadedAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="btn-ghost btn-sm">
            <RotateCw size={12} /> Re-index
          </button>
          <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50 hover:border-red-200">
            <Trash2 size={12} /> Delete
          </button>
          <Link to="/chat" className="btn-primary">
            <MessageSquare size={14} /> Ask about this file
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="card p-6 min-h-[480px]">
          <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold mb-3">
            Document
          </div>
          <article className="prose prose-sm max-w-none text-ink-800 leading-relaxed space-y-3">
            <h2 className="text-lg font-semibold text-ink-900 tracking-tightish">
              {file.name.replace(/\.(pdf|md|txt|docx)$/, "")}
            </h2>
            {file.body ? (
              file.body.map((section, i) => (
                <div key={i}>
                  {section.heading && (
                    <h3 className="font-semibold text-ink-900 mt-4">{section.heading}</h3>
                  )}
                  {section.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              ))
            ) : (
              <p className="text-ink-400 italic">Document body not yet extracted.</p>
            )}
          </article>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold mb-3">
              Metadata
            </div>
            <dl className="text-xs space-y-1.5">
              <Row k="Type" v={file.type.toUpperCase()} mono />
              <Row k="Size" v={formatBytes(file.sizeBytes)} mono />
              <Row k="Uploaded" v={timeAgo(file.uploadedAt)} />
              <Row k="Chunks" v={String(file.chunkCount)} mono />
              <Row k="Claims" v={String(file.claimCount)} mono />
              <Row k="Embedding" v="MiniLM-L6-v2" mono />
            </dl>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold">
                Extracted claims
              </div>
              <span className="text-2xs font-mono text-ink-500">{claims.length}</span>
            </div>
            <ul className="space-y-2">
              {claims.map((c, i) => (
                <li key={c.id} className="text-xs text-ink-800 leading-relaxed">
                  <div className="flex gap-2">
                    <span className="text-2xs font-mono text-ink-400 shrink-0 pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1">{c.text}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 pt-3 border-t border-ink-100 text-2xs text-ink-500">
              Extracted by enrichment agent · LangGraph
            </p>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold">
                Chunks
              </div>
              <span className="text-2xs font-mono text-ink-500">{chunks.length}</span>
            </div>
            <ul className="space-y-1.5">
              {chunks.map((ch) => (
                <li key={ch.id}>
                  <button
                    onClick={() => setOpenChunks(s => ({ ...s, [ch.id]: !s[ch.id] }))}
                    className="w-full text-left rounded-md border border-ink-200 hover:border-ink-300 bg-white px-2.5 py-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-mono text-ink-600">chunk #{ch.index}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs font-mono text-ink-400">{ch.tokens} tok</span>
                        <ChevronDown size={11} className={cn("text-ink-400 transition-transform", openChunks[ch.id] && "rotate-180")} />
                      </div>
                    </div>
                    {openChunks[ch.id] && (
                      <p className="mt-1.5 text-xs text-ink-700 leading-relaxed">{ch.text}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-500">{k}</dt>
      <dd className={cn("text-ink-900", mono && "font-mono")}>{v}</dd>
    </div>
  );
}
