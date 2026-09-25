import { DoseDocumentArticleView } from "./scientific-article-detail";
import {
  EDITORIAL_PREVIEWS,
  resolveEditorialPreview,
  type PreviewPmid,
  type PreviewVersion,
} from "@/server/scientific/dose-document/editorial-preview";

const previewOrder: PreviewPmid[] = ["42717033", "41910396", "42670964"];

export function ScientificEditorialPreview({
  pmid,
  version,
}: {
  pmid: PreviewPmid;
  version: PreviewVersion;
}) {
  const preview = resolveEditorialPreview(pmid, version);
  const claims = preview.interpretation.claims;
  const reviewStatuses = [...new Set(claims.map(({ reviewStatus }) => reviewStatus))];
  const operationalStatuses = [
    ...new Set(claims.map(({ operationalStatus }) => operationalStatus)),
  ];

  return (
    <DoseDocumentArticleView
      article={preview.article}
      document={preview.document}
      hideInternalValidation
      labHeader={
        <section className="mb-8 border-b border-border pb-8" aria-labelledby="preview-lab-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex rounded-full border border-teal/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
                Preview editorial — não publicado
              </p>
              <h1 id="preview-lab-title" className="mt-4 font-serif text-2xl font-semibold">
                Laboratório editorial RCT
              </h1>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-muted">
              Ferramenta interna temporária para comparar a projeção editorial. Não integra Home,
              feed ou catálogo.
            </p>
          </div>

          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Selecionar estudo canário">
            {previewOrder.map((candidatePmid) => {
              const candidate = EDITORIAL_PREVIEWS[candidatePmid];
              const selected = candidatePmid === pmid;
              return (
                <a
                  key={candidatePmid}
                  href={`/internal/scientific-preview?pmid=${candidatePmid}&version=${candidatePmid === "42717033" ? version : "generic"}`}
                  aria-current={selected ? "page" : undefined}
                  className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected ? "border-teal bg-teal/10 text-teal" : "border-border-strong text-muted"}`}
                >
                  {candidate.shortLabel} · PMID {candidatePmid}
                </a>
              );
            })}
          </nav>

          {pmid === "42717033" && (
            <div className="mt-5" role="group" aria-label="Versão do documento Mitiperstat">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                Comparar versão
              </p>
              <div className="inline-flex rounded-full border border-border-strong p-1">
                {(["approved", "generic", "experimental"] as const).map((candidateVersion) => (
                  <a
                    key={candidateVersion}
                    href={`/internal/scientific-preview?pmid=42717033&version=${candidateVersion}`}
                    aria-current={preview.version === candidateVersion ? "true" : undefined}
                    className={`min-h-10 rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring ${preview.version === candidateVersion ? "bg-teal text-bg" : "text-muted"}`}
                  >
                    {candidateVersion === "approved"
                      ? "Versão aprovada"
                      : candidateVersion === "generic"
                        ? "Composer determinístico"
                        : "Editorial profundo experimental"}
                  </a>
                ))}
              </div>
              {preview.version === "experimental" && (
                <p className="mt-3 inline-flex rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-fg">
                  Editorial profundo — experimental — revisão pendente
                </p>
              )}
            </div>
          )}

          <details className="mt-6 border-t border-border pt-2">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring">
              Informações de validação
              <span className="text-teal" aria-hidden="true">
                +
              </span>
            </summary>
            <dl className="grid gap-3 pb-2 pt-3 text-xs leading-relaxed text-muted sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-fg">Composer</dt>
                <dd>
                  {preview.version === "generic"
                    ? "generic deterministic RCT v1"
                    : preview.version === "experimental"
                      ? "ScientificEditorialDraft.v1 validado → projeção experimental"
                      : "manual aprovada v1"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-fg">Review status</dt>
                <dd>{reviewStatuses.join(", ")}</dd>
              </div>
              <div>
                <dt className="font-semibold text-fg">Operational status</dt>
                <dd>{operationalStatuses.join(", ")}</dd>
              </div>
              <div>
                <dt className="font-semibold text-fg">Source coverage</dt>
                <dd>
                  {preview.sourceSet.coverage.sourceKinds.join(", ")}; full text autorizado:{" "}
                  {preview.sourceSet.coverage.hasAuthorizedFullText ? "sim" : "não"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-fg">Source identifiers</dt>
                <dd>
                  {preview.sourceSet.sourceDocuments
                    .map(
                      ({ externalIdentifier }) =>
                        `${externalIdentifier.scheme.toUpperCase()} ${externalIdentifier.value}`,
                    )
                    .join(", ")}
                </dd>
              </div>
            </dl>
          </details>
        </section>
      }
    />
  );
}
