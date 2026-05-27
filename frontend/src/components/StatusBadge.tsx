import { cn } from "../lib/utils";
import type { IndexStatus } from "../lib/types";

const cfg: Record<IndexStatus, { label: string; dot: string; text: string; bg: string; border: string; pulse?: boolean }> = {
  pending:    { label: "Pending",    dot: "bg-ink-400",        text: "text-ink-600",        bg: "bg-ink-50",       border: "border-ink-200" },
  extracting: { label: "Extracting", dot: "bg-brand-500",      text: "text-brand-700",      bg: "bg-brand-50",     border: "border-brand-200", pulse: true },
  enriching:  { label: "Enriching",  dot: "bg-brand-500",      text: "text-brand-700",      bg: "bg-brand-50",     border: "border-brand-200", pulse: true },
  embedding:  { label: "Embedding",  dot: "bg-brand-500",      text: "text-brand-700",      bg: "bg-brand-50",     border: "border-brand-200", pulse: true },
  indexed:    { label: "Indexed",    dot: "bg-support-green",  text: "text-emerald-700",    bg: "bg-emerald-50",   border: "border-emerald-200" },
  failed:     { label: "Failed",     dot: "bg-support-red",    text: "text-red-700",        bg: "bg-red-50",       border: "border-red-200" },
};

export function StatusBadge({ status }: { status: IndexStatus }) {
  const c = cfg[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 h-5 px-1.5 rounded text-2xs font-medium border",
      c.bg, c.border, c.text
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot, c.pulse && "animate-pulse-soft")} />
      {c.label}
    </span>
  );
}
