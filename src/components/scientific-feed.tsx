import { ExternalLink, RefreshCw } from "lucide-react";
import type { ScientificFeedPresentation } from "@/lib/scientific-feed-presentation";
import { useDose } from "@/lib/store";
import { formatDate } from "@/lib/i18n";

const studyLabels: Record<ScientificFeedPresentation["studyType"], string> = {
  systematic_review: "Revisão sistemática",
  meta_analysis: "Meta-análise",
  guideline: "Diretriz",
  randomized_trial: "Ensaio randomizado",
  cohort: "Coorte",
  case_control: "Caso-controle",
  cross_sectional: "Transversal",
  case_report: "Relato de caso",
  editorial: "Editorial",
  other: "Outro",
};

export function ScientificFeedCard({
  item,
  compact = false,
}: {
  item: ScientificFeedPresentation;
  compact?: boolean;
}) {
  const locale = useDose((state) => state.profile.locale);
  const primaryLink = item.sourceLinks[0];
  const content = (
    <article className="rounded-2xl bg-card p-4">
      <div className="flex flex-wrap gap-2 text-[11px] font-medium text-muted">
        <span className="rounded-full bg-card-2 px-2.5 py-1">{studyLabels[item.studyType]}</span>
      </div>
      <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-tight">{item.title}</h3>
      {item.authors.length > 0 && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
          {item.authors.join(", ")}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        {[item.journal, formatDate(`${item.publishedAt}T12:00:00`, locale)]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-subtle">
        Relevância personalizada · {item.matchedTopics.length}{" "}
        {item.matchedTopics.length === 1 ? "tópico correspondente" : "tópicos correspondentes"}
      </p>
      {!compact && item.abstract && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Abstract do artigo
          </p>
          <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-muted">{item.abstract}</p>
        </div>
      )}
      {!compact && (item.doi || item.pmid || item.pmcid || item.publicationTypes.length > 0) && (
        <dl className="mt-3 grid gap-1 text-xs text-subtle">
          {item.doi && (
            <div>
              <dt className="inline font-medium text-muted">DOI: </dt>
              <dd className="inline break-all">{item.doi}</dd>
            </div>
          )}
          {item.pmid && (
            <div>
              <dt className="inline font-medium text-muted">PMID: </dt>
              <dd className="inline">{item.pmid}</dd>
            </div>
          )}
          {item.pmcid && (
            <div>
              <dt className="inline font-medium text-muted">PMCID: </dt>
              <dd className="inline">{item.pmcid}</dd>
            </div>
          )}
          {item.publicationTypes.length > 0 && (
            <div>
              <dt className="inline font-medium text-muted">Tipos de publicação: </dt>
              <dd className="inline">{item.publicationTypes.join(", ")}</dd>
            </div>
          )}
        </dl>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {item.sourceLinks.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-semibold text-fg"
            onClick={(event) => event.stopPropagation()}
          >
            {link.label}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ))}
        {!primaryLink && (
          <p className="text-xs text-subtle">Fonte externa indisponível neste registro.</p>
        )}
      </div>
    </article>
  );

  if (!primaryLink) return content;
  return <div>{content}</div>;
}

export function ScientificFeedStatus({
  status,
  onRetry,
}: {
  status: "loading" | "empty" | "error";
  onRetry?: () => void;
}) {
  if (status === "loading")
    return (
      <div className="rounded-2xl bg-card p-5 text-sm text-muted" role="status" aria-live="polite">
        Carregando sua atualização científica…
      </div>
    );
  if (status === "error")
    return (
      <div className="rounded-2xl bg-card p-5" role="alert">
        <p className="text-sm font-semibold">Não foi possível carregar a atualização científica.</p>
        <p className="mt-1 text-sm text-muted">
          Tente novamente. Nenhum conteúdo de demonstração foi usado.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Tentar novamente
          </button>
        )}
      </div>
    );
  return (
    <div className="rounded-2xl bg-card p-5" role="status">
      <p className="text-sm font-semibold">Nenhum artigo encontrado para seus interesses.</p>
      <p className="mt-1 text-sm text-muted">
        Quando houver literatura correspondente disponível, ela aparecerá aqui.
      </p>
    </div>
  );
}
