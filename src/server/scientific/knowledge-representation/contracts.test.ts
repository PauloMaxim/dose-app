import assert from "node:assert/strict";
import test from "node:test";
import {
  availability,
  evidenceAnchorSchema,
  scientificFactSchema,
  sourceDocumentSchema,
} from "./contracts";
import {
  pmid42717033EvidenceAnchors,
  pmid42717033ScientificFacts,
  pmid42717033SourceDocument,
} from "./pmid-42717033.fixture";
import { pmid42670964ScientificFacts } from "./pmid-42670964.fixture";

const availableResult = (endpointId: string) => {
  const fact = pmid42717033ScientificFacts.find(
    (candidate) =>
      candidate.availability.status === "available" &&
      candidate.availability.value.type === "result" &&
      candidate.availability.value.endpointId === endpointId,
  );
  assert.ok(fact && fact.availability.status === "available");
  assert.equal(fact.availability.value.type, "result");
  return fact.availability.value;
};

test("availability is discriminated and never represents missing states as null", () => {
  const schema = availability(zStringForTest);
  for (const value of [
    { status: "available", value: "reported" },
    { status: "not_reported_in_source" },
    { status: "requires_additional_source" },
    { status: "extraction_uncertain", reason: "ambiguous table heading" },
    { status: "conflicting_sources", conflictingFactIds: ["fact-a", "fact-b"] },
    { status: "not_applicable" },
  ]) {
    assert.equal(schema.safeParse(value).success, true);
  }
  assert.equal(schema.safeParse(null).success, false);
  assert.equal(schema.safeParse({ status: "available", value: null }).success, false);
  assert.notDeepEqual({ status: "not_reported_in_source" }, { status: "not_applicable" });
});

test("an unavailable fact remains typed", () => {
  const source = pmid42717033ScientificFacts[0];
  const missing = {
    ...source,
    factType: "endpoint_timepoint",
    availability: { status: "requires_additional_source" },
  };
  assert.equal(scientificFactSchema.safeParse(missing).success, true);
  assert.equal(scientificFactSchema.safeParse({ ...missing, factType: null }).success, false);
});

// Local primitive keeps this test focused on the exported availability constructor.
import { z } from "zod";
const zStringForTest = z.string().min(1);

test("source documents preserve access and storage boundaries", () => {
  assert.equal(sourceDocumentSchema.safeParse(pmid42717033SourceDocument).success, true);
  assert.equal(pmid42717033SourceDocument.accessScope, "abstract");
  assert.equal(pmid42717033SourceDocument.textStorage, "anchors_only");

  const illegalFullText = {
    ...pmid42717033SourceDocument,
    textStorage: "full_text",
  };
  assert.equal(sourceDocumentSchema.safeParse(illegalFullText).success, false);
  assert.equal(
    sourceDocumentSchema.safeParse({
      ...pmid42717033SourceDocument,
      doseSummary: "editorial prose",
    }).success,
    false,
  );
});

test("evidence anchors locate excerpts without requiring complete source text", () => {
  assert.equal(pmid42717033EvidenceAnchors.length, 6);
  for (const anchor of pmid42717033EvidenceAnchors) {
    assert.equal(evidenceAnchorSchema.safeParse(anchor).success, true);
    assert.equal(anchor.sourceDocumentId, pmid42717033SourceDocument.id);
    assert.equal(anchor.sourceLanguage, "en");
    assert.equal(anchor.excerpt.status, "available");
  }
  const invalidOffsets = {
    ...pmid42717033EvidenceAnchors[0],
    offsets: { status: "available", value: { unit: "unicode_code_point", start: 10, end: 2 } },
  };
  assert.equal(evidenceAnchorSchema.safeParse(invalidOffsets).success, false);
});

test("the PMID 42717033 RCT fixture has atomic typed facts with valid provenance", () => {
  const anchorIds = new Set(pmid42717033EvidenceAnchors.map((anchor) => anchor.id));
  assert.ok(pmid42717033ScientificFacts.length > 20);
  for (const fact of pmid42717033ScientificFacts) {
    assert.equal(scientificFactSchema.safeParse(fact).success, true);
    assert.equal(fact.studyType, "randomized_controlled_trial");
    assert.equal(fact.origin.kind, "source");
    assert.ok(
      fact.provenance.every(
        (item) => item.target.kind === "evidence_anchor" && anchorIds.has(item.target.id),
      ),
    );
  }
  assert.equal(
    new Set(pmid42717033ScientificFacts.map((fact) => fact.id)).size,
    pmid42717033ScientificFacts.length,
  );
});

