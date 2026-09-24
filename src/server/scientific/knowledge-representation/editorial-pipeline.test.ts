import assert from "node:assert/strict";
import test from "node:test";
import { evidenceAnchorSchema, scientificFactSchema, sourceDocumentSchema } from "./contracts";
import {
  scientificInterpretationArtifactSchema,
  scientificSourceSetSchema,
  validateEditorialPipeline,
  validateRCTScientificFactSet,
  validateScientificEvidenceSet,
  validateScientificInterpretationArtifact,
  validateScientificSourceSet,
} from "./editorial-pipeline";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceDocument,
  pmid42717033SourceSet,
} from "./pmid-42717033.fixture";

const errorCodes = (result: ReturnType<typeof validateEditorialPipeline>) =>
  new Set(result.errors.map(({ code }) => code));

test("source sets enforce identity, primary resolution, and derived coverage", () => {
  const duplicate = structuredClone(pmid42717033SourceSet);
  duplicate.sourceDocuments.push(duplicate.sourceDocuments[0]);
  assert.ok(errorCodes(validateScientificSourceSet(duplicate)).has("SOURCE_DOCUMENT_ID_DUPLICATE"));

  const missingPrimary = { ...pmid42717033SourceSet, primarySourceDocumentIds: ["missing"] };
  assert.ok(
    errorCodes(validateScientificSourceSet(missingPrimary)).has("PRIMARY_SOURCE_NOT_FOUND"),
  );

  const falseCoverage = {
    ...pmid42717033SourceSet,
    coverage: { sourceKinds: ["metadata" as const], hasAuthorizedFullText: true },
  };
  assert.ok(errorCodes(validateScientificSourceSet(falseCoverage)).has("SOURCE_COVERAGE_MISMATCH"));
});

test("Crossref is a valid metadata/abstract source, never a full-text authority", () => {
  const crossref = {
    ...pmid42717033SourceDocument,
    id: "doi:example:metadata:v1",
    articleId: "doi:example",
    sourceKind: "metadata" as const,
    provider: "crossref" as const,
    externalIdentifier: { scheme: "doi", value: "10.0000/example" },
    accessScope: "metadata_only" as const,
    textStorage: "none" as const,
  };
  assert.equal(sourceDocumentSchema.safeParse(crossref).success, true);
  assert.equal(
    sourceDocumentSchema.safeParse({
      ...crossref,
      sourceKind: "abstract",
      accessScope: "abstract",
      textStorage: "anchors_only",
    }).success,
    true,
  );
  assert.equal(
    sourceDocumentSchema.safeParse({
      ...crossref,
      sourceKind: "licensed_full_text",
      accessScope: "licensed_full_text",
      textStorage: "full_text",
    }).success,
    false,
  );
  assert.equal(
    scientificSourceSetSchema.safeParse({
      version: "scientific-source-set.v1",
      id: "doi:example:sources:v1",
      articleId: "doi:example",
      sourceDocuments: [crossref],
      primarySourceDocumentIds: [crossref.id],
      coverage: { sourceKinds: ["metadata"], hasAuthorizedFullText: false },
      validation: { status: "pending" },
    }).success,
    true,
  );
});

test("evidence sets reject missing sources, duplicate anchors, and incompatible locators", () => {
  const missingSource = structuredClone(pmid42717033EvidenceSet);
  missingSource.anchors[0].sourceDocumentId = "missing";
  assert.ok(
    errorCodes(validateScientificEvidenceSet(missingSource, pmid42717033SourceSet)).has(
      "EVIDENCE_SOURCE_NOT_FOUND",
    ),
  );

  const duplicate = structuredClone(pmid42717033EvidenceSet);
  duplicate.anchors.push(duplicate.anchors[0]);
  assert.ok(
    errorCodes(validateScientificEvidenceSet(duplicate, pmid42717033SourceSet)).has(
      "EVIDENCE_ANCHOR_ID_DUPLICATE",
    ),
  );

  const badLocator = structuredClone(pmid42717033EvidenceSet);
  badLocator.anchors[0].locator = { kind: "page", page: 1 };
  assert.ok(
    errorCodes(validateScientificEvidenceSet(badLocator, pmid42717033SourceSet)).has(
      "EVIDENCE_LOCATOR_INCOMPATIBLE",
    ),
  );
  assert.equal(
    evidenceAnchorSchema.safeParse({
      ...badLocator.anchors[0],
      offsets: { status: "available", value: { unit: "unicode_code_point", start: 4, end: 4 } },
    }).success,
    false,
  );
});

