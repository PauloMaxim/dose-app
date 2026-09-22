import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ArticleRow } from "@/components/article-card";
import { ScientificFeedCard, ScientificFeedStatus } from "@/components/scientific-feed";
import { InsightView } from "@/components/insight-view";
import { NoteComposer } from "@/components/note-composer";
import { UnderlineTabs } from "@/components/segmented";
import { ARTICLES, getArticle } from "@/lib/content";
import { matchQuery } from "@/lib/search";
import { isSaved, useDose } from "@/lib/store";
import type { StudyType as ScientificStudyType } from "@/server/scientific/classification";
import { useScientificFeed } from "@/lib/use-scientific-feed";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { persistNote } from "@/lib/user-content";

export const Route = createFileRoute("/_app/artigos")({
  component: ArtigosPage,
});

type LibTab = "notas" | "meus" | "catalogo";

const FILTERS: Array<{ label: string; value: "all" | ScientificStudyType }> = [
  { label: "Todos", value: "all" },
  { label: "Ensaio randomizado", value: "randomized_trial" },
  { label: "Diretriz", value: "guideline" },
  { label: "Meta-análise", value: "meta_analysis" },
  { label: "Revisão sistemática", value: "systematic_review" },
  { label: "Coorte", value: "cohort" },
];

function ArtigosPage() {
  const tutorialOn = useDose((s) => s.profile.onboardingComplete && !s.profile.tutorialComplete);
  const [tab, setTab] = useState<LibTab>(tutorialOn ? "catalogo" : "meus");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [folder, setFolder] = useState<string>("all");
  const [composer, setComposer] = useState(false);
  const saved = useDose((s) => s.saved);
  const collections = useDose((s) => s.collections);
  const insights = useDose((s) => s.insights);
  const addInsight = useDose((s) => s.addInsight);
  const progress = useDose((s) => s.progress);
  const user = useCurrentUser();
  const scientificFeed = useScientificFeed(50);

  const query = q.trim();

  const meus = useMemo(() => {
    const ids = new Set(saved.filter((s) => isSaved(s) || s.liked).map((s) => s.articleId));
    return ARTICLES.filter((a) => ids.has(a.id)).filter((a) => matchQuery(a, query));
  }, [saved, query]);

  const scientificItems = useMemo(() => {
    if (scientificFeed.status !== "ready") return [];
    const normalizedQuery = query.toLocaleLowerCase("pt-BR");
    return scientificFeed.items.filter((item) => {
      if (filter !== "all" && item.studyType !== filter) return false;
      if (!normalizedQuery) return true;
      return [
        item.title,
        item.abstract ?? "",
        item.journal ?? "",
        item.doi ?? "",
        item.pmid ?? "",
        item.pmcid ?? "",
        ...item.authors,
        ...item.publicationTypes,
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
    });
  }, [scientificFeed.status, scientificFeed.items, filter, query]);

  const filteredInsights = insights.filter((i) => {
    if (!query) return true;
    const art = getArticle(i.articleId);
    return (
      i.text.toLowerCase().includes(query.toLowerCase()) || (art ? matchQuery(art, query) : false)
    );
  });

  const visibleMeus = meus.filter((a) => {
    if (folder === "all") return true;
    if (folder === "liked") {
      return saved.some((s) => s.articleId === a.id && s.liked);
    }
    return saved.some((s) => s.articleId === a.id && s.collectionIds.includes(folder));
  });

  return (
    <main className="relative flex min-h-0 flex-1 flex-col">
      <div className="px-5 pt-6" data-tour="tour-lib">
        <h1 className="text-[34px] font-semibold tracking-tight">Biblioteca</h1>
        <div className="mt-4">
          <UnderlineTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: "notas", label: "Notas" },
              { value: "meus", label: "Salvos" },
              { value: "catalogo", label: "Catálogo" },
            ]}
          />
        </div>
        <label className="mt-4 flex h-12 items-center gap-2 rounded-full bg-card px-4 text-muted">
          <Search className="size-4" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              tab === "notas"
                ? "Buscar nas notas…"
                : tab === "meus"
                  ? "Buscar nos salvos…"
                  : "Título, autor, DOI, PMID ou termo do abstract"
            }
            className="h-full w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-24 pt-5">
        {tab === "meus" && (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-none">
              <FolderChip label="Todos" on={folder === "all"} onClick={() => setFolder("all")} />
              <FolderChip
                label="Gostei"
                on={folder === "liked"}
                onClick={() => setFolder("liked")}
              />
              {collections.map((c) => (
                <FolderChip
                  key={c.id}
                  label={c.name}
                  on={folder === c.id}
                  onClick={() => setFolder(c.id)}
                />
              ))}
            </div>
            {visibleMeus.length === 0 ? (
              <Empty
                title="Nada salvo nesta pasta"
                subtitle="Ao salvar um artigo, escolha Ler mais tarde, a especialidade ou crie uma pasta — Cardiologia: RCP, por exemplo."
                cta="Explorar catálogo"
                onCta={() => setTab("catalogo")}
              />
            ) : (
              <div className="space-y-2.5">
                {visibleMeus.map((a) => (
                  <ArticleRow
                    key={a.id}
                    article={a}
                    minutes
                    completed={progress[a.id]?.completed}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "catalogo" && (
          <div data-tour="tour-catalog">
            <div className="mb-5 flex gap-2 overflow-x-auto scrollbar-none">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={
                    f.value === filter
                      ? "h-8 shrink-0 rounded-full tab-gradient px-3 text-xs font-semibold text-on-accent"
                      : "h-8 shrink-0 rounded-full bg-card px-3 text-xs font-medium text-muted"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em]">
                Literatura para você
              </h2>
              <p className="mt-1 text-xs text-muted">
                Ordenada por relevância personalizada, não por qualidade científica.
              </p>
            </div>
            <div className="space-y-3">
              {scientificFeed.status === "loading" && <ScientificFeedStatus status="loading" />}
              {scientificFeed.status === "error" && (
                <ScientificFeedStatus status="error" onRetry={scientificFeed.retry} />
              )}
              {scientificFeed.status === "ready" && scientificFeed.items.length === 0 && (
                <ScientificFeedStatus status="empty" />
              )}
              {scientificFeed.status === "ready" &&
                scientificFeed.items.length > 0 &&
                scientificItems.length === 0 && (
                  <Empty
                    title="Nenhum artigo corresponde à busca ou ao filtro"
                    subtitle="Ajuste os termos ou selecione outro tipo de estudo."
                  />
                )}
              {scientificItems.map((item) => (
                <ScientificFeedCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {tab === "notas" && (
          <>
            {composer && (
              <NoteComposer
                onClose={() => setComposer(false)}
                onSave={(id, text) => {
                  if (user) void persistNote(id, text);
                  else if (!authEnabled) addInsight(id, text);
                  setComposer(false);
                }}
              />
            )}
            {!composer && filteredInsights.length === 0 ? (
              <Empty
                title="Nenhuma nota ainda"
                subtitle="Escreva o que muda na conduta. A reorganização só ordena as suas frases."
                cta="Nova nota"
                onCta={() => setComposer(true)}
              />
            ) : (
              <div className="space-y-3">
                {filteredInsights.map((ins) => {
                  const art = getArticle(ins.articleId);
                  return (
                    <Link
                      key={ins.id}
                      to="/artigo/$id"
                      params={{ id: ins.articleId }}
                      className="block rounded-2xl bg-card p-4"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                        {art?.title ?? "Artigo"}
                      </p>
                      <div className="mt-2">
                        <InsightView text={ins.text} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {tab !== "catalogo" && !composer && (
        <button
          type="button"
          aria-label="Nova nota"
          onClick={() => {
            setTab("notas");
            setComposer(true);
          }}
          className="absolute bottom-6 right-5 z-20 flex size-14 items-center justify-center rounded-full tab-gradient text-on-accent shadow-[0_10px_28px_rgb(59_139_255/0.4)]"
        >
          <Plus className="size-7" strokeWidth={2.2} />
        </button>
      )}
    </main>
  );
}

function FolderChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        on
          ? "h-8 shrink-0 rounded-full tab-gradient px-3 text-xs font-semibold text-on-accent"
          : "h-8 shrink-0 rounded-full bg-card px-3 text-xs font-medium text-muted"
      }
    >
      {label}
    </button>
  );
}

function Empty({
  title,
  subtitle,
  cta,
  onCta,
}: {
  title: string;
  subtitle?: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex min-h-[46vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-[17px] text-muted">{title}</p>
      {subtitle && <p className="mt-2 text-sm text-subtle">{subtitle}</p>}
      {cta && (
        <button
          type="button"
          onClick={onCta}
          className="btn-gradient mt-6 h-12 rounded-full px-8 text-sm font-semibold"
        >
          {cta}
        </button>
      )}
    </div>
  );
}