test("RCT grammar preserves KCCQ-TSS and 6MWD numerical relations", () => {
  const kccq = availableResult("kccq-tss");
  assert.deepEqual(
    [
      kccq.estimate.value,
      kccq.estimate.unit,
      kccq.estimate.pValue,
      kccq.estimate.confidenceInterval,
    ],
    [
      -1.4,
      "point",
      { status: "available", value: { operator: "equal", value: 0.29 } },
      { status: "available", value: { lower: -3.9, upper: 1.2, levelPercent: 95 } },
    ],
  );

  const walk = availableResult("6mwd");
  assert.deepEqual(
    [
      walk.estimate.value,
      walk.estimate.unit,
      walk.estimate.pValue,
      walk.estimate.confidenceInterval,
    ],
    [
      3.8,
      "m",
      { status: "available", value: { operator: "equal", value: 0.28 } },
      { status: "available", value: { lower: -3.1, upper: 10.8, levelPercent: 95 } },
    ],
  );
  for (const result of [kccq, walk]) {
    assert.deepEqual(result.timepoint, { value: 16, unit: "week" });
    assert.equal(result.pooling.status, "pooled");
    assert.deepEqual(result.pooling.status === "pooled" && result.pooling.pooledArmIds, [
      "mitiperstat-2.5-mg",
      "mitiperstat-5-mg",
    ]);
  }
});

test("pooled estimates cannot masquerade as an individual dose result", () => {
  const kccq = availableResult("kccq-tss");
  assert.equal(kccq.arms.filter((arm) => arm.role === "intervention").length, 2);
  const invalid = structuredClone(
    pmid42717033ScientificFacts.find(
      (fact) =>
        fact.availability.status === "available" && fact.availability.value.type === "result",
    ),
  );
  assert.ok(
    invalid &&
      invalid.availability.status === "available" &&
      invalid.availability.value.type === "result",
  );
  invalid.availability.value.pooling = {
    status: "pooled",
    pooledArmIds: ["placebo", "mitiperstat-5-mg"],
  };
  assert.equal(scientificFactSchema.safeParse(invalid).success, false);
});

test("confidence intervals and p-values remain inside their estimate", () => {
  const invalid = structuredClone(
    pmid42717033ScientificFacts.find(
      (fact) =>
        fact.availability.status === "available" && fact.availability.value.type === "result",
    ),
  );
  assert.ok(
    invalid &&
      invalid.availability.status === "available" &&
      invalid.availability.value.type === "result",
  );
  invalid.availability.value.estimate.confidenceInterval = {
    status: "available",
    value: { lower: 2, upper: 3, levelPercent: 95 },
  };
  assert.equal(scientificFactSchema.safeParse(invalid).success, false);
  const invalidPValue = structuredClone(
    pmid42717033ScientificFacts.find(
      (fact) =>
        fact.availability.status === "available" && fact.availability.value.type === "result",
    ),
  );
  assert.ok(
    invalidPValue &&
      invalidPValue.availability.status === "available" &&
      invalidPValue.availability.value.type === "result",
  );
  // @ts-expect-error deliberately verifies that a detached scalar p-value is rejected at runtime.
  invalidPValue.availability.value.estimate.pValue = 0.29;
  assert.equal(scientificFactSchema.safeParse(invalidPValue).success, false);
});

test("RCT grammar accepts a fully structured slope difference", () => {
  const result = structuredClone(
    pmid42717033ScientificFacts.find(
      (fact) =>
        fact.availability.status === "available" && fact.availability.value.type === "result",
    ),
  );
  assert.ok(
    result?.availability.status === "available" && result.availability.value.type === "result",
  );
  result.availability.value.estimate = {
    measureType: "slope_difference",
    value: 3.02,
    unit: "ml/min/1.73 m2/year",
    confidenceInterval: {
      status: "available",
      value: { lower: 2.02, upper: 4.01, levelPercent: 95 },
    },
    pValue: { status: "available", value: { operator: "less_than", value: 0.001 } },
  };
  const parsed = scientificFactSchema.safeParse(result);
  assert.equal(parsed.success, true);
  if (parsed.success && parsed.data.availability.status === "available") {
    assert.deepEqual(parsed.data.availability.value, result.availability.value);
    assert.deepEqual(parsed.data.provenance, result.provenance);
  }
});

