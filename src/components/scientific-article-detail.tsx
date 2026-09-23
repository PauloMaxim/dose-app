import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ScientificArticleDetail } from "@/server/scientific/article-detail";

const studyLabels: Record<NonNullable<ScientificArticleDetail["studyType"]>, string> = {
  systematic_review: "Revisão sistemática",
  meta_analysis: "Meta-análise",
  guideline: "Diretriz",
  randomized_trial: "Ensaio randomizado",
  cohort: "Coorte",
  case_control: "Caso-controle",
  cross_sectional: "Estudo transversal",
  case_report: "Relato de caso",
  editorial: "Editorial",
  other: "Outro tipo de estudo",
};

function publicationLine(article: ScientificArticleDetail) {
  const publication = [article.journal, article.publisher]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" · ");
  const date = article.publishedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${article.publishedAt}T12:00:00Z`))
    : "";
  return [publication, date].filter(Boolean).join(" · ");
}

export function ScientificArticleDetailView({ article }: { article: ScientificArticleDetail }) {
  const context = [
    ...article.specialties.map((item) => item.name),
    ...article.topics.map((item) => item.name),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const publication = publicationLine(article);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-bg scrollbar-none">
      <article className="mx-auto max-w-3xl px-5 pb-14 pt-4 sm:px-8">
        <header>
          <Link
            to="/artigos"
            aria-label="Voltar para artigos"
            className="inline-flex size-11 items-center justify-center rounded-full border border-border text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>

          <div className="mt-8 border-l-2 border-teal pl-4">
            {article.studyType && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">
                {studyLabels[article.studyType]}
              </p>
            )}
            <h1 className="mt-3 font-serif text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-4xl">
              {article.title}
            </h1>
          </div>

          {article.authors.length > 0 && (
            <p className="mt-5 text-sm leading-relaxed text-muted">{article.authors.join(", ")}</p>
          )}
          {publication && <p className="mt-2 text-sm leading-relaxed text-subtle">{publication}</p>}

          {context.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Tópicos e especialidades">
              {context.map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted"
                >
                  {label}
                </li>
              ))}
            </ul>
          )}
        </header>

        <section className="mt-9 border-t border-border pt-7" aria-labelledby="article-abstract">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
            Texto da fonte
          </p>
          <h2 id="article-abstract" className="mt-2 text-xl font-semibold tracking-tight">
            Abstract do artigo
          </h2>
          {article.abstract ? (
            <p className="mt-4 whitespace-pre-line font-serif text-[18px] leading-[1.72] text-fg">
              {article.abstract}
            </p>
          ) : (
            <p className="mt-4 text-base leading-relaxed text-muted">
              Abstract não disponível neste registro.
            </p>
          )}
        </section>

        {(article.doi || article.pmid || article.pmcid || article.publicationTypes.length > 0) && (
          <section className="mt-9 border-t border-border pt-7" aria-labelledby="article-metadata">
            <h2 id="article-metadata" className="text-sm font-semibold">
              Identificação bibliográfica
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              {article.doi && <Metadata label="DOI" value={article.doi} breakAll />}
              {article.pmid && <Metadata label="PMID" value={article.pmid} />}
              {article.pmcid && <Metadata label="PMCID" value={article.pmcid} />}
              {article.publicationTypes.length > 0 && (
                <Metadata label="Tipos de publicação" value={article.publicationTypes.join(", ")} />
              )}
            </dl>
          </section>
        )}

        <section className="mt-9 border-t border-border pt-7" aria-labelledby="article-sources">
          <h2 id="article-sources" className="text-sm font-semibold">
            Fontes verificáveis
          </h2>
          {article.sourceLinks.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-3">
              {article.sourceLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-sm font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {link.label}
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">URL externa não disponível neste registro.</p>
          )}
          <p className="mt-6 rounded-xl bg-card px-4 py-3 text-xs leading-relaxed text-muted">
            Metadata e abstract fornecidos pelas fontes indicadas. Ainda não há resumo Dose para
            este artigo.
          </p>
        </section>
      </article>
    </main>
  );
}

function Metadata({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3">
      <dt className="text-subtle">{label}</dt>
      <dd className={breakAll ? "break-all text-muted" : "text-muted"}>{value}</dd>
    </div>
  );
}
