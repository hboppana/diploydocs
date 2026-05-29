import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Sparkles, Spline } from "lucide-react";
import { api } from "../lib/api";
import type { Conflict, Projection, ProjectionPoint } from "../lib/types";
import { cn } from "../lib/utils";

// Distinct, readable palette assigned per file.
const PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const VB = 100; // SVG viewBox size
const PAD = 7;

export function EmbeddingMapPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"chunks" | "claims">("chunks");
  const [data, setData] = useState<Projection | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showLinks, setShowLinks] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ProjectionPoint | null>(null);

  function load(next: "chunks" | "claims") {
    setLoading(true);
    setError(null);
    // Conflict links are claim-to-claim, so only fetch them for the claims view.
    const conflictReq = next === "claims" ? api.conflicts() : Promise.resolve<Conflict[]>([]);
    Promise.all([api.embeddingProjection(next), conflictReq])
      .then(([proj, cfs]) => { setData(proj); setConflicts(cfs); })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load projection"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(kind); }, [kind]);

  // Build a stable color map + per-file counts.
  const files = useMemo(() => {
    const map = new Map<string, { fileId: string; fileName: string; count: number; color: string }>();
    data?.points.forEach((p) => {
      const cur = map.get(p.fileId);
      if (cur) cur.count += 1;
      else map.set(p.fileId, { fileId: p.fileId, fileName: p.fileName, count: 1, color: "" });
    });
    const list = [...map.values()].sort((a, b) => a.fileName.localeCompare(b.fileName));
    list.forEach((f, i) => (f.color = PALETTE[i % PALETTE.length]));
    return list;
  }, [data]);

  const colorOf = useMemo(() => {
    const m = new Map(files.map((f) => [f.fileId, f.color]));
    return (fileId: string) => m.get(fileId) ?? "#94a3b8";
  }, [files]);

  // Normalize raw PCA coords into the padded viewBox.
  const placed = useMemo(() => {
    const pts = data?.points ?? [];
    if (!pts.length) return [];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (VB - 2 * PAD);
    const sy = (y: number) => PAD + ((maxY - y) / (maxY - minY || 1)) * (VB - 2 * PAD); // flip Y
    return pts.map((p) => ({ p, cx: sx(p.x), cy: sy(p.y) }));
  }, [data]);

  // Conflict edges: match each conflict's two claim IDs to placed claim points.
  const edges = useMemo(() => {
    if (kind !== "claims" || !showLinks) return [];
    const at = new Map(placed.map((pt) => [pt.p.id, pt]));
    const out: { id: string; x1: number; y1: number; x2: number; y2: number; aId: string; bId: string }[] = [];
    for (const cf of conflicts) {
      const a = at.get(cf.claimA.claimId);
      const b = at.get(cf.claimB.claimId);
      if (a && b) out.push({ id: cf.id, x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, aId: a.p.id, bId: b.p.id });
    }
    return out;
  }, [kind, showLinks, placed, conflicts]);

  const variance = data ? Math.round((data.varianceExplained[0] + data.varianceExplained[1]) * 100) : 0;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter2 text-ink-900">Embedding map</h1>
          <p className="text-sm text-ink-500 mt-1 max-w-2xl">
            Every {kind === "chunks" ? "chunk" : "claim"} embedded with MiniLM-L6-v2 (384-dim),
            projected to 2D with PCA. Points that sit close together are semantically similar —
            that proximity is exactly what retrieval and conflict detection run on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-ink-200 overflow-hidden text-xs">
            {(["chunks", "claims"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "px-3 py-1.5 capitalize transition-colors",
                  kind === k ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50",
                )}
              >
                {k}
              </button>
            ))}
          </div>
          {kind === "claims" && (
            <button
              className={cn("btn-ghost btn-sm", showLinks && "border-brand-400 text-brand-700")}
              onClick={() => setShowLinks((v) => !v)}
            >
              <Spline size={13} /> Conflict links
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={() => load(kind)} disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-ink-500 font-medium">
        <span><span className="font-mono font-semibold text-ink-900 tabular-nums">{data?.count ?? 0}</span> points</span>
        <span className="text-ink-300">·</span>
        <span><span className="font-mono font-semibold text-ink-900 tabular-nums">{files.length}</span> files</span>
        <span className="text-ink-300">·</span>
        <span className="inline-flex items-center gap-1">
          <Sparkles size={12} className="text-brand-600" />
          {variance}% variance captured by these 2 axes
        </span>
        {kind === "claims" && showLinks && (
          <>
            <span className="text-ink-300">·</span>
            <span className="inline-flex items-center gap-1 text-red-600">
              <Spline size={12} />
              {edges.length} conflict links
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
        <div className="card p-3 relative">
          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-white/60 z-10">
              <Loader2 size={20} className="animate-spin text-brand-600" />
            </div>
          )}
          {!loading && placed.length === 0 ? (
            <div className="h-[520px] grid place-items-center text-sm text-ink-400">
              No embeddings yet — index some documents first.
            </div>
          ) : (
            <svg viewBox={`0 0 ${VB} ${VB}`} className="w-full h-[520px]" role="img" aria-label="Embedding scatter plot">
              <rect x={0} y={0} width={VB} height={VB} fill="#fafafa" rx={2} />
              {edges.map((e) => {
                const touched = hovered != null && (hovered.id === e.aId || hovered.id === e.bId);
                return (
                  <line
                    key={e.id}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke="#ef4444"
                    strokeWidth={touched ? 0.6 : 0.3}
                    strokeOpacity={hovered ? (touched ? 0.85 : 0.08) : 0.28}
                    className="transition-all"
                  />
                );
              })}
              {placed.map(({ p, cx, cy }) => {
                const active = hovered?.id === p.id;
                return (
                  <circle
                    key={p.id}
                    cx={cx}
                    cy={cy}
                    r={active ? 2.1 : 1.35}
                    fill={colorOf(p.fileId)}
                    fillOpacity={hovered && !active ? 0.35 : 0.85}
                    stroke={active ? "#0f172a" : "none"}
                    strokeWidth={active ? 0.5 : 0}
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHovered(p)}
                    onMouseLeave={() => setHovered((h) => (h?.id === p.id ? null : h))}
                    onClick={() => navigate(`/files/${p.fileId}`)}
                  >
                    <title>{`${p.fileName}\n${p.snippet}`}</title>
                  </circle>
                );
              })}
            </svg>
          )}
          {hovered && (
            <div className="absolute bottom-3 left-3 right-3 rounded-md border border-ink-200 bg-white/95 backdrop-blur px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-ink-900">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(hovered.fileId) }} />
                <span className="truncate">{hovered.fileName}</span>
              </div>
              <p className="mt-1 text-2xs text-ink-600 leading-relaxed line-clamp-2">{hovered.snippet}</p>
            </div>
          )}
        </div>

        <aside className="card p-4 h-fit">
          <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold mb-3">Files</div>
          <ul className="space-y-1.5">
            {files.map((f) => (
              <li key={f.fileId}>
                <button
                  onClick={() => navigate(`/files/${f.fileId}`)}
                  className="w-full flex items-center gap-2 text-left group"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
                  <span className="text-xs text-ink-700 group-hover:text-ink-900 truncate flex-1">{f.fileName}</span>
                  <span className="text-2xs font-mono text-ink-400 tabular-nums">{f.count}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 pt-3 border-t border-ink-100 text-2xs text-ink-500 leading-relaxed">
            Hover a point for its text; click to open its file.
            {kind === "claims"
              ? " Red lines connect contradictory claims — hover a point to isolate its conflicts."
              : " Switch to the claims view to see conflict links."}
          </p>
        </aside>
      </div>
    </div>
  );
}
