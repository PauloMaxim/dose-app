import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Heart, Play, Share2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { BackButton } from "@/components/back-button";
import { ScientificArticleDetailView } from "@/components/scientific-article-detail";
import { StudyPill } from "@/components/article-card";
import { InsightView } from "@/components/insight-view";
import { SaveSheet } from "@/components/save-sheet";
import { Segmented } from "@/components/segmented";
import { ShareSheet } from "@/components/share-sheet";
import { RatingSummary, Stars } from "@/components/stars";
import { Button } from "@/components/ui/button";
import { communityFor } from "@/lib/community";
import { editionForArticle, getArticle } from "@/lib/content";
import { isSaved, useDose } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { persistLibraryEntry } from "@/lib/user-content";
import { resolveArticleRouteKind } from "@/lib/article-route";
import { readMyScientificArticleDetail } from "@/server/scientific/article-detail-service";

export const Route = createFileRoute("/artigo/$id")({
  loader: async ({ params }) => {
    const kind = resolveArticleRouteKind(params.id, (slug) => Boolean(getArticle(slug)));
    if (kind === "scientific") {
      const article = await readMyScientificArticleDetail({ data: params.id });
      return article ? { kind, article } : { kind: "not-found" as const };
    }
    return { kind };
  },
  component: ArtigoPage,
});

function ArtigoPage() {
  const result = Route.useLoaderData();
  if (result.kind === "scientific") return <ScientificArticleDetailView article={result.article} />;
  if (result.kind === "not-found") return <ArticleNotFound />;
  return <LegacyArticleDetail />;
}

function ArticleNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-6 text-center">
      <div>
        <p className="text-muted">Artigo não encontrado.</p>
        <Link to="/artigos" className="mt-3 inline-block text-teal">
          Voltar
        </Link>
      </div>
    </div>
  );
}