function availableFact(type: string) {
  const fact = pmid42717033FactSet.facts.find(
    (candidate) =>
      candidate.availability.status === "available" && candidate.availability.value.type === type,
  );
  assert.ok(fact);
  return structuredClone(fact);
}

test("RCT fact sets resolve provenance and derived inputs", () => {
  const missingAnchor = structuredClone(pmid42717033FactSet);
  missingAnchor.facts[0].provenance[0].target.id = "missing";
  assert.ok(
    errorCodes(validateRCTScientificFactSet(missingAnchor, pmid42717033EvidenceSet)).has(
      "FACT_EVIDENCE_NOT_FOUND",
    ),
  );

  const derived = availableFact("mechanism_relation");
  derived.id = "derived:test";
  derived.origin = { kind: "derived", inputFactIds: ["missing"], method: "rule-v1" };
  derived.provenance = [
    { target: { kind: "scientific_fact", id: "missing" }, relation: "derived_from" },
  ];
  const missingInput = structuredClone(pmid42717033FactSet);
  missingInput.facts.push(scientificFactSchema.parse(derived));
  assert.ok(
    errorCodes(validateRCTScientificFactSet(missingInput, pmid42717033EvidenceSet)).has(
      "DERIVED_FACT_INPUT_NOT_FOUND",
    ),
  );
});

test("RCT fact sets resolve arms, endpoints, pooling, and article identity", () => {
  const missingArm = structuredClone(pmid42717033FactSet);
  const result = missingArm.facts.find(
    (fact) => fact.availability.status === "available" && fact.availability.value.type === "result",
  );
  assert.ok(
    result?.availability.status === "available" && result.availability.value.type === "result",
  );
  result.availability.value.arms[0].armId = "missing";
  assert.ok(
    errorCodes(validateRCTScientificFactSet(missingArm, pmid42717033EvidenceSet)).has(
      "FACT_ARM_NOT_FOUND",
    ),
  );

  const missingEndpoint = structuredClone(pmid42717033FactSet);
  const endpointResult = missingEndpoint.facts.find(
    (fact) => fact.availability.status === "available" && fact.availability.value.type === "result",
  );
  assert.ok(
    endpointResult?.availability.status === "available" &&
      endpointResult.availability.value.type === "result",
  );
  endpointResult.availability.value.endpointId = "missing";
  assert.ok(
    errorCodes(validateRCTScientificFactSet(missingEndpoint, pmid42717033EvidenceSet)).has(
      "FACT_ENDPOINT_NOT_FOUND",
    ),
  );

  const badPooling = structuredClone(pmid42717033FactSet);
  const pooled = badPooling.facts.find(
    (fact) => fact.availability.status === "available" && fact.availability.value.type === "result",
  );
  assert.ok(
    pooled?.availability.status === "available" &&
      pooled.availability.value.type === "result" &&
      pooled.availability.value.pooling.status === "pooled",
  );
  pooled.availability.value.pooling.pooledArmIds[0] = "placebo";
  assert.ok(
    errorCodes(validateRCTScientificFactSet(badPooling, pmid42717033EvidenceSet)).has(
      "FACT_POOLING_INVALID",
    ),
  );

  const wrongArticle = structuredClone(pmid42717033FactSet);
  wrongArticle.facts[0].articleId = "other:article";
  assert.ok(
    errorCodes(validateRCTScientificFactSet(wrongArticle, pmid42717033EvidenceSet)).has(
      "FACT_ARTICLE_MISMATCH",
    ),
  );
});

test("RCT result contracts reject invalid confidence intervals and p-values", () => {
  const result = availableFact("result");
  assert.ok(
    result.availability.status === "available" && result.availability.value.type === "result",
  );
  result.availability.value.estimate.confidenceInterval = {
    status: "available",
    value: { lower: 2, upper: 1, levelPercent: 95 },
  };
  assert.equal(scientificFactSchema.safeParse(result).success, false);

  const invalidP = availableFact("result");
  assert.ok(
    invalidP.availability.status === "available" && invalidP.availability.value.type === "result",
  );
  invalidP.availability.value.estimate.pValue = {
    status: "available",
    value: { operator: "less_than", value: 1.1 },
  };
  assert.equal(scientificFactSchema.safeParse(invalidP).success, false);
});

