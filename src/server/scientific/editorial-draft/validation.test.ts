import assert from "node:assert/strict";
import test from "node:test";
import {
  contextualScientificMaterialSchema,
  scientificEditorialDraftSchema,
  type ScientificEditorialDraft,
} from "./contracts";
import { validateScientificEditorialDraft } from "./validation";
import { DOSE_PROGRESSIVE_EDITORIAL_PROFILE } from "./profile";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "../knowledge-representation/pmid-42717033.fixture";

const base = scientificEditorialDraftSchema.parse({
  schemaVersion: "scientific-editorial-draft.v4",
  id: "editorial:pmid:42717033:pt-BR:v1",
  articleId: "pmid:42717033",
  language: "pt-BR",
  inputLineage: {
    sourceSetId: pmid42717033SourceSet.id,
    evidenceSetId: pmid42717033EvidenceSet.id,
    factSetId: pmid42717033FactSet.id,
    interpretationArtifactId: pmid42717033Interpretation.id,
  },
  blocks: [
    {
      id: "opening",
      kind: "deck",
      disclosureLayer: "opening",
      claims: [
        {
          id: "tested-result",
          text: "O ensaio testou mitiperstat e não demonstrou benefício nos desfechos coprimários.",
          statementKind: "deterministic_interpretation",
          grounding: {
            factIds: ["pmid:42717033:result-kccq", "pmid:42717033:result-6mwd"],
            interpretationClaimIds: ["pmid:42717033:interpretation:coprimary-results"],
            evidenceAnchorIds: ["pmid:42717033:abstract:results"],
            sourceDocumentIds: ["pmid:42717033:abstract:v1"],
            externalContextReferenceIds: [],
          },
          epistemicStatus: "observed_clinical_result",
        },
      ],
    },
    {
      id: "boundary",
      kind: "source_boundary",
      disclosureLayer: "deep_dive",
      claims: [
        {
          id: "abstract-only",
          text: "A cobertura disponível é o abstract.",
          statementKind: "article_supported_fact",
          grounding: {
            factIds: [],
            interpretationClaimIds: ["pmid:42717033:interpretation:source-boundary"],
            evidenceAnchorIds: [],
            sourceDocumentIds: ["pmid:42717033:abstract:v1"],
            externalContextReferenceIds: [],
          },
          epistemicStatus: "source_coverage",
        },
      ],
    },
  ],
  requiresHumanReview: true,
  reviewStatus: "pending",
});

function clone(): ScientificEditorialDraft {
  return structuredClone(base);
}

function scientificClaim(draft: ScientificEditorialDraft) {
  const claim = draft.blocks[0].claims[0];
  assert.notEqual(claim.statementKind, "boundary_explanation");
  if (claim.statementKind === "boundary_explanation") throw new Error("Expected scientific claim");
  return claim;
}

function validate(draft: unknown = base, contextualMaterial: never[] = []) {
  return validateScientificEditorialDraft({
    draft,
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretationArtifact: pmid42717033Interpretation,
    contextualMaterial,
    editorialProfile: DOSE_PROGRESSIVE_EDITORIAL_PROFILE,
  });
}

function expectCode(draft: unknown, code: string) {
  const report = validate(draft);
  assert.equal(report.valid, false);
  assert.ok(
    report.errors.some((issue) => issue.code === code),
    JSON.stringify(report.errors),
  );
}

test("accepts a grounded draft with immutable pending human review", () => {
  assert.deepEqual(validate(), { valid: true, errors: [] });
});

test("rejects nonexistent fact, interpretation, and evidence IDs", () => {
  for (const [field, code] of [
    ["factIds", "FACT_NOT_FOUND"],
    ["interpretationClaimIds", "INTERPRETATION_CLAIM_NOT_FOUND"],
    ["evidenceAnchorIds", "EVIDENCE_ANCHOR_NOT_FOUND"],
  ] as const) {
    const draft = clone();
    scientificClaim(draft).grounding[field] = ["missing:id"];
    expectCode(draft, code);
  }
});

test("rejects contextual material without provenance", () => {
  const context = contextualScientificMaterialSchema.parse({
    schemaVersion: "contextual-scientific-material.v1",
    id: "context:one",
    articleId: base.articleId,
    claims: [
      {
        id: "context:claim:one",
        statement: "Material deliberately empty of provenance for this negative test.",
        epistemicStatus: "hypothesis",
        provenance: {
          sourceDocumentIds: [],
          evidenceAnchorIds: [],
          externalContextReferenceIds: [],
        },
      },
    ],
  });
  const report = validateScientificEditorialDraft({
    draft: base,
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretationArtifact: pmid42717033Interpretation,
    contextualMaterial: [context],
    editorialProfile: DOSE_PROGRESSIVE_EDITORIAL_PROFILE,
  });
  assert.ok(report.errors.some(({ code }) => code === "CONTEXT_PROVENANCE_REQUIRED"));
});

