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

const articleId = "pmid:42670964";
const sourceDocumentId = "pmid:42670964:abstract:v1";

export const pmid42670964SourceDocument = sourceDocumentSchema.parse({
  schemaVersion: "source-document.v1",
  id: sourceDocumentId,
  articleId,
  sourceKind: "abstract",
  provider: "pubmed",
  externalIdentifier: { scheme: "pmid", value: "42670964" },
  language: "eng",
  sourceVersion: { status: "available", value: "1" },
  sourceDate: { status: "available", value: "2026-08-29" },
  accessScope: "abstract",
  textStorage: "anchors_only",
  retrievedAt: "2026-09-25T00:00:00Z",
  checksum: {
    status: "available",
    value: {
      algorithm: "sha256",
      value: "13aa8a52da63b9aaf3a57b3701e80f3380f770defd5a762f108fdee26d138c3f",
    },
  },
});

const excerpts = {
  title: "Clopidogrel or Dual Antiplatelet Therapy in High-Ischemic-Risk Patients.",
  methodsDesign:
    "In this open-label noninferiority trial conducted in South Korea, we enrolled patients with high-risk clinical or lesion characteristics in whom a drug-eluting stent had been implanted 12 months earlier and randomly assigned them, in a 1:1 ratio, to receive clopidogrel monotherapy or extended DAPT (clopidogrel plus aspirin).",
  methodsEndpoints:
    "The primary end point was net adverse clinical events, a composite of death from any cause, myocardial infarction, stent thrombosis, stroke, or Bleeding Academic Research Consortium (BARC) type 2, 3, or 5 bleeding at 24 months (noninferiority margin, 2.3 percentage points). Key secondary ischemic and bleeding end points were tested in a prespecified hierarchical order.",
  primaryResult:
    "Of the 3203 patients who underwent randomization, 1601 were assigned to receive clopidogrel monotherapy and 1602 to receive extended DAPT. Over the course of 24 months, a primary end-point event occurred in 80 patients (5.0%) in the monotherapy group and in 81 (5.1%) in the DAPT group (risk difference, -0.1 percentage points; 90% confidence interval [CI], -1.3 to 1.2; P\u2009=\u20090.001 for noninferiority).",
  ischemic:
    "Death from any cause, myocardial infarction, stent thrombosis, or stroke (the key secondary ischemic end point) occurred in 60 patients (3.7%) in the monotherapy group and in 26 (1.6%) in the DAPT group (hazard ratio, 2.33; 95% CI, 1.47 to 3.69; P<0.001).",
  bleeding:
    "BARC type 2, 3, or 5 bleeding (the key secondary bleeding end point) occurred in 28 patients (1.8%) in the monotherapy group and in 65 (4.1%) in the DAPT group (hazard ratio, 0.43; 95% CI, 0.27 to 0.67; P<0.001).",
  safety: "The incidence of serious adverse events was similar in the two groups.",
  conclusion:
    "Among patients at high risk for ischemic events 12 months after drug-eluting stent implantation, clopidogrel monotherapy was noninferior to extended DAPT with respect to net adverse clinical events at 24 months.",
  registry:
    "(Funded by Chong Kun Dang and Samjin; A-CLOSE ClinicalTrials.gov number, NCT03947229.).",
} as const;

const excerptHashes: Record<keyof typeof excerpts, string> = {
  title: "1d53db71ddf23fc56d44e3405f45ac2ebbae4d0b328d4065ffcc8ee2a55b87da",
  methodsDesign: "f2beaa71b05bd6a549ae99d8869bd71aeb6b6e970b7ecb09666814607db3c09d",
  methodsEndpoints: "12dd20bb860b168a2ceb843eaf693338ddfc03d7c7f94ea271df419bc2c7d30d",
  primaryResult: "f9911867587799186c09c9f4585ee8a19ea4eb2301af0e038ab6c1e31acbea7e",
  ischemic: "d60c9b421680699670515f407278de74b569a766967628451d69623544207f07",
  bleeding: "eb97aeba73c523f29bbd65adf694eb1ea8d44ba988026092b266c3688242d73a",
  safety: "130b6e6aa64fbf8235a8beca71144939f97eb8212147cb762d95bb9eb325fe83",
  conclusion: "363238b55dfdd3a346c3194143c929be5ec6c53fff03382040eef00db17b1ad1",
  registry: "37c5be00c8b37cc68d986570c2f9496eef9e8357aefb16470be6da8bb85904f1",
};

