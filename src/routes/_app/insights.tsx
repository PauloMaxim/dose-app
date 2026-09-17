import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { InsightView } from "@/components/insight-view";
import { NoteComposer } from "@/components/note-composer";
import { Button } from "@/components/ui/button";
import { getArticle } from "@/lib/content";
import { PaywallGate } from "@/components/paywall-gate";
import { isPremium } from "@/lib/premium";
import { useDose } from "@/lib/store";
import { useInsightAi } from "@/lib/use-insight-ai";

function asSearchString(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v);
}

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    novo: asSearchString(raw.novo),
    artigo: asSearchString(raw.artigo),
  }),
});

function InsightsPage() {
  const { novo, artigo } = Route.useSearch();
  const insights = useDose((s) => s.insights);
  const plan = useDose((s) => s.profile.plan);
  const addInsight = useDose((s) => s.addInsight);
  const updateInsight = useDose((s) => s.updateInsight);
  const deleteInsight = useDose((s) => s.deleteInsight);
  const navigate = useNavigate();
  const [composer, setComposer] = useState(Boolean(novo));

  if (!isPremium(plan)) {
    return (
      <PaywallGate
        title="Notas são Dose+"
        line="Fato, conduta e cautela a partir do que você ditou. No Free a edição do dia continua aberta."
      />
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="px-5 pt-6">
        <h1 className="text-[34px] font-semibold tracking-tight">Notas</h1>
        <p className="mt-1 text-sm text-muted">
          Só ordena as suas frases em Fato / Conduta / Cautela. Não responde.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-8 pt-5">
        {composer && (
          <NoteComposer
            initialArticle={artigo}
            onClose={() => {
              setComposer(false);
              void navigate({ to: "/insights", search: { novo: undefined, artigo: undefined } });
            }}
            onSave={(id, text) => {
              addInsight(id, text);
              setComposer(false);
              void navigate({ to: "/insights", search: { novo: undefined, artigo: undefined } });
            }}
          />
        )}
        {!composer && (
          <button
            type="button"
            onClick={() => setComposer(true)}
            className="mb-4 h-12 w-full rounded-full bg-card text-sm font-semibold text-fg"
          >
            Nova nota
          </button>
        )}
        {insights.length === 0 && !composer && (
          <p className="mt-16 text-center text-muted">
            Nenhuma nota ainda. Escreva o que muda — ou não muda — na conduta.
          </p>
        )}
        <div className="space-y-3">
          {insights.map((ins) => {
            const art = getArticle(ins.articleId);
            return (
              <article key={ins.id} className="rounded-2xl bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/artigo/$id"
                    params={{ id: ins.articleId }}
                    className="text-[11px] font-medium uppercase tracking-wide text-teal"
                  >
                    {art?.title ?? "Artigo"}
                  </Link>
                  <button
                    type="button"
                    aria-label="Excluir"
                    onClick={() => deleteInsight(ins.id)}
                    className="text-subtle hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <InsightBody
                  title={art?.title ?? ""}
                  text={ins.text}
                  onApply={(t) => updateInsight(ins.id, t)}
                />
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function InsightBody({
  title,
  text,
  onApply,
}: {
  title: string
  text: string
  onApply: (t: string) => void
}) {
  const organize = useInsightAi();
  const [value, setValue] = useState(text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const can = useMemo(() => value.trim().length > 4, [value]);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await organize(value, title);
      setValue(res.text);
      onApply(res.text);
      setEditing(false);
      if (res.error) setErr(res.error);
    } catch {
      setErr("Falha de rede.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {editing ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const v = value.trim();
            if (v && v !== text) onApply(v);
          }}
          className="mt-2 w-full resize-none bg-transparent text-[15px] leading-relaxed text-fg outline-none"
          rows={5}
        />
      ) : (
        <button type="button" className="mt-2 w-full text-left" onClick={() => setEditing(true)}>
          <InsightView text={value} />
        </button>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="mt-3 w-full"
        disabled={!can || busy}
        onClick={() => void run()}
      >
        <Sparkles className="size-3.5" />
        {busy ? "Reorganizando…" : "Reorganizar"}
      </Button>
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </>
  );
}
