import {
  evidenceAnchorSchema,
  scientificFactSchema,
  sourceDocumentSchema,
  type ScientificFact,
} from "./contracts";
import {
  rctScientificFactSetSchema,
  scientificEvidenceSetSchema,
  scientificInterpretationArtifactSchema,
  scientificSourceSetSchema,
} from "./editorial-pipeline";

const articleId = "pmid:41910396";
const sourceDocumentId = "pmid:41910396:abstract:v1";

export const pmid41910396SourceDocument = sourceDocumentSchema.parse({
  schemaVersion: "source-document.v1",
  id: sourceDocumentId,
  articleId,
  sourceKind: "abstract",
  provider: "pubmed",
  externalIdentifier: { scheme: "pmid", value: "41910396" },
  language: "eng",
  sourceVersion: { status: "available", value: "1" },
  sourceDate: { status: "available", value: "2026-07-30" },
  accessScope: "abstract",
  textStorage: "anchors_only",
  retrievedAt: "2026-09-24T00:00:00Z",
  checksum: {
    status: "available",
    value: {
      algorithm: "sha256",
      value: "8a01d1d3889cbd0ccdf010cfe239a7cd314b87fe578040325ef1138b4bc17589",
    },
  },
});

const excerpts = {
  title: "Iptacopan in IgA Nephropathy - Final 24-Month Data.",
  design:
    "In this phase 3 trial, we enrolled adults who had IgA nephropathy, an estimated glomerular filtration rate (eGFR) of at least 30 ml per minute per 1.73 m2 of body-surface area, and a 24-hour urinary protein-to-creatinine ratio of 1 or higher (with protein and creatinine both measured in grams) despite supportive care.",
  arms: "Patients were randomly assigned, in a 1:1 ratio, to receive oral iptacopan (200 mg) or placebo twice daily.",
  endpoints:
    "The primary end point for the final analysis was the annualized total eGFR slope as estimated over a 24-month period.",
  composite:
    "Secondary end points included a composite kidney-failure end point (i.e., a sustained decline in eGFR of ≥30%, a sustained eGFR of <15 ml per minute per 1.73 m2, the initiation of maintenance dialysis, receipt of kidney transplant, or death from kidney failure), assessed in a time-to-event analysis.",
  population:
    "Among 477 patients included in the final analysis, 238 had been randomly assigned to iptacopan and 239 to placebo.",
  compositeResult:
    "A composite kidney-failure end-point event occurred in 21.4% of the patients in the iptacopan group, as compared with 33.5% of those in the placebo group (hazard ratio, 0.57; 95% CI, 0.40 to 0.81; adjusted P = 0.003).",
  safety:
    "The incidence of adverse events was 87.0% in the iptacopan group and 89.1% in the placebo group. Serious adverse events occurred in 12.2% of the patients who received iptacopan and in 11.7% of those who received placebo, and serious infections in 6.7% and 2.1%, respectively. No deaths occurred.",
  registry: "(Funded by Novartis; APPLAUSE-IgAN ClinicalTrials.gov number, NCT04578834.).",
} as const;

const excerptHashes: Record<keyof typeof excerpts, string> = {
  title: "f9e483a0876a80b7393ce36f60b3e0a97f4b6943a59504522a907bd41a605c49",
  design: "c83d68870e42326d29f18ba06412e32e03eaaecf87ccae731e32dfe10c04139c",
  arms: "389520251b655430d93bab17eaf26ce673a51bbc98261e709ea466d717739f2e",
  endpoints: "77d219639a835a43c410ceadc8e5f55906ea97f77745c77a1d30488a312ea1f3",
  composite: "4cc5354398b7b30d1fb7c1c100df556a0b93a30437cca7b229e6128407b87fd0",
  population: "08ca26bb8b7107325de1301a8d9688e37bc953fa5f3bedc9c117476abe298eaa",
  compositeResult: "94d694aad5057967a7fd1b7f9fc509a203317cf7876395d06c59aba56d44cd02",
  safety: "b0f17393c05f89c2c374cf1cac1d6191d92ea8d44e0d9653a6ea11a9235991e2",
  registry: "2a97b11fa3a6b451eb89cd87df26aba0680fb835d83b3b1f358ec043b4a7263a",
};

