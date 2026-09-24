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

const articleId = "pmid:42717033";
const sourceDocumentId = "pmid:42717033:abstract:v1";

export const pmid42717033SourceDocument = sourceDocumentSchema.parse({
  schemaVersion: "source-document.v1",
  id: sourceDocumentId,
  articleId,
  sourceKind: "abstract",
  provider: "pubmed",
  externalIdentifier: { scheme: "pmid", value: "42717033" },
  language: "en",
  sourceVersion: { status: "available", value: "1" },
  sourceDate: { status: "available", value: "2026-09" },
  accessScope: "abstract",
  textStorage: "anchors_only",
  retrievedAt: "2026-09-23T00:00:00Z",
  checksum: {
    status: "available",
    value: {
      algorithm: "sha256",
      value: "64725d3c6c240567a25a9c6ff06f8ad2cc1f4f553aec550b4c77cee131540164",
    },
  },
});

const excerpts = {
  mechanism:
    "Myeloperoxidase (MPO)-derived oxidants reduce nitric oxide bioavailability and promote coronary microvascular dysfunction, cardiomyocyte stiffening and interstitial fibrosis-mechanisms implicated in the pathogenesis of heart failure with preserved and mildly reduced ejection fraction.",
  design:
    "Here, in a multicenter, randomized, double-blind, placebo-controlled, three-arm, parallel-group phase 2b trial of patients with heart failure and an ejection fraction of >40%, we evaluated whether treatment with the MPO inhibitor mitiperstat versus placebo for 48 weeks improved symptoms and exercise function at 16 weeks (the co-primary endpoints were the Kansas City Cardiomyopathy Questionnaire Total Symptom Score (KCCQ-TSS) and 6-minute walk distance (6MWD)).",
  population:
    "In total, 711 patients (45% women) were randomized 1:1:1 to mitiperstat 2.5 mg, mitiperstat 5 mg or placebo.",
  results:
    "Mitiperstat (pooled doses) did not improve KCCQ-TSS (placebo-corrected difference in mean change from baseline, -1.4 points (95% confidence interval (CI) -3.9, 1.2; P = 0.29), 6MWD (3.8 m (95% CI -3.1, 10.8)); P = 0.28) or any secondary endpoint.",
  safety:
    "Adverse and serious adverse events, including infections, were similar among groups except for maculopapular rash (mitiperstat, 3.6%; placebo, 0.4%).",
  registry: "ClinicalTrials.gov registration: NCT04986202.",
} as const;

export const pmid42717033EvidenceAnchors = Object.entries(excerpts).map(([name, excerpt]) =>
  evidenceAnchorSchema.parse({
    schemaVersion: "evidence-anchor.v1",
    id: `pmid:42717033:abstract:${name}`,
    sourceDocumentId,
    section: "abstract",
    locator: { kind: "structured_field", path: `Abstract.AbstractText[${name}]` },
    offsets: { status: "requires_additional_source" },
    excerpt: { status: "available", value: excerpt },
    sourceLanguage: "en",
    contentHash: { status: "requires_additional_source" },
  }),
);

type RctValue = Extract<ScientificFact["availability"], { status: "available" }>["value"];

function sourceFact(id: string, anchor: keyof typeof excerpts, value: RctValue): ScientificFact {
  return scientificFactSchema.parse({
    schemaVersion: "scientific-fact.v1",
    id: `pmid:42717033:${id}`,
    articleId,
    studyType: "randomized_controlled_trial",
    factType: value.type,
    availability: { status: "available", value },
    origin: { kind: "source" },
    provenance: [
      {
        target: { kind: "evidence_anchor", id: `pmid:42717033:abstract:${anchor}` },
        relation: "supports",
      },
    ],
  });
}

const designFacts: Array<[string, RctValue]> = [
  ["design-randomized", { type: "study_design_feature", feature: "randomized", value: true }],
  ["design-multicenter", { type: "study_design_feature", feature: "multicenter", value: true }],
  ["design-placebo", { type: "study_design_feature", feature: "placebo_controlled", value: true }],
  ["design-parallel", { type: "study_design_feature", feature: "parallel_groups", value: true }],
  ["design-blinding", { type: "blinding", value: "double_blind" }],
  ["design-phase", { type: "phase", value: "phase_2b" }],
];