test("rejects substantive scientific blocks without grounding", () => {
  const draft = clone();
  scientificClaim(draft).grounding = {
    factIds: [],
    interpretationClaimIds: [],
    evidenceAnchorIds: [],
    sourceDocumentIds: [],
    externalContextReferenceIds: [],
  };
  expectCode(draft, "SCIENTIFIC_CLAIM_GROUNDING_REQUIRED");
});

test("a scientific equivalence claim cannot masquerade as a boundary explanation", () => {
  const draft = clone();
  draft.blocks[0].claims[0] = {
    ...scientificClaim(draft),
    text: "Treatment and placebo are equivalent.",
    statementKind: "boundary_explanation",
    boundaryId: "do_not_infer_equivalence",
  } as never;
  expectCode(draft, "DRAFT_SCHEMA_INVALID");
});

test("accepts a structural boundary reference without analyzing natural-language text", () => {
  const draft = clone();
  draft.blocks[0].claims.push({
    id: "equivalence-boundary",
    statementKind: "boundary_explanation",
    boundaryId: "do_not_infer_equivalence",
  });
  assert.deepEqual(validate(draft), { valid: true, errors: [] });
});

test("boundary explanations cannot carry prohibited epistemic statuses", () => {
  for (const epistemicStatus of [
    "equivalence",
    "superiority",
    "demonstrated_causality",
    "therapeutic_recommendation",
  ] as const) {
    const draft = clone();
    draft.blocks[0].claims.push({
      id: `invalid-boundary-${epistemicStatus}`,
      statementKind: "boundary_explanation",
      boundaryId: "do_not_infer_equivalence",
      epistemicStatus,
    } as never);
    expectCode(draft, "DRAFT_SCHEMA_INVALID");
  }
});

test("ordinary scientific claims cannot use boundary-reference fields to escape validation", () => {
  const draft = clone();
  Object.assign(scientificClaim(draft), {
    boundaryId: "do_not_infer_equivalence",
  });
  expectCode(draft, "DRAFT_SCHEMA_INVALID");
});

test("rejects an unknown boundary explanation ID", () => {
  const draft = clone();
  draft.blocks[0].claims.push({
    id: "unknown-boundary",
    statementKind: "boundary_explanation",
    boundaryId: "unknown-boundary-id",
  });
  expectCode(draft, "INFERENCE_BOUNDARY_NOT_AUTHORIZED");
});

test("deterministic validation does not claim semantic approval of innocent-looking metadata", () => {
  const draft = clone();
  const claim = scientificClaim(draft);
  claim.text = "Mitiperstat e placebo são equivalentes.";
  claim.statementKind = "article_supported_fact";
  claim.epistemicStatus = "observed_clinical_result";
  assert.deepEqual(validate(draft), { valid: true, errors: [] });
  assert.equal(draft.requiresHumanReview, true);
  assert.equal(draft.reviewStatus, "pending");
});

for (const [status, code] of [
  ["equivalence", "EQUIVALENCE_NOT_SUPPORTED"],
  ["superiority", "SUPERIORITY_NOT_SUPPORTED"],
  ["demonstrated_causality", "CAUSALITY_NOT_SUPPORTED"],
  ["therapeutic_recommendation", "THERAPEUTIC_RECOMMENDATION_NOT_AUTHORIZED"],
] as const)
  test(`rejects unauthorized ${status}`, () => {
    const draft = clone();
    scientificClaim(draft).epistemicStatus = status;
    expectCode(draft, code);
  });

test("rejects a full-text claim when only the abstract is authorized", () => {
  const draft = clone();
  scientificClaim(draft).sourceRequirement = "authorized_full_text";
  expectCode(draft, "FULL_TEXT_NOT_AVAILABLE");
});

test("rejects a prose number that is not declared structurally", () => {
  const draft = clone();
  scientificClaim(draft).text += " O valor inventado foi 999.";
  expectCode(draft, "QUANTITATIVE_CLAIM_NOT_DECLARED");
});

