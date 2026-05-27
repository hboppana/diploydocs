import { FileText, FileType2, FileCode, FileType } from "lucide-react";
import type { FileDoc } from "../lib/types";

const map = {
  pdf:  { Icon: FileType,  color: "text-red-600",   bg: "bg-red-50",   border: "border-red-200" },
  md:   { Icon: FileCode,  color: "text-brand-700", bg: "bg-brand-50", border: "border-brand-200" },
  txt:  { Icon: FileText,  color: "text-ink-700",   bg: "bg-ink-100",  border: "border-ink-200" },
  docx: { Icon: FileType2, color: "text-blue-700",  bg: "bg-blue-50",  border: "border-blue-200" },
} as const;

export function FileTypeIcon({ type, size = 16 }: { type: FileDoc["type"]; size?: number }) {
  const c = map[type];
  return (
    <span className={`inline-grid place-items-center w-7 h-7 rounded-md border ${c.bg} ${c.border}`}>
      <c.Icon size={size} className={c.color} />
    </span>
  );
}
