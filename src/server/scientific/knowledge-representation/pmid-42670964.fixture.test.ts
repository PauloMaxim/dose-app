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
  pmid41910396FactSet,
  pmid41910396Interpretation,
  pmid41910396SourceSet,
  pmid41910396EvidenceSet,
} from "./pmid-41910396.fixture";
import {
  pmid42670964EvidenceSet,
  pmid42670964FactSet,
  pmid42670964GapMatrix,
  pmid42670964Interpretation,
  pmid42670964ObservedGaps,
  pmid42670964SourceDocument,
  pmid42670964SourceSet,
} from "./pmid-42670964.fixture";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "./pmid-42717033.fixture";

const pipeline = {
  sourceSet: pmid42670964SourceSet,
  evidenceSet: pmid42670964EvidenceSet,
  factSet: pmid42670964FactSet,
  interpretation: pmid42670964Interpretation,
};

const values = pmid42670964FactSet.facts.flatMap((fact) =>
  fact.availability.status === "available" ? [fact.availability.value] : [],
);
const validationCodes = (factSet: typeof pmid42670964FactSet) =>
  new Set(
    validateRCTScientificFactSet(factSet, pmid42670964EvidenceSet).errors.map(({ code }) => code),
  );

test("PMID 42670964 fixture satisfies every artifact schema", () => {
  assert.equal(sourceDocumentSchema.safeParse(pmid42670964SourceDocument).success, true);
  for (const anchor of pmid42670964EvidenceSet.anchors) {
    assert.equal(evidenceAnchorSchema.safeParse(anchor).success, true);
    assert.equal(anchor.excerpt.status, "available");
    assert.equal(anchor.contentHash.status, "available");
    if (anchor.excerpt.status === "available" && anchor.contentHash.status === "available")
      assert.equal(
        createHash("sha256").update(anchor.excerpt.value).digest("hex"),
        anchor.contentHash.value.value,
      );
  }
  for (const fact of pmid42670964FactSet.facts)
    assert.equal(scientificFactSchema.safeParse(fact).success, true);
  assert.equal(scientificSourceSetSchema.safeParse(pmid42670964SourceSet).success, true);
  assert.equal(scientificEvidenceSetSchema.safeParse(pmid42670964EvidenceSet).success, true);
  assert.equal(rctScientificFactSetSchema.safeParse(pmid42670964FactSet).success, true);
  assert.equal(
    scientificInterpretationArtifactSchema.safeParse(pmid42670964Interpretation).success,
    true,
  );
});

test("PMID 42670964 passes validators and complete pipeline lineage", () => {
  assert.deepEqual(validateScientificSourceSet(pmid42670964SourceSet), {
    valid: true,
    errors: [],
    warnings: [],
  });
  assert.deepEqual(validateScientificEvidenceSet(pmid42670964EvidenceSet, pmid42670964SourceSet), {
    valid: true,
    errors: [],
    warnings: [],
  });
  assert.deepEqual(validateRCTScientificFactSet(pmid42670964FactSet, pmid42670964EvidenceSet), {
    valid: true,
    errors: [],
    warnings: [],
  });
  assert.deepEqual(
    validateScientificInterpretationArtifact(pmid42670964Interpretation, pmid42670964FactSet),
    { valid: true, errors: [], warnings: [] },
  );
  assert.deepEqual(validateEditorialPipeline(pipeline), {
    valid: true,
    errors: [],
    warnings: [],
  });

  const anchorIds = new Set(pmid42670964EvidenceSet.anchors.map(({ id }) => id));
  const factIds = new Set(pmid42670964FactSet.facts.map(({ id }) => id));
  for (const fact of pmid42670964FactSet.facts)
    for (const provenance of fact.provenance)
      assert.equal(
        provenance.target.kind === "evidence_anchor"
          ? anchorIds.has(provenance.target.id)
          : factIds.has(provenance.target.id),
        true,
      );
  for (const claim of pmid42670964Interpretation.claims)
    for (const factId of claim.inputFactIds) assert.equal(factIds.has(factId), true);
});