const mechanismFacts: Array<[string, RctValue]> = [
  [
    "mpo-oxidants",
    {
      type: "mechanism_relation",
      subjectConcept: "MPO",
      relation: "derives",
      objectConcept: "oxidants",
    },
  ],
  [
    "mpo-no",
    {
      type: "mechanism_relation",
      subjectConcept: "MPO-derived oxidants",
      relation: "reduces",
      objectConcept: "nitric oxide bioavailability",
    },
  ],
  [
    "mpo-microvascular",
    {
      type: "mechanism_relation",
      subjectConcept: "MPO-derived oxidants",
      relation: "promotes",
      objectConcept: "coronary microvascular dysfunction",
    },
  ],
  [
    "mpo-stiffening",
    {
      type: "mechanism_relation",
      subjectConcept: "MPO-derived oxidants",
      relation: "promotes",
      objectConcept: "cardiomyocyte stiffening",
    },
  ],
  [
    "mpo-fibrosis",
    {
      type: "mechanism_relation",
      subjectConcept: "MPO-derived oxidants",
      relation: "promotes",
      objectConcept: "interstitial fibrosis",
    },
  ],
  [
    "mitiperstat-mpo",
    {
      type: "mechanism_relation",
      subjectConcept: "mitiperstat",
      relation: "inhibits",
      objectConcept: "MPO",
    },
  ],
];

const armRefs = [
  { armId: "mitiperstat-2.5-mg", role: "intervention" as const },
  { armId: "mitiperstat-5-mg", role: "intervention" as const },
  { armId: "placebo", role: "comparator" as const },
];

export const pmid42717033ScientificFacts: ScientificFact[] = [
  ...mechanismFacts.map(([factId, value]) => sourceFact(factId, "mechanism", value)),
  ...designFacts.map(([factId, value]) => sourceFact(factId, "design", value)),
  sourceFact("condition", "design", {
    type: "population_condition",
    condition: "heart failure with preserved or mildly reduced ejection fraction",
  }),
  sourceFact("ef-eligibility", "design", {
    type: "eligibility",
    criterion: "left ventricular ejection fraction",
    operator: "greater_than",
    value: { value: 40, unit: "percent" },
  }),
  sourceFact("sample-size", "population", { type: "population_sample_size", value: 711 }),
  sourceFact("women", "population", {
    type: "population_characteristic",
    characteristic: "women",
    value: { value: 45, unit: "percent" },
    denominator: { status: "not_reported_in_source" },
  }),
  sourceFact("arm-low-dose", "population", {
    type: "arm",
    armId: "mitiperstat-2.5-mg",
    label: "mitiperstat 2.5 mg",
    intervention: "mitiperstat",
    dose: { status: "available", value: { value: 2.5, unit: "mg" } },
    comparator: false,
  }),
  sourceFact("arm-high-dose", "population", {
    type: "arm",
    armId: "mitiperstat-5-mg",
    label: "mitiperstat 5 mg",
    intervention: "mitiperstat",
    dose: { status: "available", value: { value: 5, unit: "mg" } },
    comparator: false,
  }),
  sourceFact("arm-placebo", "population", {
    type: "arm",
    armId: "placebo",
    label: "placebo",
    intervention: "placebo",
    dose: { status: "not_applicable" },
    comparator: true,
  }),
  sourceFact("allocation", "population", {
    type: "allocation_ratio",
    allocations: [
      { armId: "mitiperstat-2.5-mg", parts: 1 },
      { armId: "mitiperstat-5-mg", parts: 1 },
      { armId: "placebo", parts: 1 },
    ],
  }),
  sourceFact("treatment-duration", "design", {
    type: "treatment_duration",
    duration: { value: 48, unit: "week" },
  }),
  sourceFact("endpoint-kccq", "design", {
    type: "endpoint",
    endpointId: "kccq-tss",
    name: "Kansas City Cardiomyopathy Questionnaire Total Symptom Score",
    role: "co_primary",
    measure: "KCCQ-TSS change from baseline",
    timepoint: { value: 16, unit: "week" },
  }),
  sourceFact("endpoint-6mwd", "design", {
    type: "endpoint",
    endpointId: "6mwd",
    name: "6-minute walk distance",
    role: "co_primary",
    measure: "6MWD change from baseline",
    timepoint: { value: 16, unit: "week" },
  }),
  sourceFact("result-kccq", "results", {
    type: "result",
    endpointId: "kccq-tss",
    arms: armRefs,
    pooling: { status: "pooled", pooledArmIds: ["mitiperstat-2.5-mg", "mitiperstat-5-mg"] },
    estimate: {
      measureType: "placebo_corrected_mean_change",
      value: -1.4,
      unit: "point",
      confidenceInterval: {
        status: "available",
        value: { lower: -3.9, upper: 1.2, levelPercent: 95 },
      },
      pValue: { status: "available", value: { operator: "equal", value: 0.29 } },
    },
    timepoint: { value: 16, unit: "week" },
  }),
  sourceFact("result-6mwd", "results", {
    type: "result",
    endpointId: "6mwd",
    arms: armRefs,
    pooling: { status: "pooled", pooledArmIds: ["mitiperstat-2.5-mg", "mitiperstat-5-mg"] },
    estimate: {
      measureType: "placebo_corrected_mean_change",
      value: 3.8,
      unit: "m",
      confidenceInterval: {
        status: "available",
        value: { lower: -3.1, upper: 10.8, levelPercent: 95 },
      },
      pValue: { status: "available", value: { operator: "equal", value: 0.28 } },
    },
    timepoint: { value: 16, unit: "week" },
  }),
  sourceFact("safety-general", "safety", {
    type: "safety_comparison",
    scope: "adverse and serious adverse events, including infections",
    arms: armRefs,
    finding: "similar",
  }),
  sourceFact("rash-mitiperstat", "safety", {
    type: "safety_event",
    event: "maculopapular rash",
    arms: armRefs.filter((arm) => arm.role === "intervention"),
    frequency: { value: 3.6, unit: "percent" },
    denominator: { status: "not_reported_in_source" },
    severity: { status: "not_reported_in_source" },
  }),
  sourceFact("rash-placebo", "safety", {
    type: "safety_event",
    event: "maculopapular rash",
    arms: [{ armId: "placebo", role: "comparator" }],
    frequency: { value: 0.4, unit: "percent" },
    denominator: { status: "not_reported_in_source" },
    severity: { status: "not_reported_in_source" },
  }),
  sourceFact("registry", "registry", {
    type: "registry_identifier",
    registry: "ClinicalTrials.gov",
    identifier: "NCT04986202",
  }),
];

