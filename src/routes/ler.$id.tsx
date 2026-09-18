import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bookmark, Check, ExternalLink, Heart, Lightbulb, Mic, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BackButton } from "@/components/back-button";
import { InsightSheet } from "@/components/insight-sheet";
import { SaveSheet } from "@/components/save-sheet";
import { ShareSheet } from "@/components/share-sheet";
import { Button } from "@/components/ui/button";
import { editionForArticle, getArticle } from "@/lib/content";
import { canStartRead, isSaved, useDose } from "@/lib/store";
import { PaywallGate } from "@/components/paywall-gate";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { completeProgress, persistLibraryEntry, queueProgress } from "@/lib/user-content";

export const Route = createFileRoute("/ler/$id")({
  component: LerPage,
});

function LerPage() {
  const { id } = Route.useParams();
  const article = getArticle(id);
  const navigate = useNavigate();
  const progress = useDose((s) => s.progress[id]);
  const saved = useDose((s) => s.saved.find((x) => x.articleId === id));
  const recordScroll = useDose((s) => s.recordScroll);
  const completeArticle = useDose((s) => s.completeArticle);
  const toggleLike = useDose((s) => s.toggleLike);
  const markSourceOpened = useDose((s) => s.markSourceOpened);
  const plan = useDose((s) => s.profile.plan);
  const logs = useDose((s) => s.logs);
  const liked = Boolean(saved?.liked);
  const edition = editionForArticle(id);
  const user = useCurrentUser();

  const scroller = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const restored = useRef(false);
  const [saving, setSaving] = useState(false);
  const [noting, setNoting] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    restored.current = false;
    const initialProgress = useDose.getState().progress[id];
    setPct(initialProgress?.completed ? 0 : (initialProgress?.scrollPct ?? 0));
    const el = scroller.current;
    if (el) el.scrollTop = 0;
  }, [id]);

  useEffect(() => {
    if (restored.current) return;
    const el = scroller.current;
    if (!el) return;
    if (progress?.completed) {
      restored.current = true;
      return;
    }
    const target = progress?.scrollPct ?? 0;
    if (target <= 0) {
      restored.current = true;
      return;
    }
    const max = el.scrollHeight - el.clientHeight;
    if (max > 0) {
      el.scrollTop = (Math.min(target, 90) / 100) * max;
      restored.current = true;
    }
  }, [id, progress?.scrollPct, progress?.completed]);

  if (!article) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
        Artigo não encontrado.
      </div>
    );
  }

  const alreadyOpen = Boolean(progress?.completed || (progress?.scrollPct ?? 0) > 0);
  if (!canStartRead(plan, logs, alreadyOpen)) {
    return (
      <PaywallGate
        title="4 leituras no Free"
        line="Você já fechou 4 artigos hoje. Dose+ tira o teto — a edição de amanhã segue no Free."
      />
    );
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const next = max <= 0 ? 0 : Math.min(99, Math.round((el.scrollTop / max) * 100));
    setPct(next);
    recordScroll(id, next);
    if (user) queueProgress(id, next);
  }

  function finish() {
    if (!authEnabled || user) completeArticle(id);
    if (user) void completeProgress(id);
    if (edition) {
      void navigate({ to: "/edicao/$id", params: { id: edition.id }, replace: true });
    } else {
      void navigate({ to: "/artigo/$id", params: { id }, replace: true });
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <header
        className="flex items-center gap-2 border-b border-border px-3 py-2"
        style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
      >
        <BackButton to="/artigo/$id" params={{ id }} />
        <div className="min-w-0 flex-1">
          <div className="progress-track h-1.5">
            <div className="progress-fill" style={{ width: `${progress?.completed ? 100 : pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-muted">
            {progress?.completed ? "100" : pct}%
          </p>
        </div>
        <button
          type="button"
          aria-label="Insight"
          onClick={() => setNoting(true)}
          className="flex size-10 items-center justify-center"
        >
          <Lightbulb className="size-5 text-muted" />
        </button>
        <button
          type="button"
          aria-label="Compartilhar"
          onClick={() => setSharing(true)}
          className="flex size-10 items-center justify-center"
        >
          <Share2 className="size-5 text-muted" />
        </button>
        <button
          type="button"
          aria-label="Gostar"
          onClick={() => {
            if (user) void persistLibraryEntry(id, !liked, saved?.collectionIds ?? []);
            else if (!authEnabled) toggleLike(id);
          }}
          className="flex size-10 items-center justify-center"
        >
          <Heart className={liked ? "size-5 fill-danger text-danger" : "size-5 text-muted"} />
        </button>
        <button
          type="button"
          aria-label="Salvar"
          onClick={() => setSaving(true)}
          className="flex size-10 items-center justify-center"
        >
          <Bookmark
            className={isSaved(saved) ? "size-5 fill-fg text-fg" : "size-5 text-muted"}
          />
        </button>
      </header>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto scrollbar-none"
      >
        <article className="px-5 pb-28 pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {article.studyType} · nível {article.evidenceLevel} · {article.minutes} min
          </p>
          <h1 className="mt-3 font-sans text-[28px] font-semibold leading-[1.2] tracking-tight">
            {article.title}
          </h1>
          <p className="mt-2 text-sm text-muted">{article.subtitle}</p>
          <p className="mt-1 text-sm text-muted">
            {article.journal} {article.year} · {article.specialty}
            {article.pmid ? ` · PMID ${article.pmid}` : ""}
          </p>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => markSourceOpened(id)}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal"
          >
            {article.sourceLabel}
            <ExternalLink className="size-3.5" />
          </a>

          <div className="mt-8 font-serif text-[18px] leading-[1.65] text-fg">
            <Section kicker="TL;DR">{article.tldr}</Section>
            <Section kicker="O estudo">{article.study}</Section>
            <Section kicker="Resultados">{article.results}</Section>
            <Section kicker="Limitações">{article.limitations}</Section>
            <Section kicker="Implicação clínica">{article.practice}</Section>
          </div>

          <div className="mt-8 rounded-2xl bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">
              Fonte original
            </p>
            <p className="mt-1 text-sm text-muted">
              Resumo com confiança {article.confidence}. A Dose não substitui o paper.
            </p>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => markSourceOpened(id)}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal"
            >
              {article.sourceLabel}
              <ExternalLink className="size-4" />
            </a>
          </div>

          {!progress?.completed ? (
            <Button size="lg" className="mt-8 w-full" onClick={finish}>
              <Check className="size-4" />
              Finalizar
            </Button>
          ) : (
            <div className="mt-8 space-y-3">
              <p className="text-center text-sm text-teal">Artigo concluído.</p>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => {
                  if (edition) {
                    void navigate({ to: "/edicao/$id", params: { id: edition.id } });
                  } else {
                    void navigate({ to: "/artigo/$id", params: { id } });
                  }
                }}
              >
                Voltar à edição
              </Button>
            </div>
          )}
        </article>
      </div>

      <button
        type="button"
        aria-label="Adicionar insight"
        onClick={() => setNoting(true)}
        className="absolute bottom-6 right-5 z-20 flex size-14 items-center justify-center rounded-full tab-gradient text-on-accent shadow-[0_10px_28px_rgb(59_139_255/0.4)]"
      >
        <Mic className="size-6" />
      </button>

      {saving && <SaveSheet articleId={id} onClose={() => setSaving(false)} />}
      {noting && <InsightSheet articleId={id} onClose={() => setNoting(false)} />}
      {sharing && (
        <ShareSheet
          title={article.title}
          subtitle={article.subtitle}
          sourceLabel={article.sourceLabel}
          sourceUrl={article.sourceUrl}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}

function Section({ kicker, children }: { kicker: string; children: string }) {
  return (
    <section className="mt-8">
      <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
        {kicker}
      </h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
