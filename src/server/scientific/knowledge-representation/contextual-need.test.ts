import assert from "node:assert/strict";
import test from "node:test";
import {
  pmid41910396EvidenceSet,
  pmid41910396FactSet,
  pmid41910396Interpretation,
  pmid41910396SourceSet,
} from "./pmid-41910396.fixture";
import {
  pmid42670964EvidenceSet,
  pmid42670964FactSet,
  pmid42670964Interpretation,
  pmid42670964SourceSet,
} from "./pmid-42670964.fixture";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "./pmid-42717033.fixture";
import { contextualNeedSchema, detectContextualNeeds } from "./contextual-need";

const canaries = [
  {
    articleId: "pmid:41910396",
    sourceSet: pmid41910396SourceSet,
    evidenceSet: pmid41910396EvidenceSet,
    factSet: pmid41910396FactSet,
    interpretation: pmid41910396Interpretation,
    expectedEndpointIds: ["annualized-total-egfr-slope"],
  },
  {
    articleId: "pmid:42670964",
    sourceSet: pmid42670964SourceSet,
    evidenceSet: pmid42670964EvidenceSet,
    factSet: pmid42670964FactSet,
    interpretation: pmid42670964Interpretation,
    expectedEndpointIds: [],
  },
  {
    articleId: "pmid:42717033",
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretation: pmid42717033Interpretation,
    expectedEndpointIds: ["6mwd", "kccq-tss"],
  },
] as const;

test("the generic rule records its actual behavior across all scientific canaries", () => {
  for (const canary of canaries) {
    const needs = detectContextualNeeds(canary);
    assert.deepEqual(
      needs.map(({ subject }) => subject.endpointId),
      canary.expectedEndpointIds,
      canary.articleId,
    );
    assert.ok(needs.every((need) => contextualNeedSchema.safeParse(need).success));
  }
});

test("detection is deterministic and produces only candidate endpoint explanation needs", () => {
  const first = detectContextualNeeds(canaries[2]);
  const second = detectContextualNeeds(structuredClone(canaries[2]));
  assert.deepEqual(first, second);

  for (const need of first) {
    assert.equal(need.status, "candidate");
    assert.equal(need.editorialPurpose, "explain_endpoint_measure");
    assert.deepEqual(Object.keys(need).sort(), [
      "articleId",
      "contextualQuestion",
      "detectedGap",
      "editorialPurpose",
      "evidenceAnchorIds",
      "method",
      "status",
      "subject",
      "supportingFactIds",
      "version",
    ]);
  }
});

test("article identity and artifact lineage mismatches fail before detection", () => {
  const mismatched = structuredClone(canaries[2]);
  mismatched.evidenceSet.articleId = "pmid:different";
  assert.throws(() => detectContextualNeeds(mismatched), /PIPELINE_ARTICLE_MISMATCH/);

  const brokenLineage = structuredClone(canaries[2]);
  brokenLineage.factSet.evidenceSet.id = "missing";
  assert.throws(() => detectContextualNeeds(brokenLineage), /PIPELINE_EVIDENCE_LINEAGE_BROKEN/);
});

test("candidate fact and evidence IDs resolve through the validated pipeline", () => {
  for (const canary of canaries) {
    const factIds = new Set(canary.factSet.facts.map(({ id }) => id));
    const anchorIds = new Set(canary.evidenceSet.anchors.map(({ id }) => id));
    for (const need of detectContextualNeeds(canary)) {
      assert.ok(need.supportingFactIds.every((id) => factIds.has(id)));
      assert.ok(need.evidenceAnchorIds.every((id) => anchorIds.has(id)));
    }
  }
});

test("secondary endpoints do not become candidates automatically", () => {
  const needs = detectContextualNeeds(canaries[1]);
  assert.equal(
    needs.some(({ subject }) => subject.endpointId.startsWith("key-secondary")),
    false,
  );
});

test("a central composite with structured components can produce zero candidates", () => {
  assert.deepEqual(detectContextualNeeds(canaries[1]), []);
});

test("selection uses only endpoint structure, central role, and represented results", () => {
  const renamed = structuredClone(canaries[2]);
  const endpoint = renamed.factSet.facts.find(
    (fact) =>
      fact.availability.status === "available" &&
      fact.availability.value.type === "endpoint" &&
      fact.availability.value.endpointId === "kccq-tss",
  );
  assert.ok(endpoint?.availability.status === "available");
  assert.equal(endpoint.availability.value.type, "endpoint");
  endpoint.availability.value.endpointId = "opaque-endpoint";
  endpoint.availability.value.name = "Opaque measure";
  endpoint.availability.value.measure = "opaque structured measure";
  const result = renamed.factSet.facts.find(
    (fact) =>
      fact.availability.status === "available" &&
      fact.availability.value.type === "result" &&
      fact.availability.value.endpointId === "kccq-tss",
  );
  assert.ok(result?.availability.status === "available");
  assert.equal(result.availability.value.type, "result");
  result.availability.value.endpointId = "opaque-endpoint";

  assert.ok(
    detectContextualNeeds(renamed).some(
      ({ subject, contextualQuestion }) =>
        subject.endpointId === "opaque-endpoint" &&
        contextualQuestion === "What does opaque structured measure measure?",
    ),
  );
});

test("unvalidated artifacts are rejected", () => {
  const pending = structuredClone(canaries[0]);
  pending.sourceSet.validation.status = "pending";
  assert.throws(() => detectContextualNeeds(pending), /requires validated sourceSet/);
});
