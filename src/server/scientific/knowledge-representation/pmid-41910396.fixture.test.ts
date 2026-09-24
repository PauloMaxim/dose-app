import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evidenceAnchorSchema, scientificFactSchema, sourceDocumentSchema } from "./contracts";
import {
  rctScientificFactSetSchema,
  scientificEvidenceSetSchema,
  scientificInterpretationArtifactSchema,
  scientificSourceSetSchema,
  validateEditorialPipeline,
  validateRCTScientificFactSet,
  validateScientificEvidenceSet,
  validateScientificInterpretationArtifact,
  validateScientificSourceSet,
} from "./editorial-pipeline";
import {
  pmid41910396EvidenceSet,
  pmid41910396FactSet,
  pmid41910396Interpretation,
  pmid41910396SourceDocument,
  pmid41910396SourceSet,
} from "./pmid-41910396.fixture";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "./pmid-42717033.fixture";

const pipeline = {
  sourceSet: pmid41910396SourceSet,
  evidenceSet: pmid41910396EvidenceSet,
  factSet: pmid41910396FactSet,
  interpretation: pmid41910396Interpretation,
};

test("PMID 41910396 fixture satisfies every artifact schema", () => {
  assert.equal(sourceDocumentSchema.safeParse(pmid41910396SourceDocument).success, true);
  for (const anchor of pmid41910396EvidenceSet.anchors)
    assert.equal(evidenceAnchorSchema.safeParse(anchor).success, true);
  for (const anchor of pmid41910396EvidenceSet.anchors) {
    assert.equal(anchor.excerpt.status, "available");
    assert.equal(anchor.contentHash.status, "available");
    if (anchor.excerpt.status === "available" && anchor.contentHash.status === "available")
      assert.equal(
        createHash("sha256").update(anchor.excerpt.value).digest("hex"),
        anchor.contentHash.value.value,
      );
  }
  for (const fact of pmid41910396FactSet.facts)
    assert.equal(scientificFactSchema.safeParse(fact).success, true);
  assert.equal(scientificSourceSetSchema.safeParse(pmid41910396SourceSet).success, true);
  assert.equal(scientificEvidenceSetSchema.safeParse(pmid41910396EvidenceSet).success, true);
  assert.equal(rctScientificFactSetSchema.safeParse(pmid41910396FactSet).success, true);
  assert.equal(
    scientificInterpretationArtifactSchema.safeParse(pmid41910396Interpretation).success,
    true,
  );
});

test("PMID 41910396 passes artifact validation and complete pipeline lineage", () => {
  assert.deepEqual(validateScientificSourceSet(pmid41910396SourceSet), {
    valid: true,
    errors: [],
    warnings: [],
  });
  assert.deepEqual(validateScientificEvidenceSet(pmid41910396EvidenceSet, pmid41910396SourceSet), {
    valid: true,
    errors: [],
    warnings: [],
  });
  assert.deepEqual(validateRCTScientificFactSet(pmid41910396FactSet, pmid41910396EvidenceSet), {
    valid: true,
    errors: [],
    warnings: [],
  });
  assert.deepEqual(
    validateScientificInterpretationArtifact(pmid41910396Interpretation, pmid41910396FactSet),
    { valid: true, errors: [], warnings: [] },
  );
  assert.deepEqual(validateEditorialPipeline(pipeline), {
    valid: true,
    errors: [],
    warnings: [],
  });

  const anchorIds = new Set(pmid41910396EvidenceSet.anchors.map(({ id }) => id));
  const factIds = new Set(pmid41910396FactSet.facts.map(({ id }) => id));
  for (const fact of pmid41910396FactSet.facts)
    for (const provenance of fact.provenance)
      assert.equal(
        provenance.target.kind === "evidence_anchor"
          ? anchorIds.has(provenance.target.id)
          : factIds.has(provenance.target.id),
        true,
      );
  for (const claim of pmid41910396Interpretation.claims)
    for (const factId of claim.inputFactIds) assert.equal(factIds.has(factId), true);
});

test("PMID 41910396 declares abstract-only access and never claims full text", () => {
  assert.equal(pmid41910396SourceSet.coverage.hasAuthorizedFullText, false);
  assert.deepEqual(pmid41910396SourceSet.coverage.sourceKinds, ["abstract"]);
  for (const source of pmid41910396SourceSet.sourceDocuments) {
    assert.notEqual(source.sourceKind, "licensed_full_text");
    assert.notEqual(source.accessScope, "licensed_full_text");
    assert.notEqual(source.textStorage, "full_text");
  }
  for (const anchor of pmid41910396EvidenceSet.anchors)
    assert.equal(["page", "table", "figure"].includes(anchor.locator.kind), false);
});

test("the generic implementation contains no PMID-specific branch", () => {
  for (const file of ["contracts.ts", "editorial-pipeline.ts"]) {
    const implementation = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.equal(implementation.includes("41910396"), false);
  }
});

test("rct.v1 boundary: time-to-event analysis type is not structurally representable", () => {
  const result = structuredClone(
    pmid41910396FactSet.facts.find(
      (fact) =>
        fact.availability.status === "available" &&
        fact.availability.value.type === "result" &&
        fact.availability.value.estimate.measureType === "hazard_ratio",
    ),
  );
  assert.ok(result?.availability.status === "available");
  assert.equal(
    scientificFactSchema.safeParse({
      ...result,
      availability: {
        ...result.availability,
        value: { ...result.availability.value, analysisType: "time_to_event" },
      },
    }).success,
    false,
  );
});

test("rct.v1 boundary: an eGFR slope difference is not an available estimate type", () => {
  const result = structuredClone(
    pmid41910396FactSet.facts.find(
      (fact) =>
        fact.availability.status === "available" && fact.availability.value.type === "result",
    ),
  );
  assert.ok(
    result?.availability.status === "available" && result.availability.value.type === "result",
  );
  assert.equal(
    scientificFactSchema.safeParse({
      ...result,
      availability: {
        ...result.availability,
        value: {
          ...result.availability.value,
          endpointId: "annualized-total-egfr-slope",
          estimate: {
            ...result.availability.value.estimate,
            measureType: "slope_difference",
            value: 3.02,
            unit: "ml/min/1.73 m2/year",
          },
        },
      },
    }).success,
    false,
  );
});

test("rct.v1 boundary: randomized sample size per arm is not structurally representable", () => {
  const arm = structuredClone(
    pmid41910396FactSet.facts.find(
      (fact) => fact.availability.status === "available" && fact.availability.value.type === "arm",
    ),
  );
  assert.ok(arm?.availability.status === "available");
  assert.equal(
    scientificFactSchema.safeParse({
      ...arm,
      availability: {
        ...arm.availability,
        value: { ...arm.availability.value, randomizedSampleSize: 238 },
      },
    }).success,
    false,
  );
});

test("PMID 42717033 golden fixture remains valid", () => {
  assert.deepEqual(
    validateEditorialPipeline({
      sourceSet: pmid42717033SourceSet,
      evidenceSet: pmid42717033EvidenceSet,
      factSet: pmid42717033FactSet,
      interpretation: pmid42717033Interpretation,
    }),
    { valid: true, errors: [], warnings: [] },
  );
});
