import {
  createPmid42717033EvaluationCase,
  type EditorialEvaluationMetrics,
  type RecordedEditorialEvaluationResponse,
} from "./evaluation-lab";
import { EDITORIAL_REAL_EXPERIMENT_MAX_OUTPUT_TOKENS } from "./real-experiment.server";
import type { PersistedRestrictedExperimentCapture } from "./restricted-experiment-capture.server";

function providerReportedTokenUsage(
  capture: PersistedRestrictedExperimentCapture,
): EditorialEvaluationMetrics["tokenUsage"] {
  const usage = capture.providerMetrics?.usage;
  if (
    !usage ||
    !Number.isInteger(usage.inputTokens) ||
    usage.inputTokens < 0 ||
    !Number.isInteger(usage.outputTokens) ||
    usage.outputTokens < 0
  )
    return null;
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    source: "provider_reported",
  };
}

/**
 * Offline-only projection from the private operational record to the Phase 1.9A lab contract.
 * Provenance is mandatory so fixtures can never be silently represented as real provider output.
 */
export function adaptRestrictedCaptureToRecordedEditorialResponse(
  capture: PersistedRestrictedExperimentCapture,
  provenance: RecordedEditorialEvaluationResponse["provenance"],
): RecordedEditorialEvaluationResponse {
  const { snapshot } = createPmid42717033EvaluationCase();
  if (capture.caseId !== snapshot.caseId || capture.caseFingerprint !== snapshot.caseFingerprint)
    throw new Error("Restricted capture does not belong to the frozen evaluation case");
  if (
    capture.outcome !== "completed" ||
    capture.normalizedProviderResponse?.status !== "completed" ||
    typeof capture.normalizedProviderResponse.output_text !== "string"
  )
    throw new Error("Restricted capture has no complete normalized model response");

  let response: unknown;
  try {
    response = JSON.parse(capture.normalizedProviderResponse.output_text);
  } catch {
    throw new Error("Restricted capture output is not valid JSON");
  }
  return {
    experimentId: capture.experimentId,
    caseId: snapshot.caseId,
    caseFingerprint: snapshot.caseFingerprint,
    modelIdentifier: capture.modelIdentifier,
    configuration: {
      providerIdentifier: "openai",
      modelIdentifier: capture.modelIdentifier,
      shared: {
        maxOutputTokens: EDITORIAL_REAL_EXPERIMENT_MAX_OUTPUT_TOKENS,
        responseFormat: "scientific_editorial_draft.v5.strict_json_schema",
        additionalInstructions: null,
      },
      modelSpecific: { reasoningMode: "standard", reasoningEffort: "medium" },
    },
    provenance,
    response,
    metrics: {
      tokenUsage: providerReportedTokenUsage(capture),
      // The capture has a conservative ceiling, not an observed cost. Do not relabel it as cost.
      cost: null,
      latency: { milliseconds: capture.durationMs, source: "client_measured" },
    },
    humanReview: null,
  };
}