test("interpretation requires typed provenance and keeps the human review gate", () => {
  const missingFact = structuredClone(pmid42717033Interpretation);
  missingFact.claims[0].inputFactIds = ["missing"];
  assert.ok(
    errorCodes(validateScientificInterpretationArtifact(missingFact, pmid42717033FactSet)).has(
      "INTERPRETATION_FACT_NOT_FOUND",
    ),
  );

  const unsupported = structuredClone(pmid42717033Interpretation);
  unsupported.claims[0].inputFactIds = [];
  assert.ok(
    errorCodes(validateScientificInterpretationArtifact(unsupported, pmid42717033FactSet)).has(
      "INTERPRETATION_FACT_SUPPORT_REQUIRED",
    ),
  );

  const external = structuredClone(pmid42717033Interpretation.claims[0]);
  external.id = "context:test";
  external.claimType = "contextual_explanation";
  external.provenanceBasis = "external_context";
  external.inputFactIds = [];
  external.externalContextReferences = ["context-source:test"];
  const parsed = scientificInterpretationArtifactSchema.parse({
    ...pmid42717033Interpretation,
    claims: [external],
  });
  assert.equal(validateScientificInterpretationArtifact(parsed, pmid42717033FactSet).valid, true);
  assert.notEqual(parsed.claims[0].provenanceBasis, "article_supported");
  assert.deepEqual(pmid42717033Interpretation.claims[0].prohibitedExtrapolations, [
    "do_not_infer_equivalence",
    "do_not_infer_individual_dose_effect",
  ]);
  assert.equal(pmid42717033Interpretation.claims[0].requiresHumanReview, true);
  assert.equal(pmid42717033Interpretation.claims[0].reviewStatus, "pending");
});

test("the golden fixture has complete lineage and validators contain no PMID special case", () => {
  const golden = validateEditorialPipeline({
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretation: pmid42717033Interpretation,
  });
  assert.deepEqual(golden, { valid: true, errors: [], warnings: [] });
  assert.equal(validateEditorialPipeline.toString().includes("42717033"), false);

  const broken = structuredClone(pmid42717033Interpretation);
  broken.factSet.id = "other:fact-set";
  assert.ok(
    errorCodes(
      validateEditorialPipeline({
        sourceSet: pmid42717033SourceSet,
        evidenceSet: pmid42717033EvidenceSet,
        factSet: pmid42717033FactSet,
        interpretation: broken,
      }),
    ).has("PIPELINE_FACT_LINEAGE_BROKEN"),
  );
});

test("pipeline lineage rejects reference version mismatches even when IDs match", () => {
  const evidenceWithWrongSourceVersion = structuredClone(pmid42717033EvidenceSet);
  (evidenceWithWrongSourceVersion.sourceSet as { version: string }).version =
    "scientific-source-set.previous";
  assert.ok(
    errorCodes(
      validateEditorialPipeline({
        sourceSet: pmid42717033SourceSet,
        evidenceSet: evidenceWithWrongSourceVersion,
        factSet: pmid42717033FactSet,
        interpretation: pmid42717033Interpretation,
      }),
    ).has("PIPELINE_SOURCE_LINEAGE_BROKEN"),
  );

  const factSetWithWrongEvidenceVersion = structuredClone(pmid42717033FactSet);
  (factSetWithWrongEvidenceVersion.evidenceSet as { version: string }).version =
    "scientific-evidence-set.previous";
  assert.ok(
    errorCodes(
      validateEditorialPipeline({
        sourceSet: pmid42717033SourceSet,
        evidenceSet: pmid42717033EvidenceSet,
        factSet: factSetWithWrongEvidenceVersion,
        interpretation: pmid42717033Interpretation,
      }),
    ).has("PIPELINE_EVIDENCE_LINEAGE_BROKEN"),
  );

  const interpretationWithWrongFactVersion = structuredClone(pmid42717033Interpretation);
  (interpretationWithWrongFactVersion.factSet as { version: string }).version =
    "rct-scientific-fact-set.previous";
  assert.ok(
    errorCodes(
      validateEditorialPipeline({
        sourceSet: pmid42717033SourceSet,
        evidenceSet: pmid42717033EvidenceSet,
        factSet: pmid42717033FactSet,
        interpretation: interpretationWithWrongFactVersion,
      }),
    ).has("PIPELINE_FACT_LINEAGE_BROKEN"),
  );
});