test("slope differences reject malformed confidence intervals and missing units", () => {
  const result = structuredClone(
    pmid42717033ScientificFacts.find(
      (fact) =>
        fact.availability.status === "available" && fact.availability.value.type === "result",
    ),
  );
  assert.ok(
    result?.availability.status === "available" && result.availability.value.type === "result",
  );
  const estimate = {
    measureType: "slope_difference",
    value: 3.02,
    unit: "ml/min/1.73 m2/year",
    confidenceInterval: {
      status: "available",
      value: { lower: 4.01, upper: 2.02, levelPercent: 95 },
    },
    pValue: { status: "available", value: { operator: "less_than", value: 0.001 } },
  };
  assert.equal(
    scientificFactSchema.safeParse({
      ...result,
      availability: { ...result.availability, value: { ...result.availability.value, estimate } },
    }).success,
    false,
  );
  const { unit: _unit, ...withoutUnit } = estimate;
  assert.equal(
    scientificFactSchema.safeParse({
      ...result,
      availability: {
        ...result.availability,
        value: { ...result.availability.value, estimate: withoutUnit },
      },
    }).success,
    false,
  );
});

test("arms accept only positive integer randomized sample sizes", () => {
  const arm = structuredClone(
    pmid42717033ScientificFacts.find(
      (fact) => fact.availability.status === "available" && fact.availability.value.type === "arm",
    ),
  );
  assert.ok(arm?.availability.status === "available" && arm.availability.value.type === "arm");
  const armValue = arm.availability.value;
  const withSampleSize = (randomizedSampleSize: unknown) => ({
    ...arm,
    availability: {
      ...arm.availability,
      value: { ...armValue, randomizedSampleSize },
    },
  });
  assert.equal(scientificFactSchema.safeParse(withSampleSize(238)).success, true);
  for (const invalid of [0, -1, 1.5, "238"]) {
    assert.equal(scientificFactSchema.safeParse(withSampleSize(invalid)).success, false);
  }
});

test("rct.v1 rejects malformed risk differences and invalid analysis typing", () => {
  const riskDifference = structuredClone(
    pmid42670964ScientificFacts.find(({ id }) => id.endsWith("result-primary-risk-difference")),
  );
  assert.ok(
    riskDifference?.availability.status === "available" &&
      riskDifference.availability.value.type === "result",
  );
  const value = riskDifference.availability.value;
  for (const estimate of [
    { ...value.estimate, unit: "ratio" },
    {
      ...value.estimate,
      confidenceInterval: {
        status: "available",
        value: { lower: -1.3, upper: 1.2, levelPercent: 0 },
      },
    },
    { ...value.estimate, measureType: "time_to_event" },
  ])
    assert.equal(
      scientificFactSchema.safeParse({
        ...riskDifference,
        availability: { ...riskDifference.availability, value: { ...value, estimate } },
      }).success,
      false,
    );
  assert.equal(
    scientificFactSchema.safeParse({
      ...riskDifference,
      availability: {
        ...riskDifference.availability,
        value: { ...value, analysisType: "time_to_event" },
      },
    }).success,
    false,
  );
});

test("arm estimates enforce single-arm semantics and reported numeric bounds", () => {
  const armEstimate = structuredClone(
    pmid42670964ScientificFacts.find(({ id }) => id.endsWith("arm-primary-clopidogrel")),
  );
  assert.ok(
    armEstimate?.availability.status === "available" &&
      armEstimate.availability.value.type === "arm_estimate",
  );
  const value = armEstimate.availability.value;
  const invalidValues = [
    { ...value, eventCount: { status: "available", value: -1 } },
    {
      ...value,
      eventCount: { status: "available", value: 101 },
      denominator: { status: "available", value: 100 },
    },
    { ...value, denominator: { status: "available", value: 0 } },
    { ...value, estimate: { measureType: "percentage", value: 101, unit: "percent" } },
    { ...value, arms: [{ armId: value.armId, role: "intervention" }] },
  ];
  for (const invalid of invalidValues)
    assert.equal(
      scientificFactSchema.safeParse({
        ...armEstimate,
        availability: { ...armEstimate.availability, value: invalid },
      }).success,
      false,
    );
});