test("PMID 42670964 declares an abstract-only boundary", () => {
  assert.equal(pmid42670964SourceDocument.provider, "pubmed");
  assert.equal(pmid42670964SourceDocument.externalIdentifier.value, "42670964");
  assert.equal(pmid42670964SourceSet.coverage.hasAuthorizedFullText, false);
  assert.deepEqual(pmid42670964SourceSet.coverage.sourceKinds, ["abstract"]);
  assert.equal(pmid42670964SourceDocument.accessScope, "abstract");
  assert.equal(pmid42670964SourceDocument.textStorage, "anchors_only");
  for (const anchor of pmid42670964EvidenceSet.anchors)
    assert.equal(["page", "table", "figure"].includes(anchor.locator.kind), false);
});

test("the generic implementation contains no branch for any canary PMID", () => {
  for (const file of ["contracts.ts", "editorial-pipeline.ts"]) {
    const implementation = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const pmid of ["42670964", "41910396", "42717033"])
      assert.equal(implementation.includes(pmid), false);
  }
});

test("rct.v1 represents the design, population, arms, allocation, follow-up, and registry", () => {
  assert.ok(
    values.some(
      (value) =>
        value.type === "study_design_feature" && value.feature === "randomized" && value.value,
    ),
  );
  assert.deepEqual(
    values
      .filter((value) => value.type === "arm")
      .map(({ armId, randomizedSampleSize }) => ({ armId, randomizedSampleSize })),
    [
      { armId: "clopidogrel-monotherapy", randomizedSampleSize: 1601 },
      { armId: "extended-dapt", randomizedSampleSize: 1602 },
    ],
  );
  assert.ok(
    values.some((value) => value.type === "treatment_duration" && value.duration.value === 24),
  );
  assert.ok(
    values.some(
      (value) => value.type === "registry_identifier" && value.identifier === "NCT03947229",
    ),
  );
});

test("ischemic and bleeding outcomes remain separate comparative facts", () => {
  const results = values.flatMap((value) =>
    value.type === "result" && value.estimate.measureType === "hazard_ratio" ? [value] : [],
  );
  assert.deepEqual(
    results.map(({ endpointId, estimate }) => ({
      endpointId,
      measureType: estimate.measureType,
      value: estimate.value,
      confidenceInterval: estimate.confidenceInterval,
      pValue: estimate.pValue,
    })),
    [
      {
        endpointId: "key-secondary-ischemic",
        measureType: "hazard_ratio",
        value: 2.33,
        confidenceInterval: {
          status: "available",
          value: { lower: 1.47, upper: 3.69, levelPercent: 95 },
        },
        pValue: { status: "available", value: { operator: "less_than", value: 0.001 } },
      },
      {
        endpointId: "key-secondary-bleeding",
        measureType: "hazard_ratio",
        value: 0.43,
        confidenceInterval: {
          status: "available",
          value: { lower: 0.27, upper: 0.67, levelPercent: 95 },
        },
        pValue: { status: "available", value: { operator: "less_than", value: 0.001 } },
      },
    ],
  );
});

test("composite endpoints have structured components without invented component results", () => {
  const endpoints = values.filter((value) => value.type === "endpoint");
  assert.equal(endpoints.length, 3);
  assert.match(
    endpoints.find(({ endpointId }) => endpointId === "net-adverse-clinical-events")?.measure ?? "",
    /composite of death.*myocardial infarction.*bleeding/,
  );
  assert.deepEqual(
    endpoints
      .find(({ endpointId }) => endpointId === "net-adverse-clinical-events")
      ?.components?.map(({ name }) => name),
    [
      "death from any cause",
      "myocardial infarction",
      "stent thrombosis",
      "stroke",
      "BARC type 2, 3, or 5 bleeding",
    ],
  );
  const resultEndpointIds = values.flatMap((value) =>
    value.type === "result" ? [value.endpointId] : [],
  );
  for (const component of [
    "death-from-any-cause",
    "myocardial-infarction",
    "stent-thrombosis",
    "stroke",
  ])
    assert.equal(resultEndpointIds.includes(component), false);
});

