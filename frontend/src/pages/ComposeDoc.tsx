import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { bodyToMarkdown } from "../lib/utils";

const SAMPLE = `# Overview

Write your documentation in Markdown. Use # headings to break it into sections —
each section is chunked, summarized, and checked for conflicts against your other docs.

## Details

State facts plainly. The ingest agents extract atomic claims from each paragraph,
so clear, self-contained sentences index best.`;

const stripExt = (name: string) => name.replace(/\.(pdf|md|markdown|txt|docx)$/i, "");

export function ComposeDocPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .file(id)
      .then((f) => {
        setTitle(stripExt(f.name));
        setContent(bodyToMarkdown(f.body));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load file"))
      .finally(() => setLoading(false));
  }, [id]);

  const canSave = title.trim() !== "" && content.trim() !== "" && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const result = isEdit
        ? await api.updateFile(id!, title.trim(), content)
        : await api.createDoc(title.trim(), content);
      navigate(`/files/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the document");
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="px-6 py-8 text-sm text-ink-500">Loading document...</div>;
  }

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <Link
        to={isEdit ? `/files/${id}` : "/"}
        className="text-xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} /> {isEdit ? "Back to file" : "Library"}
      </Link>

      <div className="flex items-start justify-between gap-4 mt-4 mb-5">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-md bg-brand-100 grid place-items-center shrink-0">
            <FileText size={16} className="text-brand-700" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tighter2 text-ink-900">
              {isEdit ? "Edit document" : "New document"}
            </h1>
            <p className="text-sm text-ink-500 mt-0.5">
              {isEdit
                ? "Saving re-indexes the document and re-checks it for conflicts."
                : "Author docs in Markdown — they're indexed the moment you save."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to={isEdit ? `/files/${id}` : "/"} className="btn-ghost btn-sm">Cancel</Link>
          <button className="btn-primary" onClick={save} disabled={!canSave}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {saving ? "Indexing..." : isEdit ? "Save & re-index" : "Save & index"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Document title"
        className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-base font-medium
          text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
      />

      <div className="mt-3 flex items-center justify-between">
        <span className="text-2xs uppercase tracking-wider text-ink-400 font-semibold">Content (Markdown)</span>
        {content.trim() === "" && (
          <button
            onClick={() => setContent(SAMPLE)}
            className="text-2xs text-brand-600 hover:text-brand-700"
          >
            Insert example
          </button>
        )}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="# Section heading&#10;&#10;Your documentation..."
        rows={20}
        className="mt-1.5 w-full rounded-md border border-ink-200 bg-white px-3 py-2.5 text-sm
          font-mono leading-relaxed text-ink-800 placeholder:text-ink-400 focus:border-brand-500
          focus:outline-none resize-y"
      />
      <p className="mt-2 text-2xs text-ink-500">
        Tip: <span className="font-mono">#</span> and <span className="font-mono">##</span> headings split the doc into sections.
      </p>
    </div>
  );
}