export const pmid41910396EvidenceAnchors = Object.entries(excerpts).map(([name, excerpt]) =>
  evidenceAnchorSchema.parse({
    schemaVersion: "evidence-anchor.v1",
    id: `pmid:41910396:abstract:${name}`,
    sourceDocumentId,
    section: name === "title" ? "metadata" : "abstract",
    locator: {
      kind: "structured_field",
      path: name === "title" ? "Article.ArticleTitle" : `Abstract.AbstractText[${name}]`,
    },
    offsets: { status: "requires_additional_source" },
    excerpt: { status: "available", value: excerpt },
    sourceLanguage: "eng",
    contentHash: {
      status: "available",
      value: { algorithm: "sha256", value: excerptHashes[name as keyof typeof excerpts] },
    },
  }),
);

type RctValue = Extract<ScientificFact["availability"], { status: "available" }>["value"];

function sourceFact(
  id: string,
  anchor: keyof typeof excerpts,
  value: RctValue,
  additionalAnchors: Array<keyof typeof excerpts> = [],
): ScientificFact {
  return scientificFactSchema.parse({
    schemaVersion: "scientific-fact.v1",
    id: `pmid:41910396:${id}`,
    articleId,
    studyType: "randomized_controlled_trial",
    factType: value.type,
    availability: { status: "available", value },
    origin: { kind: "source" },
    provenance: [anchor, ...additionalAnchors].map((anchorName) => ({
      target: { kind: "evidence_anchor", id: `pmid:41910396:abstract:${anchorName}` },
      relation: "supports",
    })),
  });
}

const armRefs = [
  { armId: "iptacopan", role: "intervention" as const },
  { armId: "placebo", role: "comparator" as const },
];

const safetyEvent = (
  id: string,
  event: string,
  armId: "iptacopan" | "placebo",
  frequency: number,
) =>
  sourceFact(id, "safety", {
    type: "safety_event",
    event,
    arms: [{ armId, role: armId === "iptacopan" ? "intervention" : "comparator" }],
    frequency: { value: frequency, unit: "percent" },
    denominator: { status: "not_reported_in_source" },
    severity: { status: "not_reported_in_source" },
  });

