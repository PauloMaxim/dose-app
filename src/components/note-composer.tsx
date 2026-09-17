import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ARTICLES, getArticle } from "@/lib/content";
import { useInsightAi } from "@/lib/use-insight-ai";

export function NoteComposer({
  initialArticle,
  onClose,
  onSave,
}: {
  initialArticle?: string
  onClose?: () => void
  onSave: (articleId: string, text: string) => void
}) {
  const organize = useInsightAi();
  const [articleId, setArticleId] = useState(initialArticle ?? ARTICLES[0]!.id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(withAi: boolean) {
    const raw = text.trim();
    if (raw.length < 4) return;
    if (!withAi) {
      onSave(articleId, raw);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const title = getArticle(articleId)?.title ?? "";
      const res = await organize(raw, title);
      if (res.error) setErr(res.error);
      onSave(articleId, res.text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-2xl bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Nova nota</p>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X className="size-4 text-muted" />
          </button>
        ) : null}
      </div>
      <label className="text-[11px] uppercase tracking-wide text-muted">Artigo</label>
      <select
        value={articleId}
        onChange={(e) => setArticleId(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl bg-card-2 px-3 text-sm text-fg outline-none"
      >
        {ARTICLES.map((a) => (
          <option key={a.id} value={a.id}>
            {a.title}
          </option>
        ))}
      </select>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Frases suas. A reorganização só ordena — não responde."
        rows={5}
        className="mt-3 w-full resize-none rounded-xl bg-card-2 p-3 text-sm leading-relaxed text-fg outline-none placeholder:text-subtle"
      />
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <Button
        className="mt-3 w-full"
        disabled={text.trim().length < 4 || busy}
        onClick={() => void save(true)}
      >
        <Sparkles className="size-4" />
        {busy ? "Reorganizando…" : "Reorganizar e salvar"}
      </Button>
      <button
        type="button"
        className="mt-2 w-full py-2 text-center text-xs text-muted"
        disabled={text.trim().length < 4 || busy}
        onClick={() => void save(false)}
      >
        Salvar como escrevi
      </button>
    </div>
  );
}
