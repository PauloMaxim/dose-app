import assert from "node:assert/strict";
import test from "node:test";
import {
  compareRecordedEditorialResponses,
  createPmid42717033EvaluationCase,
  evaluateRecordedEditorialResponse,
} from "./evaluation-lab";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";

test("freezes the authorized PMID 42717033 case identity and context limits", () => {
  const { snapshot } = createPmid42717033EvaluationCase();
  assert.equal(snapshot.articleId, "pmid:42717033");
  assert.equal(snapshot.promptVersion, "scientific-editorial-prompt.v6");
  assert.equal(snapshot.artifacts.contextualMaterial.length, 2);
  assert.deepEqual(snapshot.authorizedContextLimits.sourceAccessScopes, ["abstract"]);
  assert.equal(snapshot.authorizedContextLimits.externalContextReferenceIds.length, 2);
  assert.equal(snapshot.authorizedContextLimits.contextualClaimIds.length, 2);
});

test("reports deterministic validation separately from absent human review and metrics", async () => {
  const report = await evaluateRecordedEditorialResponse({
    modelIdentifier: "sol-test-double",
    configuration: { temperature: "not_applicable_to_fixture" },
    provenance: "synthetic_test_fixture",
    response: pmid42717033ExperimentalDraft,
  });
  assert.equal(report.automaticEvaluation.validationStatus, "passed");
  assert.equal(report.automaticEvaluation.scientificApproval, false);
  assert.equal(report.humanReview.fidelityToFactsNumbersUnitsIntervalsAndHorizons, null);
  assert.equal(report.humanReview.reviewTimeMinutes, null);
  assert.equal(report.metrics.inputTokens, null);
  assert.equal(report.metrics.estimatedCostUsd, null);
});

test("retains validator errors for a synthetic rejected response", async () => {
  const invalid = structuredClone(pmid42717033ExperimentalDraft) as Record<string, unknown>;
  invalid.reviewStatus = "approved";
  const report = await evaluateRecordedEditorialResponse({
    modelIdentifier: "luna-test-double",
    configuration: {},
    provenance: "synthetic_test_fixture",
    response: invalid,
  });
  assert.equal(report.automaticEvaluation.validationStatus, "rejected");
  assert.ok(report.automaticEvaluation.validationErrors.length > 0);
  assert.ok(
    report.automaticEvaluation.validationErrors.every(
      ({ code }) => code === "DRAFT_SCHEMA_INVALID",
    ),
  );
});

test("compares two recorded responses without selecting a winner", async () => {
  const report = await compareRecordedEditorialResponses([
    {
      modelIdentifier: "sol-test-double",
      configuration: { model: "explicit-sol-test-double" },
      provenance: "synthetic_test_fixture",
      response: pmid42717033ExperimentalDraft,
    },
    {
      modelIdentifier: "luna-test-double",
      configuration: { model: "explicit-luna-test-double" },
      provenance: "synthetic_test_fixture",
      response: pmid42717033ExperimentalDraft,
    },
  ]);
  assert.equal(report.runs.length, 2);
  assert.deepEqual(
    report.runs.map(({ modelIdentifier }) => modelIdentifier),
    ["sol-test-double", "luna-test-double"],
  );
  assert.equal("winner" in report, false);
});