export const pmid42670964EvidenceAnchors = Object.entries(excerpts).map(([name, excerpt]) =>
  evidenceAnchorSchema.parse({
    schemaVersion: "evidence-anchor.v1",
    id: `pmid:42670964:abstract:${name}`,
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
    id: `pmid:42670964:${id}`,
    articleId,
    studyType: "randomized_controlled_trial",
    factType: value.type,
    availability: { status: "available", value },
    origin: { kind: "source" },
    provenance: [anchor, ...additionalAnchors].map((anchorName) => ({
      target: { kind: "evidence_anchor", id: `pmid:42670964:abstract:${anchorName}` },
      relation: "supports",
    })),
  });
}

const armRefs = [
  { armId: "clopidogrel-monotherapy", role: "intervention" as const },
  { armId: "extended-dapt", role: "comparator" as const },
];

export const pmid42670964ObservedGaps = [
  {
    concept: "ischemia_bleeding_trade_off",
    classification: "B_INTERPRETATION_ONLY",
    sourceAnchorIds: ["pmid:42670964:abstract:ischemic", "pmid:42670964:abstract:bleeding"],
    reason:
      "rct.v1 keeps the outcomes separate but has no scientific rule for net benefit or strategy preference",
  },
  {
    concept: "superiority_after_noninferiority",
    classification: "E_NOT_NEEDED_FOR_V1",
    sourceAnchorIds: [],
    reason: "the PubMed abstract does not report a subsequent superiority test",
  },
] as const;

export const pmid42670964GapMatrix = {
  noninferiorityDesign: "A_REPRESENTABLE_AFTER_GENERALIZATION",
  noninferiorityMargin: "A_REPRESENTABLE_AFTER_GENERALIZATION",
  marginDirection: "A_REPRESENTABLE_AFTER_GENERALIZATION",
  estimateVsMarginRelationship: "A_REPRESENTABLE_AFTER_GENERALIZATION",
  superiorityAfterNoninferiority: "E_NOT_NEEDED_FOR_V1",
  compositeEndpointComponents: "A_REPRESENTABLE_AFTER_GENERALIZATION",
  ischemicOutcomes: "A_REPRESENTABLE_WITHOUT_CHANGE",
  bleedingOutcomes: "A_REPRESENTABLE_WITHOUT_CHANGE",
  tradeOffRepresentation: "B_INTERPRETATION_ONLY",
  armSpecificEstimates: "A_REPRESENTABLE_AFTER_GENERALIZATION",
  timeToEvent: "A_REPRESENTABLE_AFTER_GENERALIZATION",
  randomizedSampleSize: "A_REPRESENTABLE_WITHOUT_CHANGE",
  confidenceInterval: "A_REPRESENTABLE_WITHOUT_CHANGE",
  pValue: "A_REPRESENTABLE_WITHOUT_CHANGE",
  followUp: "A_REPRESENTABLE_WITHOUT_CHANGE",
} as const;