test("accepts estimate, interval bounds, confidence level, p value, and timepoint from one result fact", () => {
  const draft = clone();
  const claim = scientificClaim(draft);
  claim.text = "A estimativa foi −1,4 ponto (IC 95% de −3,9 a 1,2; p=0,29) em 16 semanas.";
  claim.grounding.factIds = ["pmid:42717033:result-kccq"];
  claim.quantitativeClaims = [
    { value: -1.4, unit: "point", factId: "pmid:42717033:result-kccq" },
    { value: -3.9, unit: "point", factId: "pmid:42717033:result-kccq" },
    { value: 1.2, unit: "point", factId: "pmid:42717033:result-kccq" },
    { value: 95, unit: "percent", factId: "pmid:42717033:result-kccq" },
    { value: 0.29, unit: "p_value", factId: "pmid:42717033:result-kccq" },
    { value: 16, unit: "week", factId: "pmid:42717033:result-kccq" },
  ];
  assert.deepEqual(validate(draft), { valid: true, errors: [] });
});

test("accepts typed sample size, percentage, dose, and duration quantities", () => {
  const draft = clone();
  const claim = scientificClaim(draft);
  claim.text = "Foram 711 participantes, 45% mulheres, com dose de 2,5 mg por 48 semanas.";
  claim.grounding.factIds = [
    "pmid:42717033:sample-size",
    "pmid:42717033:women",
    "pmid:42717033:arm-low-dose",
    "pmid:42717033:treatment-duration",
  ];
  claim.quantitativeClaims = [
    { value: 711, unit: "participant", factId: "pmid:42717033:sample-size" },
    { value: 45, unit: "percent", factId: "pmid:42717033:women" },
    { value: 2.5, unit: "mg", factId: "pmid:42717033:arm-low-dose" },
    { value: 48, unit: "week", factId: "pmid:42717033:treatment-duration" },
  ];
  assert.deepEqual(validate(draft), { valid: true, errors: [] });
});

test("rejects a number and unit drawn from different semantic fields of the same fact", () => {
  const draft = clone();
  const claim = scientificClaim(draft);
  claim.text = "O resultado foi 95 pontos.";
  claim.grounding.factIds = ["pmid:42717033:result-kccq"];
  claim.quantitativeClaims = [{ value: 95, unit: "point", factId: "pmid:42717033:result-kccq" }];
  expectCode(draft, "QUANTITATIVE_CLAIM_NOT_IN_FACT");
});

test("preserves a Unicode minus sign when matching prose to declarations", () => {
  const draft = clone();
  const claim = scientificClaim(draft);
  claim.text = "A diferença foi −1.4 ponto.";
  claim.grounding.factIds = ["pmid:42717033:result-kccq"];
  claim.quantitativeClaims = [{ value: 1.4, unit: "point", factId: "pmid:42717033:result-kccq" }];
  const report = validate(draft);
  assert.ok(report.errors.some(({ code }) => code === "QUANTITATIVE_CLAIM_NOT_DECLARED"));
  assert.ok(report.errors.some(({ code }) => code === "QUANTITATIVE_CLAIM_NOT_IN_FACT"));
});

test("does not treat numbers embedded in scientific endpoint names as standalone quantities", () => {
  for (const text of ["O desfecho foi 6-minute walk distance.", "O desfecho foi 6MWD."]) {
    const draft = clone();
    const claim = scientificClaim(draft);
    claim.text = text;
    claim.grounding.factIds = ["pmid:42717033:endpoint-6mwd"];
    claim.quantitativeClaims = [];
    assert.deepEqual(validate(draft), { valid: true, errors: [] });
  }
});

test("keeps a standalone translated duration subject to quantitative declaration", () => {
  const draft = clone();
  const claim = scientificClaim(draft);
  claim.text = "O desfecho foi caminhada de 6 minutos.";
  claim.grounding.factIds = ["pmid:42717033:endpoint-6mwd"];
  claim.quantitativeClaims = [];
  expectCode(draft, "QUANTITATIVE_CLAIM_NOT_DECLARED");
});

test("the schema prevents the editorial layer from bypassing review", () => {
  for (const mutation of [
    { requiresHumanReview: false, reviewStatus: "pending" },
    { requiresHumanReview: true, reviewStatus: "approved" },
  ])
    expectCode({ ...structuredClone(base), ...mutation }, "DRAFT_SCHEMA_INVALID");
});

test("rejects a declared language different from targetLanguage", () => {
  const draft = clone();
  draft.language = "en";
  expectCode(draft, "DRAFT_LANGUAGE_MISMATCH");
});
