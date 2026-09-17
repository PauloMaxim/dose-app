import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Share2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ArticleRow } from "@/components/article-card";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { ShareSheet } from "@/components/share-sheet";
import { editionById, editionMinutes, getArticle } from "@/lib/content";
import { useDose } from "@/lib/store";
import { formatMinutes, parseIso } from "@/lib/utils";

const searchSchema = z.object({
  from: z.enum(["home", "catalogo"]).optional(),
});

export const Route = createFileRoute("/edicao/$id")({
  component: EdicaoPage,
  validateSearch: searchSchema,
});

function EdicaoPage() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const edition = editionById(id);
  const progress = useDose((s) => s.progress);
  const [sharing, setSharing] = useState(false);

  if (!edition) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <p className="text-muted">Edição não encontrada.</p>
      </div>
    );
  }

  const articles = edition.articleIds
    .map((aid) => getArticle(aid))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const resumeId =
    articles.find((a) => (progress[a.id]?.scrollPct ?? 0) > 0 && !progress[a.id]?.completed)
      ?.id ?? articles.find((a) => !progress[a.id]?.completed)?.id;
  const doneCount = articles.filter((a) => progress[a.id]?.completed).length;
  const continuing = Boolean(
    resumeId && (progress[resumeId]?.scrollPct ?? 0) > 0 && !progress[resumeId]?.completed,
  );
  const backTo = from === "catalogo" || edition.daysAgo > 0 ? "/artigos" : "/";

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
        <div className="relative">
          <img
            src={edition.cover}
            alt=""
            className="aspect-[16/9] w-full object-cover"
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-bg" />
          <BackButton
            to={backTo}
            className="absolute left-4 top-4 rounded-full bg-black/40 backdrop-blur"
          />
          <button
            type="button"
            aria-label="Compartilhar edição"
            onClick={() => setSharing(true)}
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-black/40 text-fg backdrop-blur"
          >
            <Share2 className="size-5" />
          </button>
        </div>
        <div className="px-5 pb-6 pt-2" data-tour="tour-edition-page">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            {edition.kicker} · nº {edition.number}
          </p>
          <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
            {edition.title}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {parseIso(edition.id).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <div className="mt-4 flex items-center gap-3 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" />
              {formatMinutes(editionMinutes(edition))}
            </span>
            <span>
              {doneCount}/{articles.length} lidos
            </span>
          </div>
          <h2 className="mb-3 mt-6 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
            Nesta edição
          </h2>
          <div className="space-y-2.5">
            {articles.map((a) => (
              <ArticleRow
                key={a.id}
                article={a}
                minutes
                completed={progress[a.id]?.completed}
              />
            ))}
          </div>
        </div>
      </div>
      {resumeId && (
        <div
          className="shrink-0 border-t border-border bg-bg px-5 pt-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <Button asChild className="w-full" size="lg">
            <Link to="/ler/$id" params={{ id: resumeId }}>
              {continuing
                ? "Continuar de onde parou"
                : doneCount > 0
                  ? "Continuar a edição"
                  : "Começar a edição"}
            </Link>
          </Button>
        </div>
      )}
      {sharing && (
        <ShareSheet
          title={`Dose nº ${edition.number}: ${edition.title}`}
          subtitle={articles.map((a) => `• ${a.title}`).join("\n")}
          sourceLabel={articles[0]?.sourceLabel}
          sourceUrl={articles[0]?.sourceUrl}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  );
}