export const pmid41910396ScientificFacts: ScientificFact[] = [
  sourceFact("design-randomized", "arms", {
    type: "study_design_feature",
    feature: "randomized",
    value: true,
  }),
  sourceFact("design-placebo", "arms", {
    type: "study_design_feature",
    feature: "placebo_controlled",
    value: true,
  }),
  sourceFact("design-phase", "design", { type: "phase", value: "phase_3" }),
  sourceFact("condition", "design", {
    type: "population_condition",
    condition: "IgA nephropathy",
    criterion: "adults receiving supportive care",
  }),
  sourceFact("egfr-eligibility", "design", {
    type: "eligibility",
    criterion: "estimated glomerular filtration rate",
    operator: "greater_than_or_equal",
    value: { value: 30, unit: "ml/min/1.73 m2" },
  }),
  sourceFact("upcr-eligibility", "design", {
    type: "eligibility",
    criterion: "24-hour urinary protein-to-creatinine ratio",
    operator: "greater_than_or_equal",
    value: { value: 1, unit: "g/g" },
  }),
  sourceFact("sample-size", "population", { type: "population_sample_size", value: 477 }),
  sourceFact("arm-iptacopan", "arms", {
    type: "arm",
    armId: "iptacopan",
    label: "oral iptacopan 200 mg twice daily",
    intervention: "iptacopan",
    dose: { status: "available", value: { value: 200, unit: "mg" } },
    comparator: false,
  }),
  sourceFact("arm-placebo", "arms", {
    type: "arm",
    armId: "placebo",
    label: "placebo twice daily",
    intervention: "placebo",
    dose: { status: "not_applicable" },
    comparator: true,
  }),
  sourceFact("allocation", "arms", {
    type: "allocation_ratio",
    allocations: [
      { armId: "iptacopan", parts: 1 },
      { armId: "placebo", parts: 1 },
    ],
  }),
  sourceFact("endpoint-egfr-slope", "endpoints", {
    type: "endpoint",
    endpointId: "annualized-total-egfr-slope",
    name: "annualized total eGFR slope",
    role: "primary",
    measure: "annualized total eGFR slope over the final analysis period",
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact(
    "endpoint-kidney-failure",
    "composite",
    {
      type: "endpoint",
      endpointId: "composite-kidney-failure",
      name: "composite kidney-failure end point",
      role: "secondary",
      measure:
        "time to sustained eGFR decline ≥30%, sustained eGFR <15 ml/min/1.73 m2, maintenance dialysis, kidney transplant, or death from kidney failure",
      timepoint: { value: 24, unit: "month" },
    },
    ["title"],
  ),
  sourceFact(
    "result-kidney-failure-hr",
    "compositeResult",
    {
      type: "result",
      endpointId: "composite-kidney-failure",
      arms: armRefs,
      pooling: { status: "not_pooled" },
      estimate: {
        measureType: "hazard_ratio",
        value: 0.57,
        unit: "ratio",
        confidenceInterval: {
          status: "available",
          value: { lower: 0.4, upper: 0.81, levelPercent: 95 },
        },
        pValue: { status: "available", value: { operator: "equal", value: 0.003 } },
      },
      timepoint: { value: 24, unit: "month" },
    },
    ["title"],
  ),
  safetyEvent("adverse-events-iptacopan", "adverse events", "iptacopan", 87),
  safetyEvent("adverse-events-placebo", "adverse events", "placebo", 89.1),
  safetyEvent("serious-adverse-events-iptacopan", "serious adverse events", "iptacopan", 12.2),
  safetyEvent("serious-adverse-events-placebo", "serious adverse events", "placebo", 11.7),
  safetyEvent("serious-infections-iptacopan", "serious infections", "iptacopan", 6.7),
  safetyEvent("serious-infections-placebo", "serious infections", "placebo", 2.1),
  sourceFact("deaths", "safety", {
    type: "safety_event",
    event: "death",
    arms: armRefs,
    frequency: { value: 0, unit: "event" },
    denominator: { status: "not_reported_in_source" },
    severity: { status: "not_applicable" },
  }),
  sourceFact("registry", "registry", {
    type: "registry_identifier",
    registry: "ClinicalTrials.gov",
    identifier: "NCT04578834",
  }),
];

export const pmid41910396SourceSet = scientificSourceSetSchema.parse({
  version: "scientific-source-set.v1",
  id: "pmid:41910396:sources:v1",
  articleId,
  sourceDocuments: [pmid41910396SourceDocument],
  primarySourceDocumentIds: [sourceDocumentId],
  coverage: { sourceKinds: ["abstract"], hasAuthorizedFullText: false },
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid41910396EvidenceSet = scientificEvidenceSetSchema.parse({
  version: "scientific-evidence-set.v1",
  id: "pmid:41910396:evidence:v1",
  articleId,
  sourceSet: { id: pmid41910396SourceSet.id, version: pmid41910396SourceSet.version },
  anchors: pmid41910396EvidenceAnchors,
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid41910396FactSet = rctScientificFactSetSchema.parse({
  version: "rct-scientific-fact-set.v1",
  id: "pmid:41910396:rct-facts:v1",
  articleId,
  scientificGrammar: "rct.v1",
  sourceSet: { id: pmid41910396SourceSet.id, version: pmid41910396SourceSet.version },
  evidenceSet: { id: pmid41910396EvidenceSet.id, version: pmid41910396EvidenceSet.version },
  facts: pmid41910396ScientificFacts,
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid41910396Interpretation = scientificInterpretationArtifactSchema.parse({
  version: "scientific-interpretation.v1",
  id: "pmid:41910396:interpretation:v1",
  articleId,
  sourceSet: { id: pmid41910396SourceSet.id, version: pmid41910396SourceSet.version },
  factSet: { id: pmid41910396FactSet.id, version: pmid41910396FactSet.version },
  claims: [
    {
      id: "pmid:41910396:interpretation:composite-result",
      claimType: "statistical_interpretation",
      statement:
        "The reported hazard ratio for the secondary composite kidney-failure end point favored iptacopan, and its confidence interval excluded 1.",
      provenanceBasis: "deterministic_rule",
      inputFactIds: ["pmid:41910396:result-kidney-failure-hr"],
      externalContextReferences: [],
      method: { name: "ratio-effect-null-exclusion", version: "1" },
      qualifiers: ["secondary_composite_endpoint", "time_to_event_analysis"],
      prohibitedExtrapolations: [
        "do_not_infer_benefit_for_every_composite_component",
        "do_not_convert_hazard_ratio_to_absolute_risk_reduction",
        "do_not_relabel_secondary_endpoint_as_primary",
      ],
      operationalStatus: "ready_for_review",
      requiresHumanReview: true,
      reviewStatus: "pending",
    },
    {
      id: "pmid:41910396:interpretation:source-boundary",
      claimType: "source_boundary",
      statement:
        "This artifact is supported only by the PubMed abstract represented in the source set.",
      provenanceBasis: "article_supported",
      inputFactIds: ["pmid:41910396:design-randomized"],
      externalContextReferences: [],
      method: { name: "declared-source-coverage", version: "1" },
      qualifiers: ["abstract_only"],
      prohibitedExtrapolations: ["do_not_claim_full_text_review"],
      operationalStatus: "ready_for_review",
      requiresHumanReview: true,
      reviewStatus: "pending",
    },
  ],
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});
