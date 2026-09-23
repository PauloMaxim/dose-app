import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ExternalLink } from "lucide-react";
import type { ScientificArticleDetail } from "@/server/scientific/article-detail";
import { resolveDoseDocument } from "@/server/scientific/dose-document/pmid-42717033";
import type { DoseDocument } from "@/server/scientific/dose-document/contracts";

export function ScientificArticleDetailView({ article }: { article: ScientificArticleDetail }) {
  const dose = resolveDoseDocument(article);
  return dose ? (
    <DoseArticle article={article} document={dose} />
  ) : (
    <SourceOnlyArticle article={article} />
  );
}

function DoseArticle({
  article,
  document,
}: {
  article: ScientificArticleDetail;
  document: DoseDocument;
}) {
  return (
    <main
      className="scientific-article-detail min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg scrollbar-none"
      data-scientific-article-detail
    >
      <article className="mx-auto w-full max-w-6xl px-5 pb-20 pt-4 sm:px-8 lg:px-12">
        <Link
          to="/artigos"
          aria-label="Voltar para artigos"
          className="inline-flex size-11 items-center justify-center rounded-full border border-border text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>

        <header className="mt-10 max-w-5xl border-t border-teal/60 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            {document.label}
          </p>
          <h1 className="mt-5 text-balance font-serif text-[clamp(2.35rem,6vw,4.75rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
            {document.headline}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-muted sm:text-xl">{document.deck}</p>
          <p className="mt-6 text-xs leading-relaxed text-subtle">
            Conteúdo editorial em português, baseado nas fontes indicadas ao final. Não é o texto
            dos autores.
          </p>
        </header>

        <section className="mt-14 border-y border-border py-9" aria-labelledby="opening-heading">
          <h2
            id="opening-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal"
          >
            Para entender o estudo
          </h2>
          <div className="mt-6 max-w-3xl space-y-6 font-serif text-xl leading-[1.65] sm:text-[1.35rem]">
            {document.openingSummary.map((paragraph) => (
              <p key={paragraph.id}>{paragraph.text}</p>
            ))}
          </div>
        </section>

        <div className="scientific-article-chapters mt-16 grid min-w-0 gap-x-12">
          <div className="min-w-0 max-w-3xl">
            {document.chapters.map((chapter, index) => (
              <section key={chapter.id} className="mb-16" aria-labelledby={chapter.id}>
                <p className="text-[11px] font-semibold tabular-nums tracking-[0.18em] text-teal">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2
                  id={chapter.id}
                  className="mt-2 font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl"
                >
                  {chapter.title}
                </h2>
                <div className="mt-6 space-y-6">
                  {chapter.blocks.map((block) => {
                    if (block.kind === "prose")
                      return (
                        <div
                          key={block.id}
                          className="space-y-4 font-serif text-lg leading-[1.75] text-fg"
                        >
                          {block.paragraphs.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      );
                    if (block.kind === "study_design")
                      return <StudyDesign key={block.id} block={block} />;
                    if (block.kind === "result") return <Result key={block.id} block={block} />;
                    return <Safety key={block.id} block={block} />;
                  })}
                </div>
              </section>
            ))}
          </div>

          <aside
            className="scientific-article-numbers mb-16 min-w-0"
            aria-labelledby="numbers-heading"
          >
            <h2
              id="numbers-heading"
              className="border-b border-border pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted"
            >
              Em números
            </h2>
            <dl className="divide-y divide-border">
              {document.keyNumbers.map((number) => (
                <div key={number.id} className="py-5">
                  <dd className="font-serif text-4xl font-semibold tabular-nums text-teal">
                    {number.value}
                  </dd>
                  <dt className="mt-1 text-sm font-semibold">{number.label}</dt>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{number.context}</p>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        <section className="border-t border-border pt-10" aria-labelledby="explainers-heading">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Aprofunde se quiser
          </p>
          <h2 id="explainers-heading" className="mt-2 font-serif text-3xl font-semibold">
            Conceitos para ler este estudo
          </h2>
          <div className="mt-6 grid gap-x-10 sm:grid-cols-2">
            {document.contextualExplainers.map((item) => (
              <details key={item.id} className="group border-b border-border">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
                  {item.title}
                  <span
                    className="text-xl font-normal text-teal group-open:rotate-45"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 text-sm leading-7 text-muted">{item.body}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="mt-16 border-y border-border py-10"
          aria-labelledby={document.sourceCoverage.id}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Cobertura da fonte
          </p>
          <h2 id={document.sourceCoverage.id} className="mt-2 font-serif text-3xl font-semibold">
            Até onde esta Dose consegue ir?
          </h2>
          <p className="mt-5 max-w-3xl text-base leading-7">{document.sourceCoverage.statement}</p>
          <p className="mt-5 text-sm font-semibold">Não há cobertura integral de:</p>
          <ul className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
            {document.sourceCoverage.notCovered.map((item) => (
              <li key={item}>— {item}</li>
            ))}
          </ul>
        </section>

        <SourceOriginal article={article} document={document} />
      </article>
    </main>
  );
}

function StudyDesign({
  block,
}: {
  block: Extract<DoseDocument["chapters"][number]["blocks"][number], { kind: "study_design" }>;
}) {
  return (
    <figure className="border-y border-border bg-card/40 px-5 py-8 sm:px-8">
      <figcaption className="mb-7 text-xs leading-relaxed text-muted">{block.label}</figcaption>
      <ol className="grid gap-3 text-center">
        {block.steps.map((step, index) => (
          <li key={step.id}>
            <div className="rounded-xl border border-border-strong bg-bg px-4 py-4 text-sm font-semibold">
              {step.label}
            </div>
            {index < block.steps.length - 1 && (
              <ArrowDown className="mx-auto mt-3 size-4 text-teal" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Result({
  block,
}: {
  block: Extract<DoseDocument["chapters"][number]["blocks"][number], { kind: "result" }>;
}) {
  return (
    <div className="border-l-2 border-teal bg-card/50 px-5 py-6 sm:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        {block.endpoint}
      </p>
      <p className="mt-3 font-serif text-5xl font-semibold tabular-nums tracking-tight text-teal">
        {block.estimate}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold tabular-nums">
        <span>{block.confidenceInterval}</span>
        <span>{block.pValue}</span>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        {block.comparison} · {block.timepoint}
      </p>
      <p className="mt-5 border-t border-border pt-5 text-sm leading-7">{block.interpretation}</p>
    </div>
  );
}

function Safety({
  block,
}: {
  block: Extract<DoseDocument["chapters"][number]["blocks"][number], { kind: "safety" }>;
}) {
  return (
    <div>
      <p className="font-serif text-lg leading-8">{block.summary}</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {block.events.map((event) => (
          <div key={event.id} className="border-t border-border pt-4">
            <dt className="text-xs leading-relaxed text-muted">{event.label}</dt>
            <dd className="mt-1 font-serif text-4xl font-semibold tabular-nums">{event.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs leading-relaxed text-subtle">{block.caveat}</p>
    </div>
  );
}

function SourceOriginal({
  article,
  document,
}: {
  article: ScientificArticleDetail;
  document: DoseDocument;
}) {
  return (
    <section className="mt-16" aria-labelledby="original-source">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
        Fonte original
      </p>
      <h2 id="original-source" className="mt-2 font-serif text-3xl font-semibold">
        Leia e verifique
      </h2>
      <p className="mt-5 max-w-3xl font-serif text-xl leading-8">{article.title}</p>
      <ul className="mt-6 flex flex-wrap gap-3">
        {document.sourceReferences.map((source) => (
          <li key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {source.label} · {source.value}
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      <details className="mt-8 border-t border-border">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
          Ver abstract original em inglês
          <span className="text-teal" aria-hidden="true">
            +
          </span>
        </summary>
        {article.abstract ? (
          <p className="pb-6 font-serif text-base leading-8 text-muted whitespace-pre-line">
            {article.abstract}
          </p>
        ) : (
          <p className="pb-6 text-sm text-muted">Abstract não disponível neste registro.</p>
        )}
      </details>
    </section>
  );
}

function SourceOnlyArticle({ article }: { article: ScientificArticleDetail }) {
  return (
    <main
      className="scientific-article-detail min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg scrollbar-none"
      data-scientific-article-detail
    >
      <article className="mx-auto max-w-3xl px-5 pb-14 pt-4 sm:px-8">
        <Link
          to="/artigos"
          aria-label="Voltar para artigos"
          className="inline-flex size-11 items-center justify-center rounded-full border border-border"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <header className="mt-8 border-l-2 border-teal pl-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">
            Fonte científica
          </p>
          <h1 className="mt-3 font-serif text-3xl font-semibold leading-tight">{article.title}</h1>
        </header>
        <section className="mt-9 border-t border-border pt-7">
          <h2 className="text-xl font-semibold">Abstract do artigo</h2>
          {article.abstract ? (
            <p className="mt-4 whitespace-pre-line font-serif text-lg leading-8">
              {article.abstract}
            </p>
          ) : (
            <p className="mt-4 text-muted">Abstract não disponível neste registro.</p>
          )}
        </section>
        <p className="mt-8 rounded-xl bg-card px-4 py-3 text-xs leading-relaxed text-muted">
          Metadata e abstract fornecidos pelas fontes indicadas. Ainda não há resumo Dose para este
          artigo.
        </p>
      </article>
    </main>
  );
}