test("noninferiority is typed and cannot become equivalence or superiority", () => {
  const hypothesis = structuredClone(
    pmid42670964ScientificFacts.find(({ id }) => id.endsWith("hypothesis-primary-noninferiority")),
  );
  assert.ok(
    hypothesis?.availability.status === "available" &&
      hypothesis.availability.value.type === "statistical_hypothesis",
  );
  const value = hypothesis.availability.value;
  for (const invalid of [
    { ...value, margin: { value: -2.3, unit: "percentage_points" } },
    { ...value, margin: { value: 2.3 } },
    { ...value, confidenceLevelPercent: 100 },
    { ...value, hypothesisType: "equivalence" },
    { ...value, hypothesisType: "superiority" },
  ])
    assert.equal(
      scientificFactSchema.safeParse({
        ...hypothesis,
        availability: { ...hypothesis.availability, value: invalid },
      }).success,
      false,
    );
});

test("composite endpoint components reject duplicate IDs", () => {
  const endpoint = structuredClone(
    pmid42670964ScientificFacts.find(({ id }) => id.endsWith("endpoint-primary")),
  );
  assert.ok(
    endpoint?.availability.status === "available" &&
      endpoint.availability.value.type === "endpoint" &&
      endpoint.availability.value.components,
  );
  const [component] = endpoint.availability.value.components;
  endpoint.availability.value.components = [component, component];
  assert.equal(scientificFactSchema.safeParse(endpoint).success, false);
});

test("source and derived facts have distinct, enforced provenance", () => {
  const source = pmid42717033ScientificFacts[0];
  for (const relation of ["supports", "qualifies", "contradicts", "defines"] as const) {
    assert.equal(
      scientificFactSchema.safeParse({
        ...source,
        provenance: [{ ...source.provenance[0], relation }],
      }).success,
      true,
    );
  }
  assert.equal(
    scientificFactSchema.safeParse({
      ...source,
      origin: { kind: "source" },
      provenance: [
        {
          target: { kind: "scientific_fact", id: source.id },
          relation: "derived_from",
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    scientificFactSchema.safeParse({
      ...source,
      id: "derived-example",
      origin: { kind: "derived", inputFactIds: [source.id], method: "declared-method-v1" },
      provenance: [
        {
          target: { kind: "scientific_fact", id: source.id },
          relation: "derived_from",
        },
      ],
    }).success,
    true,
  );
  assert.equal(
    scientificFactSchema.safeParse({ ...source, interpretation: "clinically meaningful" }).success,
    false,
  );
  assert.equal(
    scientificFactSchema.safeParse({ ...source, editorialProse: "A breakthrough" }).success,
    false,
  );
});

test("the fixture does not infer arm sizes, rash denominators, translations, or full text", () => {
  const facts = pmid42717033ScientificFacts.flatMap((fact) =>
    fact.availability.status === "available" ? [fact.availability.value] : [],
  );
  const arms = facts.filter((value) => value.type === "arm");
  assert.ok(arms.every((arm) => !("sampleSize" in arm)));
  const rash = facts.filter((value) => value.type === "safety_event");
  assert.ok(rash.every((event) => event.denominator.status === "not_reported_in_source"));
  assert.ok(pmid42717033EvidenceAnchors.every((anchor) => !("translation" in anchor)));
  assert.equal(pmid42717033SourceDocument.textStorage, "anchors_only");
});

test("study design remains separate from quality and topic confidence", () => {
  const fact = pmid42717033ScientificFacts[0];
  assert.equal(
    scientificFactSchema.safeParse({ ...fact, methodologicalQuality: "high" }).success,
    false,
  );
  assert.equal(scientificFactSchema.safeParse({ ...fact, topicConfidence: 0.99 }).success, false);
});
