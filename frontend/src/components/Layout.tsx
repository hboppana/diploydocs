import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  LayoutGrid,
  MessageSquare,
  ScatterChart,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Stats } from "../lib/types";
import { cn } from "../lib/utils";
import { Logo } from "./Logo";

const nav = [
  { to: "/", label: "Library", icon: LayoutGrid },
  { to: "/chat", label: "Ask", icon: MessageSquare },
  { to: "/conflicts", label: "Conflicts", icon: AlertTriangle },
  { to: "/embeddings", label: "Embeddings", icon: ScatterChart },
];

export function Layout() {
  const { pathname } = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);
  const pendingConflicts = stats?.pendingConflicts ?? 0;
  const pageTitle =
    pathname === "/" ? "Library" :
    pathname.startsWith("/files") ? "File" :
    pathname === "/chat" ? "Ask" :
    pathname === "/conflicts" ? "Conflicts" :
    pathname === "/embeddings" ? "Embeddings" : "";

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-60 shrink-0 border-r border-ink-200 bg-ink-50/40 flex flex-col">
        <div className="px-4 h-14 flex items-center gap-2 border-b border-ink-200">
          <div className="w-7 h-7 rounded-md overflow-hidden grid place-items-center">
            <Logo size={28} className="rounded-md" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-900 tracking-tightish">Diploy Docs</div>
            <div className="text-2xs text-ink-500 font-medium">Internal knowledge</div>
          </div>
        </div>

        <nav className="px-2 py-3 flex flex-col gap-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn("nav-link", isActive && "nav-link-active")
              }
            >
              <item.icon size={16} className="text-ink-500" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/conflicts" && pendingConflicts > 0 && (
                <span className="text-2xs font-mono font-semibold text-support-amber bg-amber-50 border border-amber-200 rounded px-1.5 h-4 inline-flex items-center">
                  {pendingConflicts}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 mt-1">
          <div className="text-2xs uppercase tracking-wider text-ink-400 font-semibold px-2.5 mb-1.5">
            Status
          </div>
          <div className="px-2.5 py-2 rounded-md text-xs text-ink-600 bg-white border border-ink-200">
            <div className="flex items-center gap-1.5 text-ink-900 font-medium mb-1">
              <Activity size={12} className="text-support-green" />
              All systems online
            </div>
            <div className="font-mono text-2xs text-ink-500 leading-relaxed">
              <div>Chroma - HNSW - {stats?.files ?? 0} files</div>
              <div>{stats?.chunks ?? 0} chunks - {stats?.claims ?? 0} claims</div>
            </div>
          </div>
        </div>

        <div className="mt-auto p-3">
          <div className="rounded-md border border-ink-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-ink-900 text-xs font-semibold mb-1">
              <Sparkles size={12} className="text-brand-600" />
              Powered by LangGraph
            </div>
            <p className="text-2xs text-ink-500 leading-relaxed">
              Self-correcting retrieval, ingest agents, claim verification.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-ink-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 flex items-center px-6 gap-4">
          <div className="text-sm font-semibold text-ink-900 tracking-tightish">{pageTitle}</div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className="input pl-8 w-72 h-8 text-xs"
                placeholder="Search files, claims, chunks..."
              />
              <span className="kbd absolute right-2 top-1/2 -translate-y-1/2">K</span>
            </div>
            <button className="btn-ghost btn-sm">Settings</button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 grid place-items-center text-white text-xs font-semibold">
              HB
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