test("resolved structural gaps are facts while trade-off and superiority remain explicit boundaries", () => {
  const concepts = new Set<string>(pmid42670964ObservedGaps.map(({ concept }) => concept));
  for (const concept of ["ischemia_bleeding_trade_off", "superiority_after_noninferiority"])
    assert.equal(concepts.has(concept), true);
  for (const resolved of [
    "noninferiority_design",
    "noninferiority_margin_direction_and_relationship",
    "primary_risk_difference",
    "arm_specific_event_estimates",
    "composite_endpoint_components",
    "time_to_event_analysis",
  ])
    assert.equal(concepts.has(resolved), false);

  const anchorIds = new Set(pmid42670964EvidenceSet.anchors.map(({ id }) => id));
  for (const gap of pmid42670964ObservedGaps)
    for (const sourceAnchorId of gap.sourceAnchorIds)
      assert.equal(anchorIds.has(sourceAnchorId), true);

  assert.ok(
    values.some(
      (value) => value.type === "result" && value.estimate.measureType === "risk_difference",
    ),
  );
  assert.ok(values.some((value) => value.type === "statistical_hypothesis"));
  assert.equal(values.filter((value) => value.type === "arm_estimate").length, 6);
});

test("risk difference, noninferiority, arm estimates, and time-to-event remain distinct", () => {
  const endpointFact = structuredClone(
    pmid42670964FactSet.facts.find(
      (fact) =>
        fact.availability.status === "available" &&
        fact.availability.value.type === "endpoint" &&
        fact.availability.value.endpointId === "net-adverse-clinical-events",
    ),
  );
  assert.ok(
    endpointFact?.availability.status === "available" &&
      endpointFact.availability.value.type === "endpoint",
  );
  assert.ok(endpointFact.availability.value.components);
  const primary = values.find(
    (value) => value.type === "result" && value.estimate.measureType === "risk_difference",
  );
  assert.ok(primary?.type === "result");
  assert.equal(primary.analysisType, undefined);
  const hypothesis = values.find((value) => value.type === "statistical_hypothesis");
  assert.ok(hypothesis?.type === "statistical_hypothesis");
  assert.equal(hypothesis.pValue.status, "available");
  if (hypothesis.pValue.status === "available")
    assert.equal(hypothesis.pValue.value.context, "noninferiority");
  for (const result of values.filter((value) => value.type === "result"))
    if (result.estimate.measureType === "hazard_ratio")
      assert.equal(result.analysisType, "time_to_event");
});

test("interpretations create neither false equivalence nor false superiority nor net benefit", () => {
  const statements = pmid42670964Interpretation.claims
    .map(({ statement }) => statement.toLowerCase())
    .join(" ");
  for (const prohibited of [
    "equivalent",
    "equivalence",
    "superior",
    "superiority",
    "net benefit",
    "better strategy",
    "preferable",
  ])
    assert.equal(statements.includes(prohibited), false);
  assert.equal(statements.includes("noninferiority"), true);

  for (const claim of pmid42670964Interpretation.claims) {
    assert.equal(claim.requiresHumanReview, true);
    assert.equal(claim.reviewStatus, "pending");
    assert.ok(claim.inputFactIds.length > 0);
    assert.ok(claim.qualifiers.length > 0);
    assert.ok(claim.prohibitedExtrapolations.length > 0);
    assert.ok(["article_supported", "deterministic_rule"].includes(claim.provenanceBasis));
  }
});

test("the complete requested gap matrix is classified", () => {
  assert.deepEqual(pmid42670964GapMatrix, {
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
  });
});

