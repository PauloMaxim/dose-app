import assert from "node:assert/strict";
import test from "node:test";
import {
  contextualScientificMaterialSchema,
  scientificEditorialDraftSchema,
  type ScientificEditorialDraft,
} from "./contracts";
import { validateScientificEditorialDraft } from "./validation";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "../knowledge-representation/pmid-42717033.fixture";

const base = scientificEditorialDraftSchema.parse({
  schemaVersion: "scientific-editorial-draft.v1",
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
          conclusionIds: ["bounded-negative-result"],
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
          conclusionIds: [],
        },
      ],
    },
  ],
  inferenceLimits: {
    supportedConclusions: [
      {
        id: "bounded-negative-result",
        statement: "Não houve benefício demonstrável nos desfechos definidos.",
        factIds: ["pmid:42717033:result-kccq", "pmid:42717033:result-6mwd"],
        interpretationClaimIds: ["pmid:42717033:interpretation:coprimary-results"],
        rule: "supported_by_inputs",
      },
    ],
    unsupportedConclusions: [
      {
        id: "mpo-does-not-participate",
        statement: "A MPO não participa da doença.",
        factIds: [],
        interpretationClaimIds: [],
        rule: "do_not_infer_causality",
      },
    ],
  },
  requiresHumanReview: true,
  reviewStatus: "pending",
});

function clone(): ScientificEditorialDraft {
  return structuredClone(base);
}

function validate(draft: unknown = base, contextualMaterial: never[] = []) {
  return validateScientificEditorialDraft({
    draft,
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretationArtifact: pmid42717033Interpretation,
    contextualMaterial,
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
    draft.blocks[0].claims[0].grounding[field] = ["missing:id"];
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
  });
  assert.ok(report.errors.some(({ code }) => code === "CONTEXT_PROVENANCE_REQUIRED"));
});

test("rejects substantive scientific blocks without grounding", () => {
  const draft = clone();
  draft.blocks[0].claims[0].grounding = {
    factIds: [],
    interpretationClaimIds: [],
    evidenceAnchorIds: [],
    sourceDocumentIds: [],
    externalContextReferenceIds: [],
  };
  expectCode(draft, "SCIENTIFIC_CLAIM_GROUNDING_REQUIRED");
});

test("rejects a claim that invokes an unsupported conclusion", () => {
  const draft = clone();
  draft.blocks[0].claims[0].conclusionIds = ["mpo-does-not-participate"];
  expectCode(draft, "UNSUPPORTED_CONCLUSION_USED");
});

for (const [status, code] of [
  ["equivalence", "EQUIVALENCE_NOT_SUPPORTED"],
  ["superiority", "SUPERIORITY_NOT_SUPPORTED"],
  ["demonstrated_causality", "CAUSALITY_NOT_SUPPORTED"],
  ["therapeutic_recommendation", "THERAPEUTIC_RECOMMENDATION_NOT_AUTHORIZED"],
] as const)
  test(`rejects unauthorized ${status}`, () => {
    const draft = clone();
    draft.blocks[0].claims[0].epistemicStatus = status;
    expectCode(draft, code);
  });

test("rejects a full-text claim when only the abstract is authorized", () => {
  const draft = clone();
  draft.blocks[0].claims[0].sourceRequirement = "authorized_full_text";
  expectCode(draft, "FULL_TEXT_NOT_AVAILABLE");
});

test("rejects a prose number that is not declared structurally", () => {
  const draft = clone();
  draft.blocks[0].claims[0].text += " O valor inventado foi 999.";
  expectCode(draft, "QUANTITATIVE_CLAIM_NOT_DECLARED");
});

test("the schema prevents the editorial layer from bypassing review", () => {
  for (const mutation of [
    { requiresHumanReview: false, reviewStatus: "pending" },
    { requiresHumanReview: true, reviewStatus: "approved" },
  ])
    expectCode({ ...structuredClone(base), ...mutation }, "DRAFT_SCHEMA_INVALID");
});