function LegacyArticleDetail() {
  const { id } = Route.useParams();
  const article = getArticle(id);
  const progress = useDose((s) => s.progress[id]);
  const saved = useDose((s) => s.saved.find((x) => x.articleId === id));
  const allInsights = useDose((s) => s.insights);
  const insights = allInsights.filter((i) => i.articleId === id);
  const allComments = useDose((s) => s.comments);
  const mine = allComments.filter((c) => c.articleId === id);
  const myRating = useDose((s) => s.ratings[id] ?? 0);
  const toggleLike = useDose((s) => s.toggleLike);
  const addComment = useDose((s) => s.addComment);
  const setRating = useDose((s) => s.setRating);
  const [boxTab, setBoxTab] = useState<"sinopse" | "insights">("sinopse");
  const [openInsight, setOpenInsight] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftStars, setDraftStars] = useState(0);
  const [published, setPublished] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const user = useCurrentUser();
  const newCommentRef = useRef<HTMLLIElement>(null);

  const community = useMemo(() => communityFor(id), [id]);
  const thread = useMemo(
    () => [...mine, ...community].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [mine, community],
  );

  const ratingPool = [
    ...community.map((c) => c.rating),
    ...(myRating ? [myRating] : []),
  ];
  const avg = ratingPool.length
    ? ratingPool.reduce((s, n) => s + n, 0) / ratingPool.length
    : 0;

  if (!article) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-6 text-center">
        <div>
          <p className="text-muted">Artigo não encontrado.</p>
          <Link to="/artigos" className="mt-3 inline-block text-teal">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const pct = progress?.completed ? 100 : (progress?.scrollPct ?? 0);
  const edition = editionForArticle(id);
  const liked = Boolean(saved?.liked);
  const open = insights.find((i) => i.id === openInsight);

  function publish() {
    if (!article) return;
    const text = draft.trim();
    if (text.length < 3) {
      setFormError("Escreva pelo menos 3 caracteres.");
      return;
    }
    setFormError(null);
    const stars = myRating || draftStars || 4;
    addComment(article.id, text, stars);
    setDraft("");
    setPublished(true);
    window.setTimeout(() => {
      newCommentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    window.setTimeout(() => setPublished(false), 3500);
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
        <div className="relative h-[42vh] min-h-[280px] overflow-hidden">
          <img
            src={article.cover}
            alt=""
            className="absolute inset-0 size-full scale-110 object-cover blur-2xl opacity-50"
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg" />
          <div className="relative flex h-full flex-col">
            <div
              className="flex items-center justify-between px-4"
              style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}
            >
              <BackButton
                to={edition ? "/edicao/$id" : "/artigos"}
                params={edition ? { id: edition.id } : undefined}
                className="rounded-full bg-black/40 backdrop-blur"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Compartilhar"
                  onClick={() => setSharing(true)}
                  className="flex size-11 items-center justify-center rounded-full bg-black/40 text-fg backdrop-blur"
                >
                  <Share2 className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label={liked ? "Remover gosto" : "Gostar"}
                  onClick={() => {
                    if (user) void persistLibraryEntry(article.id, !liked, saved?.collectionIds ?? []);
                    else if (!authEnabled) toggleLike(article.id);
                  }}
                  className="flex size-11 items-center justify-center rounded-full bg-black/40 text-fg backdrop-blur"
                >
                  <Heart
                    className={liked ? "size-5 fill-danger text-danger" : "size-5"}
                  />
                </button>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center px-12 pb-2">
              <div className="aspect-[16/10] w-full max-w-[280px] overflow-hidden rounded-2xl shadow-card">
                <img
                  src={article.cover}
                  alt={article.title}
                  className="size-full object-cover"
                  crossOrigin="anonymous"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col px-5 pb-8">
          <div className="flex items-center justify-center gap-2">
            <StudyPill>{article.minutes} min</StudyPill>
            <StudyPill>{article.studyType}</StudyPill>
          </div>
          <h1 className="mt-4 text-center text-[26px] font-semibold leading-tight tracking-tight">
            {article.title}
          </h1>
          <p className="mt-2 text-center text-sm text-muted">
            {article.journal} {article.year}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <StudyPill>Nível {article.evidenceLevel}</StudyPill>
            <StudyPill>{article.specialty}</StudyPill>
            {article.pmid && <StudyPill>PMID {article.pmid}</StudyPill>}
          </div>
          <div className="mt-3 flex justify-center">
            <RatingSummary average={avg} count={ratingPool.length} />
          </div>

          <section className="mt-5 overflow-hidden rounded-2xl bg-card">
            <div className="px-3 pt-3">
              <Segmented
                value={boxTab}
                onChange={setBoxTab}
                options={[
                  { value: "sinopse", label: "Sinopse" },
                  { value: "insights", label: "Insights" },
                ]}
              />
            </div>
            {boxTab === "sinopse" ? (
              <div className="p-4">
                <p className="text-[15px] leading-relaxed text-fg">{article.synopsis}</p>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                      Progresso
                    </p>
                    <span className="text-sm tabular-nums text-muted">{pct}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                {insights.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">
                    Nenhum insight neste paper. Durante a leitura, use o botão de microfone.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {insights.map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => setOpenInsight(i.id)}
                          className="w-full rounded-xl bg-elevated px-3 py-3 text-left"
                        >
                          <p className="line-clamp-3 text-sm leading-relaxed">{i.text}</p>
                          <p className="mt-1 text-[11px] text-subtle">Abrir</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
                Comunidade
              </h2>
              <span className="text-xs text-muted">{thread.length} comentários</span>
            </div>
            <form
              className="rounded-2xl bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                publish();
              }}
            >
              <p className="text-xs text-muted">Sua nota neste paper</p>
              <Stars
                value={myRating || draftStars}
                onChange={(n) => {
                  setDraftStars(n);
                  setRating(article.id, n);
                }}
              />
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (formError) setFormError(null);
                }}
                rows={3}
                placeholder="Opinião pública sobre o paper — o que muda na conduta, com que ressalva."
                className="mt-3 w-full resize-none rounded-xl bg-elevated px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-subtle"
              />
              <Button
                type="submit"
                className="mt-2 w-full"
                disabled={draft.trim().length < 3}
              >
                Publicar comentário
              </Button>
              {formError && <p className="mt-2 text-center text-xs text-danger">{formError}</p>}
              {published && (
                <p className="mt-2 text-center text-xs text-teal">Publicado na comunidade.</p>
              )}
            </form>
            <ul className="mt-3 space-y-2 pb-4">
              {thread.map((c, i) => (
                <li
                  key={c.id}
                  ref={c.mine && i === thread.findIndex((x) => x.mine) ? newCommentRef : undefined}
                  className={
                    c.mine
                      ? "rounded-2xl bg-card p-4 ring-1 ring-teal/40"
                      : "rounded-2xl bg-card p-4"
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {c.username
                          ? `@${c.username}`
                          : `${c.titlePrefix} ${c.author}`}
                      </p>
                      <p className="text-[11px] text-subtle">{c.specialty}</p>
                    </div>
                    <Stars value={c.rating} size="sm" />
                  </div>
                  <p className="mt-2 text-[15px] leading-relaxed">{c.text}</p>
                  {c.mine && (
                    <p className="mt-2 text-[11px] text-teal">Seu comentário</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border bg-bg px-5 pt-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setSaving(true)}>
            <Bookmark className={isSaved(saved) ? "fill-fg" : ""} />
            {isSaved(saved) ? "Salvo" : "Salvar"}
          </Button>
          <Button asChild className="flex-[1.3]">
            <Link to="/ler/$id" params={{ id: article.id }}>
              <Play className="size-4 fill-on-accent" />
              {pct > 0 && !progress?.completed ? "Continuar" : "Começar"}
            </Link>
          </Button>
        </div>
      </div>

      {saving && <SaveSheet articleId={article.id} onClose={() => setSaving(false)} />}
      {sharing && (
        <ShareSheet
          title={article.title}
          subtitle={article.subtitle}
          sourceLabel={article.sourceLabel}
          sourceUrl={article.sourceUrl}
          onClose={() => setSharing(false)}
        />
      )}

      {open && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-bg/70">
          <button type="button" aria-label="Fechar" className="flex-1" onClick={() => setOpenInsight(null)} />
          <div className="rounded-t-3xl bg-card px-5 pb-10 pt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">Insight</p>
            <div className="mt-3">
              <InsightView text={open.text} />
            </div>
            <Button className="mt-5 w-full" variant="secondary" onClick={() => setOpenInsight(null)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