export const pmid42717033SourceSet = scientificSourceSetSchema.parse({
  version: "scientific-source-set.v1",
  id: "pmid:42717033:sources:v1",
  articleId,
  sourceDocuments: [pmid42717033SourceDocument],
  primarySourceDocumentIds: [sourceDocumentId],
  coverage: { sourceKinds: ["abstract"], hasAuthorizedFullText: false },
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid42717033EvidenceSet = scientificEvidenceSetSchema.parse({
  version: "scientific-evidence-set.v1",
  id: "pmid:42717033:evidence:v1",
  articleId,
  sourceSet: { id: pmid42717033SourceSet.id, version: pmid42717033SourceSet.version },
  anchors: pmid42717033EvidenceAnchors,
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid42717033FactSet = rctScientificFactSetSchema.parse({
  version: "rct-scientific-fact-set.v1",
  id: "pmid:42717033:rct-facts:v1",
  articleId,
  scientificGrammar: "rct.v1",
  sourceSet: { id: pmid42717033SourceSet.id, version: pmid42717033SourceSet.version },
  evidenceSet: { id: pmid42717033EvidenceSet.id, version: pmid42717033EvidenceSet.version },
  facts: pmid42717033ScientificFacts,
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid42717033Interpretation = scientificInterpretationArtifactSchema.parse({
  version: "scientific-interpretation.v1",
  id: "pmid:42717033:interpretation:v1",
  articleId,
  sourceSet: { id: pmid42717033SourceSet.id, version: pmid42717033SourceSet.version },
  factSet: { id: pmid42717033FactSet.id, version: pmid42717033FactSet.version },
  claims: [
    {
      id: "pmid:42717033:interpretation:coprimary-results",
      claimType: "statistical_interpretation",
      statement: "The reported confidence intervals for both co-primary results include zero.",
      provenanceBasis: "deterministic_rule",
      inputFactIds: ["pmid:42717033:result-kccq", "pmid:42717033:result-6mwd"],
      externalContextReferences: [],
      method: { name: "confidence-interval-zero-inclusion", version: "1" },
      qualifiers: ["limited_to_reported_co_primary_results"],
      prohibitedExtrapolations: ["do_not_infer_equivalence", "do_not_infer_individual_dose_effect"],
      operationalStatus: "ready_for_review",
      requiresHumanReview: true,
      reviewStatus: "pending",
    },
    {
      id: "pmid:42717033:interpretation:source-boundary",
      claimType: "source_boundary",
      statement: "This artifact is supported by the abstract source represented in the source set.",
      provenanceBasis: "article_supported",
      inputFactIds: ["pmid:42717033:design-randomized"],
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
