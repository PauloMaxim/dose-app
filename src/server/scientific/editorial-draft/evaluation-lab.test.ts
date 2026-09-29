import assert from "node:assert/strict";
import test from "node:test";
import {
  compareRecordedEditorialResponses,
  computeEditorialEvaluationCaseFingerprint,
  createPmid42717033EvaluationCase,
  evaluateRecordedEditorialResponse,
  type RecordedEditorialEvaluationResponse,
} from "./evaluation-lab";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";

function recordedResponse(
  modelIdentifier: string,
  overrides: Partial<RecordedEditorialEvaluationResponse> = {},
): RecordedEditorialEvaluationResponse {
  const { snapshot } = createPmid42717033EvaluationCase();
  return {
    experimentId: "experiment:phase-1.9a:test:v1",
    caseId: snapshot.caseId,
    caseFingerprint: snapshot.caseFingerprint,
    modelIdentifier,
    configuration: {
      providerIdentifier: `${modelIdentifier}-provider`,
      modelIdentifier,
      shared: {
        maxOutputTokens: 8_000,
        responseFormat: "scientific_editorial_draft.v5.strict_json_schema",
        additionalInstructions: null,
      },
      modelSpecific: { reasoningEffort: modelIdentifier === "sol-test-double" ? "high" : "medium" },
    },
    provenance: "synthetic_test_fixture",
    response: pmid42717033ExperimentalDraft,
    metrics: null,
    humanReview: null,
    ...overrides,
  };
}

test("fingerprints the complete authorized PMID 42717033 case deterministically", () => {
  const first = createPmid42717033EvaluationCase();
  const second = createPmid42717033EvaluationCase();
  assert.match(first.snapshot.caseFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.snapshot.caseFingerprint, second.snapshot.caseFingerprint);
  assert.deepEqual(first.snapshot.authorizedContextLimits.sourceAccessScopes, ["abstract"]);
  assert.equal(first.snapshot.authorizedContextLimits.externalContextReferenceIds.length, 2);

  const changed = structuredClone(first.input);
  (changed.contextualMaterial[0] as { claims: Array<{ statement: string }> }).claims[0].statement +=
    " changed";
  assert.notEqual(
    computeEditorialEvaluationCaseFingerprint(changed),
    first.snapshot.caseFingerprint,
  );
});

test("rejects a response whose declared case identity diverges", async () => {
  await assert.rejects(
    evaluateRecordedEditorialResponse({
      ...recordedResponse("sol-test-double"),
      caseFingerprint: `sha256:${"0".repeat(64)}`,
    }),
    /does not belong to the frozen evaluation case/,
  );
  await assert.rejects(
    evaluateRecordedEditorialResponse({
      ...recordedResponse("sol-test-double"),
      caseId: "editorial-evaluation:another-case:v1",
    }),
  );
});

test("keeps absent observations null and accepts complete valid observations", async () => {
  const absent = await evaluateRecordedEditorialResponse(recordedResponse("sol-test-double"));
  assert.equal(absent.metrics, null);
  assert.equal(absent.humanReview, null);
  assert.equal(absent.automaticEvaluation.scientificApproval, false);

  const complete = await evaluateRecordedEditorialResponse({
    ...recordedResponse("sol-test-double"),
    metrics: {
      tokenUsage: { inputTokens: 100, outputTokens: 50, source: "provider_reported" },
      cost: { kind: "estimated", amountUsd: 0.12, basis: "price-list:2026-09-29" },
      latency: { milliseconds: 450, source: "client_measured" },
    },
    humanReview: {
      reviewerId: "reviewer:fixture",
      reviewedAt: "2026-09-29T12:00:00.000Z",
      fidelityToFactsNumbersUnitsIntervalsAndHorizons: { rating: 5, notes: "Fixture check." },
      preservationOfLimitationsAndScientificUncertainty: { rating: 5, notes: "Fixture check." },
      ungroundedClaimsAndImproperExtrapolations: { rating: 5, notes: "Fixture check." },
      authorizedExternalContextUse: { rating: 5, notes: "Fixture check." },
      scientificallyRelevantOmissions: { rating: 5, notes: "Fixture check." },
      editorialClarityDepthAndOrganization: { rating: 5, notes: "Fixture check." },
      correctionRequired: { level: "none", notes: "Fixture check only." },
      reviewTimeMinutes: 3,
    },
  });
  assert.equal(complete.metrics?.cost?.kind, "estimated");
  assert.equal(complete.humanReview?.reviewerId, "reviewer:fixture");
});

test("rejects invalid metrics and incomplete human review", async () => {
  await assert.rejects(
    evaluateRecordedEditorialResponse({
      ...recordedResponse("sol-test-double"),
      metrics: {
        tokenUsage: { inputTokens: -1, outputTokens: 10, source: "provider_reported" },
        cost: null,
        latency: null,
      },
    }),
  );
  await assert.rejects(
    evaluateRecordedEditorialResponse({
      ...recordedResponse("sol-test-double"),
      metrics: {
        tokenUsage: null,
        cost: { kind: "provider_reported", amountUsd: Number.NaN },
        latency: null,
      },
    }),
  );
  const incomplete = {
    reviewerId: "reviewer:fixture",
    reviewedAt: "2026-09-29T12:00:00.000Z",
  };
  await assert.rejects(
    evaluateRecordedEditorialResponse({
      ...recordedResponse("sol-test-double"),
      humanReview: incomplete,
    }),
  );
});

test("retains validator errors for a synthetic rejected response", async () => {
  const invalid = structuredClone(pmid42717033ExperimentalDraft) as Record<string, unknown>;
  invalid.reviewStatus = "approved";
  const report = await evaluateRecordedEditorialResponse(
    recordedResponse("luna-test-double", { response: invalid }),
  );
  assert.equal(report.automaticEvaluation.validationStatus, "rejected");
  assert.ok(report.automaticEvaluation.validationErrors.length > 0);
});

test("requires one experiment and equivalent shared configuration", async () => {
  const sol = recordedResponse("sol-test-double");
  await assert.rejects(
    compareRecordedEditorialResponses([
      sol,
      recordedResponse("luna-test-double", { experimentId: "experiment:other" }),
    ]),
    /same experiment/,
  );
  const luna = recordedResponse("luna-test-double");
  luna.configuration.shared.maxOutputTokens = 4_000;
  await assert.rejects(
    compareRecordedEditorialResponses([sol, luna]),
    /equivalent shared generation conditions/,
  );
});

test("reports permitted model-specific differences without selecting a winner", async () => {
  const report = await compareRecordedEditorialResponses([
    recordedResponse("sol-test-double"),
    recordedResponse("luna-test-double"),
  ]);
  assert.equal(report.runs.length, 2);
  assert.equal(report.experimentId, "experiment:phase-1.9a:test:v1");
  assert.deepEqual(report.configurationDifferences, [
    "providerIdentifier",
    "modelIdentifier",
    "modelSpecific.reasoningEffort",
  ]);
  assert.equal("winner" in report, false);
});