export const pmid42670964ScientificFacts: ScientificFact[] = [
  sourceFact("design-randomized", "methodsDesign", {
    type: "study_design_feature",
    feature: "randomized",
    value: true,
  }),
  sourceFact("design-parallel-groups", "methodsDesign", {
    type: "study_design_feature",
    feature: "parallel_groups",
    value: true,
  }),
  sourceFact("blinding", "methodsDesign", { type: "blinding", value: "open_label" }),
  sourceFact("condition", "methodsDesign", {
    type: "population_condition",
    condition: "high risk for recurrent ischemic events after drug-eluting stent implantation",
    criterion: "high-risk clinical or lesion characteristics 12 months after implantation",
  }),
  sourceFact("sample-size", "primaryResult", {
    type: "population_sample_size",
    value: 3203,
  }),
  sourceFact(
    "arm-clopidogrel",
    "methodsDesign",
    {
      type: "arm",
      armId: "clopidogrel-monotherapy",
      label: "clopidogrel monotherapy",
      intervention: "clopidogrel monotherapy",
      dose: { status: "not_reported_in_source" },
      comparator: false,
      randomizedSampleSize: 1601,
    },
    ["primaryResult"],
  ),
  sourceFact(
    "arm-dapt",
    "methodsDesign",
    {
      type: "arm",
      armId: "extended-dapt",
      label: "extended DAPT (clopidogrel plus aspirin)",
      intervention: "clopidogrel plus aspirin",
      dose: { status: "not_reported_in_source" },
      comparator: true,
      randomizedSampleSize: 1602,
    },
    ["primaryResult"],
  ),
  sourceFact("allocation", "methodsDesign", {
    type: "allocation_ratio",
    allocations: [
      { armId: "clopidogrel-monotherapy", parts: 1 },
      { armId: "extended-dapt", parts: 1 },
    ],
  }),
  sourceFact("treatment-duration", "methodsEndpoints", {
    type: "treatment_duration",
    duration: { value: 24, unit: "month" },
  }),
  sourceFact("endpoint-primary", "methodsEndpoints", {
    type: "endpoint",
    endpointId: "net-adverse-clinical-events",
    name: "net adverse clinical events",
    role: "primary",
    measure:
      "composite of death from any cause, myocardial infarction, stent thrombosis, stroke, or BARC type 2, 3, or 5 bleeding",
    timepoint: { value: 24, unit: "month" },
    components: [
      { componentId: "primary-death-from-any-cause", name: "death from any cause" },
      { componentId: "primary-myocardial-infarction", name: "myocardial infarction" },
      { componentId: "primary-stent-thrombosis", name: "stent thrombosis" },
      { componentId: "primary-stroke", name: "stroke" },
      {
        componentId: "primary-barc-2-3-or-5-bleeding",
        name: "BARC type 2, 3, or 5 bleeding",
      },
    ],
  }),
  sourceFact("endpoint-ischemic", "ischemic", {
    type: "endpoint",
    endpointId: "key-secondary-ischemic",
    name: "key secondary ischemic end point",
    role: "secondary",
    measure:
      "composite of death from any cause, myocardial infarction, stent thrombosis, or stroke",
    timepoint: { value: 24, unit: "month" },
    components: [
      { componentId: "ischemic-death-from-any-cause", name: "death from any cause" },
      { componentId: "ischemic-myocardial-infarction", name: "myocardial infarction" },
      { componentId: "ischemic-stent-thrombosis", name: "stent thrombosis" },
      { componentId: "ischemic-stroke", name: "stroke" },
    ],
  }),
  sourceFact("result-primary-risk-difference", "primaryResult", {
    type: "result",
    endpointId: "net-adverse-clinical-events",
    arms: armRefs,
    pooling: { status: "not_pooled" },
    estimate: {
      measureType: "risk_difference",
      value: -0.1,
      unit: "percentage_points",
      confidenceInterval: {
        status: "available",
        value: { lower: -1.3, upper: 1.2, levelPercent: 90 },
      },
      pValue: { status: "not_applicable" },
    },
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact(
    "hypothesis-primary-noninferiority",
    "methodsEndpoints",
    {
      type: "statistical_hypothesis",
      hypothesisType: "noninferiority",
      endpointId: "net-adverse-clinical-events",
      resultFactId: "pmid:42670964:result-primary-risk-difference",
      effectMeasure: "risk_difference",
      margin: { value: 2.3, unit: "percentage_points" },
      direction: "upper_bound_below_margin",
      confidenceLevelPercent: 90,
      decisionRule: {
        method: "confidence_interval_bound_vs_margin",
        bound: "upper",
        operator: "less_than",
      },
      conclusion: "noninferiority_met",
      pValue: {
        status: "available",
        value: { operator: "equal", value: 0.001, context: "noninferiority" },
      },
    },
    ["primaryResult", "conclusion"],
  ),
  sourceFact("arm-primary-clopidogrel", "primaryResult", {
    type: "arm_estimate",
    armId: "clopidogrel-monotherapy",
    endpointId: "net-adverse-clinical-events",
    eventCount: { status: "available", value: 80 },
    denominator: { status: "available", value: 1601 },
    estimate: { measureType: "percentage", value: 5.0, unit: "percent" },
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact("arm-primary-dapt", "primaryResult", {
    type: "arm_estimate",
    armId: "extended-dapt",
    endpointId: "net-adverse-clinical-events",
    eventCount: { status: "available", value: 81 },
    denominator: { status: "available", value: 1602 },
    estimate: { measureType: "percentage", value: 5.1, unit: "percent" },
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact("arm-ischemic-clopidogrel", "ischemic", {
    type: "arm_estimate",
    armId: "clopidogrel-monotherapy",
    endpointId: "key-secondary-ischemic",
    eventCount: { status: "available", value: 60 },
    denominator: { status: "not_reported_in_source" },
    estimate: { measureType: "percentage", value: 3.7, unit: "percent" },
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact("arm-ischemic-dapt", "ischemic", {
    type: "arm_estimate",
    armId: "extended-dapt",
    endpointId: "key-secondary-ischemic",
    eventCount: { status: "available", value: 26 },
    denominator: { status: "not_reported_in_source" },
    estimate: { measureType: "percentage", value: 1.6, unit: "percent" },
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact("result-ischemic-hazard-ratio", "ischemic", {
    type: "result",
    endpointId: "key-secondary-ischemic",
    arms: armRefs,
    pooling: { status: "not_pooled" },
    estimate: {
      measureType: "hazard_ratio",
      value: 2.33,
      unit: "ratio",
      confidenceInterval: {
        status: "available",
        value: { lower: 1.47, upper: 3.69, levelPercent: 95 },
      },
      pValue: { status: "available", value: { operator: "less_than", value: 0.001 } },
    },
    timepoint: { value: 24, unit: "month" },
    analysisType: "time_to_event",
  }),
  sourceFact("endpoint-bleeding", "bleeding", {
    type: "endpoint",
    endpointId: "key-secondary-bleeding",
    name: "key secondary bleeding end point",
    role: "secondary",
    measure: "BARC type 2, 3, or 5 bleeding",
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact("result-bleeding-hazard-ratio", "bleeding", {
    type: "result",
    endpointId: "key-secondary-bleeding",
    arms: armRefs,
    pooling: { status: "not_pooled" },
    estimate: {
      measureType: "hazard_ratio",
      value: 0.43,
      unit: "ratio",
      confidenceInterval: {
        status: "available",
        value: { lower: 0.27, upper: 0.67, levelPercent: 95 },
      },
      pValue: { status: "available", value: { operator: "less_than", value: 0.001 } },
    },
    timepoint: { value: 24, unit: "month" },
    analysisType: "time_to_event",
  }),
  sourceFact("arm-bleeding-clopidogrel", "bleeding", {
    type: "arm_estimate",
    armId: "clopidogrel-monotherapy",
    endpointId: "key-secondary-bleeding",
    eventCount: { status: "available", value: 28 },
    denominator: { status: "not_reported_in_source" },
    estimate: { measureType: "percentage", value: 1.8, unit: "percent" },
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact("arm-bleeding-dapt", "bleeding", {
    type: "arm_estimate",
    armId: "extended-dapt",
    endpointId: "key-secondary-bleeding",
    eventCount: { status: "available", value: 65 },
    denominator: { status: "not_reported_in_source" },
    estimate: { measureType: "percentage", value: 4.1, unit: "percent" },
    timepoint: { value: 24, unit: "month" },
  }),
  sourceFact("serious-adverse-events", "safety", {
    type: "safety_comparison",
    scope: "serious adverse events",
    arms: armRefs,
    finding: "similar",
  }),
  sourceFact("registry", "registry", {
    type: "registry_identifier",
    registry: "ClinicalTrials.gov",
    identifier: "NCT03947229",
  }),
];

export const pmid42670964SourceSet = scientificSourceSetSchema.parse({
  version: "scientific-source-set.v1",
  id: "pmid:42670964:sources:v1",
  articleId,
  sourceDocuments: [pmid42670964SourceDocument],
  primarySourceDocumentIds: [sourceDocumentId],
  coverage: { sourceKinds: ["abstract"], hasAuthorizedFullText: false },
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid42670964EvidenceSet = scientificEvidenceSetSchema.parse({
  version: "scientific-evidence-set.v1",
  id: "pmid:42670964:evidence:v1",
  articleId,
  sourceSet: { id: pmid42670964SourceSet.id, version: pmid42670964SourceSet.version },
  anchors: pmid42670964EvidenceAnchors,
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid42670964FactSet = rctScientificFactSetSchema.parse({
  version: "rct-scientific-fact-set.v1",
  id: "pmid:42670964:rct-facts:v1",
  articleId,
  scientificGrammar: "rct.v1",
  sourceSet: { id: pmid42670964SourceSet.id, version: pmid42670964SourceSet.version },
  evidenceSet: { id: pmid42670964EvidenceSet.id, version: pmid42670964EvidenceSet.version },
  facts: pmid42670964ScientificFacts,
  validation: { status: "valid", validatedBy: "fixture-review-v1" },
});

export const pmid42670964Interpretation = scientificInterpretationArtifactSchema.parse({
  version: "scientific-interpretation.v1",
  id: "pmid:42670964:interpretation:v1",
  articleId,
  sourceSet: { id: pmid42670964SourceSet.id, version: pmid42670964SourceSet.version },
  factSet: { id: pmid42670964FactSet.id, version: pmid42670964FactSet.version },
  claims: [
    {
      id: "pmid:42670964:interpretation:primary-noninferiority",
      claimType: "statistical_interpretation",
      statement:
        "For the primary composite end point, the upper bound of the reported 90% confidence interval for the risk difference was below the prespecified 2.3-percentage-point margin, meeting the declared noninferiority rule.",
      provenanceBasis: "deterministic_rule",
      inputFactIds: [
        "pmid:42670964:result-primary-risk-difference",
        "pmid:42670964:hypothesis-primary-noninferiority",
      ],
      externalContextReferences: [],
      method: { name: "noninferiority-upper-ci-bound-vs-margin", version: "1" },
      qualifiers: ["primary_composite_endpoint", "noninferiority_only"],
      prohibitedExtrapolations: [
        "do_not_infer_equivalence",
        "do_not_infer_superiority",
        "do_not_infer_equal_treatments",
        "do_not_infer_strategy_preference",
      ],
      operationalStatus: "ready_for_review",
      requiresHumanReview: true,
      reviewStatus: "pending",
    },
    {
      id: "pmid:42670964:interpretation:ischemic-result",
      claimType: "statistical_interpretation",
      statement:
        "The reported hazard ratio for the key secondary ischemic composite was above 1, and its 95% confidence interval excluded 1.",
      provenanceBasis: "deterministic_rule",
      inputFactIds: ["pmid:42670964:result-ischemic-hazard-ratio"],
      externalContextReferences: [],
      method: { name: "ratio-effect-null-exclusion", version: "1" },
      qualifiers: ["secondary_composite_endpoint", "time_to_event_measure"],
      prohibitedExtrapolations: [
        "do_not_infer_effect_for_every_composite_component",
        "do_not_infer_net_clinical_benefit",
        "do_not_infer_strategy_preference",
      ],
      operationalStatus: "ready_for_review",
      requiresHumanReview: true,
      reviewStatus: "pending",
    },
    {
      id: "pmid:42670964:interpretation:bleeding-result",
      claimType: "statistical_interpretation",
      statement:
        "The reported hazard ratio for the key secondary bleeding end point was below 1, and its 95% confidence interval excluded 1.",
      provenanceBasis: "deterministic_rule",
      inputFactIds: ["pmid:42670964:result-bleeding-hazard-ratio"],
      externalContextReferences: [],
      method: { name: "ratio-effect-null-exclusion", version: "1" },
      qualifiers: ["secondary_endpoint", "time_to_event_measure"],
      prohibitedExtrapolations: [
        "do_not_infer_net_clinical_benefit",
        "do_not_infer_strategy_preference",
        "do_not_relabel_as_overall_safety",
      ],
      operationalStatus: "ready_for_review",
      requiresHumanReview: true,
      reviewStatus: "pending",
    },
    {
      id: "pmid:42670964:interpretation:source-boundary",
      claimType: "source_boundary",
      statement:
        "This artifact is supported only by the PubMed metadata and abstract represented in the source set.",
      provenanceBasis: "article_supported",
      inputFactIds: ["pmid:42670964:design-randomized"],
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
