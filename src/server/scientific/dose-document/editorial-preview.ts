import type { ScientificArticleDetail } from "../article-detail";
import {
  pmid41910396EvidenceAnchors,
  pmid41910396EvidenceSet,
  pmid41910396FactSet,
  pmid41910396Interpretation,
  pmid41910396SourceSet,
} from "../knowledge-representation/pmid-41910396.fixture";
import {
  pmid42670964EvidenceAnchors,
  pmid42670964EvidenceSet,
  pmid42670964FactSet,
  pmid42670964Interpretation,
  pmid42670964SourceSet,
} from "../knowledge-representation/pmid-42670964.fixture";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "../knowledge-representation/pmid-42717033.fixture";
import type {
  ScientificInterpretationArtifact,
  ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import type { DoseDocument } from "./contracts";
import { createPmid42717033DoseDocument } from "./pmid-42717033";
import { composeRctDoseDocument } from "./rct-composer";

export type PreviewPmid = "42717033" | "41910396" | "42670964";
export type PreviewVersion = "approved" | "generic";

function titleFromAnchors(
  anchors: typeof pmid41910396EvidenceAnchors | typeof pmid42670964EvidenceAnchors,
) {
  const title = anchors.find(({ id }) => id.endsWith(":title"))?.excerpt;
  return title?.status === "available" ? title.value : null;
}

function previewArticle(pmid: PreviewPmid, title: string): ScientificArticleDetail {
  return {
    id: `internal-preview:${pmid}`,
    title,
    authors: [],
    journal: null,
    publisher: null,
    publishedAt: null,
    doi: null,
    pmid,
    pmcid: null,
    abstract: null,
    publicationTypes: [],
    studyType: "randomized_trial",
    classificationVersion: null,
    provenance: [
      {
        provider: "pubmed",
        externalId: pmid,
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      },
    ],
    sourceLinks: [
      {
        kind: "pubmed",
        label: "PubMed",
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      },
    ],
    topics: [],
    specialties: [],
  };
}

const articles = {
  "42717033": previewArticle("42717033", "Fonte científica indexada — PMID 42717033"),
  "41910396": previewArticle(
    "41910396",
    titleFromAnchors(pmid41910396EvidenceAnchors) ?? "PMID 41910396",
  ),
  "42670964": previewArticle(
    "42670964",
    titleFromAnchors(pmid42670964EvidenceAnchors) ?? "PMID 42670964",
  ),
} satisfies Record<PreviewPmid, ScientificArticleDetail>;

type PreviewDefinition = {
  pmid: PreviewPmid;
  shortLabel: string;
  article: ScientificArticleDetail;
  sourceSet: ScientificSourceSet;
  interpretation: ScientificInterpretationArtifact;
  genericDocument: DoseDocument;
  approvedDocument?: DoseDocument;
};

export const EDITORIAL_PREVIEWS: Record<PreviewPmid, PreviewDefinition> = {
  "42717033": {
    pmid: "42717033",
    shortLabel: "Mitiperstat",
    article: articles["42717033"],
    sourceSet: pmid42717033SourceSet,
    interpretation: pmid42717033Interpretation,
    genericDocument: composeRctDoseDocument({
      sourceSet: pmid42717033SourceSet,
      evidenceSet: pmid42717033EvidenceSet,
      factSet: pmid42717033FactSet,
      interpretation: pmid42717033Interpretation,
      metadata: articles["42717033"],
    }),
    approvedDocument: createPmid42717033DoseDocument(articles["42717033"]),
  },
  "41910396": {
    pmid: "41910396",
    shortLabel: "Iptacopan",
    article: articles["41910396"],
    sourceSet: pmid41910396SourceSet,
    interpretation: pmid41910396Interpretation,
    genericDocument: composeRctDoseDocument({
      sourceSet: pmid41910396SourceSet,
      evidenceSet: pmid41910396EvidenceSet,
      factSet: pmid41910396FactSet,
      interpretation: pmid41910396Interpretation,
      metadata: articles["41910396"],
    }),
  },
  "42670964": {
    pmid: "42670964",
    shortLabel: "Clopidogrel / DAPT",
    article: articles["42670964"],
    sourceSet: pmid42670964SourceSet,
    interpretation: pmid42670964Interpretation,
    genericDocument: composeRctDoseDocument({
      sourceSet: pmid42670964SourceSet,
      evidenceSet: pmid42670964EvidenceSet,
      factSet: pmid42670964FactSet,
      interpretation: pmid42670964Interpretation,
      metadata: articles["42670964"],
    }),
  },
};

export function resolveEditorialPreview(pmid: PreviewPmid, version: PreviewVersion) {
  const preview = EDITORIAL_PREVIEWS[pmid];
  return {
    ...preview,
    version: pmid === "42717033" ? version : ("generic" as const),
    document:
      pmid === "42717033" && version === "approved"
        ? (preview.approvedDocument as DoseDocument)
        : preview.genericDocument,
  };
}
