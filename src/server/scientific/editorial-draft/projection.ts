import { doseDocumentSchema, type DoseDocument } from "../dose-document/contracts";
import type { ScientificSourceSet } from "../knowledge-representation/editorial-pipeline";
import type { ScientificEditorialDraft } from "./contracts";

export interface ProjectEditorialDraftInput {
  draft: ScientificEditorialDraft;
  sourceSet: ScientificSourceSet;
}

const chapterTitles: Record<ScientificEditorialDraft["blocks"][number]["kind"], string> = {
  headline: "Abertura",
  deck: "Em uma frase",
  scientific_context: "Contexto científico",
  mechanistic_context: "Racional e mecanismo",
  research_question: "Pergunta científica",
  study_design: "Como o estudo foi feito",
  population: "Quem participou",
  intervention_comparator: "O que foi comparado",
  endpoint_explanation: "Como a hipótese foi medida",
  primary_result: "Resultados principais",
  secondary_result: "Outros resultados",
  safety: "Segurança",
  interpretation: "Como interpretar",
  limitations: "Limitações",
  what_this_adds: "O que o estudo acrescenta",
  contextual_explainer: "Para entender",
  source_boundary: "Limites da fonte",
};

function facts(block: ScientificEditorialDraft["blocks"][number]) {
  return [...new Set(block.claims.flatMap(({ grounding }) => grounding.factIds))];
}

function sourceReferences(sourceSet: ScientificSourceSet): DoseDocument["sourceReferences"] {
  return sourceSet.sourceDocuments.flatMap((document, index) => {
    if (document.provider !== "pubmed" || document.externalIdentifier.scheme !== "pmid") return [];
    const value = document.externalIdentifier.value;
    return [
      {
        id: `experimental-source-${index + 1}`,
        kind: "pubmed" as const,
        label: "PubMed",
        value: `PMID ${value}`,
        url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(value)}/`,
      },
    ];
  });
}

/** Experimental, kind-driven presentation only. Validation must happen before this boundary. */
export function projectScientificEditorialDraft({
  draft,
  sourceSet,
}: ProjectEditorialDraftInput): DoseDocument {
  const headline = draft.blocks.find(({ kind }) => kind === "headline");
  const deck = draft.blocks.find(({ kind }) => kind === "deck");
  if (!headline || !deck) throw new Error("Editorial projection requires headline and deck blocks");

  const contentBlocks = draft.blocks.filter(({ kind }) => !["headline", "deck"].includes(kind));
  const quantitativeClaims = draft.blocks.flatMap((block) =>
    block.claims.flatMap((claim) =>
      claim.quantitativeClaims.map((quantitative) => ({ claim, quantitative })),
    ),
  );
  const references = sourceReferences(sourceSet);
  if (!quantitativeClaims.length || !references.length)
    throw new Error(
      "Editorial projection requires grounded numbers and a supported source reference",
    );

  const contextualBlocks = contentBlocks.filter(({ kind }) =>
    [
      "scientific_context",
      "mechanistic_context",
      "interpretation",
      "limitations",
      "what_this_adds",
      "contextual_explainer",
      "source_boundary",
    ].includes(kind),
  );
  const fallbackContext = contextualBlocks[0] ?? contentBlocks[0];
  if (!fallbackContext) throw new Error("Editorial projection requires at least one content block");

  return doseDocumentSchema.parse({
    schemaVersion: "dose-document.v1",
    id: `dose:${draft.id}:experimental-projection-v1`,
    articleId: draft.articleId,
    language: "pt-BR",
    label: "Edição editorial Dose",
    headline: headline.claims.map(({ text }) => text).join(" "),
    deck: deck.claims.map(({ text }) => text).join(" "),
    openingSummary: [headline, deck].map((block, index) => ({
      id: `experimental-opening-${index + 1}`,
      text: block.claims.map(({ text }) => text).join(" "),
      factIds: facts(block),
    })),
    chapters: contentBlocks.map((block, index) => ({
      id: `experimental-chapter-${index + 1}`,
      title: block.title ?? chapterTitles[block.kind],
      blocks: [
        {
          id: `experimental-block-${index + 1}`,
          kind: "prose",
          paragraphs: block.claims.map(({ text }) => text),
          factIds: facts(block),
        },
      ],
    })),
    keyNumbers: quantitativeClaims.map(({ claim, quantitative }, index) => ({
      id: `experimental-number-${index + 1}`,
      value: `${String(quantitative.value).replace("-", "−")} ${quantitative.unit}`,
      label:
        chapterTitles[
          draft.blocks.find((block) => block.claims.includes(claim))?.kind ?? "primary_result"
        ],
      context: "Valor declarado e vinculado ao fact indicado pelo draft experimental",
      factIds: [quantitative.factId],
    })),
    contextualExplainers: (contextualBlocks.length ? contextualBlocks : [fallbackContext]).map(
      (block, index) => ({
        id: `experimental-explainer-${index + 1}`,
        title: block.title ?? chapterTitles[block.kind],
        body: block.claims.map(({ text }) => text).join(" "),
        factIds: facts(block),
      }),
    ),
    sourceCoverage: {
      id: "experimental-source-coverage",
      basedOn: sourceSet.coverage.sourceKinds.filter(
        (kind): kind is "metadata" | "abstract" => kind === "metadata" || kind === "abstract",
      ),
      notCovered: sourceSet.coverage.hasAuthorizedFullText
        ? ["fontes ausentes do conjunto autorizado"]
        : ["texto completo", "tabelas", "figuras", "suplementos"],
      statement: sourceSet.coverage.hasAuthorizedFullText
        ? "A projeção usa somente o conjunto de fontes autorizado."
        : "A projeção experimental usa somente o abstract autorizado e não representa revisão do texto completo.",
    },
    sourceReferences: references,
  });
}