test("fact-set validation resolves new arm, endpoint, result, and component references", () => {
  const missingArm = structuredClone(pmid42670964FactSet);
  const armEstimate = missingArm.facts.find(
    (fact) =>
      fact.availability.status === "available" && fact.availability.value.type === "arm_estimate",
  );
  assert.ok(
    armEstimate?.availability.status === "available" &&
      armEstimate.availability.value.type === "arm_estimate",
  );
  armEstimate.availability.value.armId = "missing-arm";
  assert.ok(validationCodes(missingArm).has("FACT_ARM_NOT_FOUND"));

  const missingEndpoint = structuredClone(pmid42670964FactSet);
  const endpointEstimate = missingEndpoint.facts.find(
    (fact) =>
      fact.availability.status === "available" && fact.availability.value.type === "arm_estimate",
  );
  assert.ok(
    endpointEstimate?.availability.status === "available" &&
      endpointEstimate.availability.value.type === "arm_estimate",
  );
  endpointEstimate.availability.value.endpointId = "missing-endpoint";
  assert.ok(validationCodes(missingEndpoint).has("FACT_ENDPOINT_NOT_FOUND"));

  const inventedComponentResult = structuredClone(pmid42670964FactSet);
  const comparativeResult = inventedComponentResult.facts.find(
    (fact) => fact.availability.status === "available" && fact.availability.value.type === "result",
  );
  assert.ok(
    comparativeResult?.availability.status === "available" &&
      comparativeResult.availability.value.type === "result",
  );
  comparativeResult.availability.value.endpointId = "primary-stroke";
  assert.ok(validationCodes(inventedComponentResult).has("FACT_ENDPOINT_NOT_FOUND"));

  const duplicateComponent = structuredClone(pmid42670964FactSet);
  const compositeEndpoints = duplicateComponent.facts.filter(
    (fact) =>
      fact.availability.status === "available" &&
      fact.availability.value.type === "endpoint" &&
      fact.availability.value.components,
  );
  assert.equal(compositeEndpoints.length, 2);
  const first = compositeEndpoints[0];
  const second = compositeEndpoints[1];
  assert.ok(
    first.availability.status === "available" &&
      first.availability.value.type === "endpoint" &&
      first.availability.value.components &&
      second.availability.status === "available" &&
      second.availability.value.type === "endpoint" &&
      second.availability.value.components,
  );
  second.availability.value.components[0].componentId =
    first.availability.value.components[0].componentId;
  assert.ok(validationCodes(duplicateComponent).has("FACT_COMPOSITE_COMPONENT_ID_DUPLICATE"));
});

test("noninferiority validation audits linkage, compatibility, and decision conclusion", () => {
  const mutateHypothesis = () => {
    const factSet = structuredClone(pmid42670964FactSet);
    const hypothesis = factSet.facts.find(
      (fact) =>
        fact.availability.status === "available" &&
        fact.availability.value.type === "statistical_hypothesis",
    );
    assert.ok(
      hypothesis?.availability.status === "available" &&
        hypothesis.availability.value.type === "statistical_hypothesis",
    );
    return { factSet, hypothesis: hypothesis.availability.value };
  };

  const missingReference = mutateHypothesis();
  missingReference.hypothesis.resultFactId = "missing-result";
  assert.ok(validationCodes(missingReference.factSet).has("HYPOTHESIS_RESULT_NOT_FOUND"));

  const wrongEndpoint = mutateHypothesis();
  wrongEndpoint.hypothesis.endpointId = "key-secondary-ischemic";
  assert.ok(validationCodes(wrongEndpoint.factSet).has("HYPOTHESIS_ENDPOINT_MISMATCH"));

  const wrongMeasure = mutateHypothesis();
  const result = wrongMeasure.factSet.facts.find(
    ({ id }) => id === wrongMeasure.hypothesis.resultFactId,
  );
  assert.ok(
    result?.availability.status === "available" && result.availability.value.type === "result",
  );
  result.availability.value.estimate.measureType = "hazard_ratio";
  assert.ok(validationCodes(wrongMeasure.factSet).has("HYPOTHESIS_MEASURE_MISMATCH"));

  const wrongConclusion = mutateHypothesis();
  wrongConclusion.hypothesis.conclusion = "noninferiority_not_met";
  assert.ok(validationCodes(wrongConclusion.factSet).has("HYPOTHESIS_CONCLUSION_INVALID"));
});

test("both earlier canary pipelines remain valid", () => {
  for (const earlierPipeline of [
    {
      sourceSet: pmid42717033SourceSet,
      evidenceSet: pmid42717033EvidenceSet,
      factSet: pmid42717033FactSet,
      interpretation: pmid42717033Interpretation,
    },
    {
      sourceSet: pmid41910396SourceSet,
      evidenceSet: pmid41910396EvidenceSet,
      factSet: pmid41910396FactSet,
      interpretation: pmid41910396Interpretation,
    },
  ])
    assert.deepEqual(validateEditorialPipeline(earlierPipeline), {
      valid: true,
      errors: [],
      warnings: [],
    });

  assert.ok(
    pmid41910396FactSet.facts.some(
      (fact) =>
        fact.availability.status === "available" &&
        fact.availability.value.type === "result" &&
        fact.availability.value.estimate.measureType === "slope_difference",
    ),
  );
  assert.ok(
    pmid41910396FactSet.facts.some(
      (fact) =>
        fact.availability.status === "available" &&
        fact.availability.value.type === "arm" &&
        fact.availability.value.randomizedSampleSize !== undefined,
    ),
  );
});
