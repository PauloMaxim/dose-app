import "../server-only";
import { randomUUID } from "node:crypto";
import {
  EDITORIAL_OPERATOR_ATTESTATION,
  Pmid42717033RealExperimentSession,
  type ExperimentModel,
  type IndividualCallConfirmation,
  type RestrictedExperimentCapture,
} from "./real-experiment.server";

export interface ModelAvailabilityResult {
  checkedAt: string;
  availableModelIdentifiers: readonly string[];
}

/** Credentialed read-only account check. The key is used only in the Authorization header. */
export async function checkOpenAIModelAvailability(
  apiKey: string,
  requestedModelIdentifiers: readonly string[],
  fetchImplementation: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<ModelAvailabilityResult> {
  if (!apiKey.trim()) throw new Error("OPENAI_API_KEY is required for the read-only account check");
  const response = await fetchImplementation("https://api.openai.com/v1/models", {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok)
    throw new Error(`Model availability check failed with status ${response.status}`);
  const body = (await response.json()) as { data?: { id?: unknown }[] };
  const accountModels = new Set(
    (body.data ?? []).flatMap((item) => (typeof item.id === "string" ? [item.id] : [])),
  );
  return {
    checkedAt: new Date(now()).toISOString(),
    availableModelIdentifiers: requestedModelIdentifiers.filter((id) => accountModels.has(id)),
  };
}

export interface OperatorConfirmationPrompt {
  operatorId: string;
  label: ExperimentModel;
  modelIdentifier: string;
  requestHash: string;
  estimatedMaximumCostUsd: number;
  attestation: typeof EDITORIAL_OPERATOR_ATTESTATION;
}

export type AskOperator = (prompt: OperatorConfirmationPrompt) => Promise<string>;

/**
 * Restricted operator boundary. It shows the exact identity and maximum cost, then creates a
 * short-lived confirmation only when the identified human types the complete attestation.
 */
export async function confirmAndRunRestrictedExperimentCall(
  session: Pmid42717033RealExperimentSession,
  label: ExperimentModel,
  operatorId: string,
  askOperator: AskOperator,
  now: () => number = Date.now,
  confirmationId: () => string = randomUUID,
): Promise<RestrictedExperimentCapture> {
  if (!operatorId.trim()) throw new Error("An identified operator is required");
  if (!session.preflight.ok)
    throw new Error(`Experiment preflight failed: ${session.preflight.blockers.join("; ")}`);
  const call = session.preflight.calls.find((candidate) => candidate.label === label);
  if (!call?.modelIdentifier || !call.requestHash || call.estimatedMaximumCostUsd === null)
    throw new Error("The selected call is not fully configured");

  const answer = await askOperator({
    operatorId,
    label,
    modelIdentifier: call.modelIdentifier,
    requestHash: call.requestHash,
    estimatedMaximumCostUsd: call.estimatedMaximumCostUsd,
    attestation: EDITORIAL_OPERATOR_ATTESTATION,
  });
  if (answer !== EDITORIAL_OPERATOR_ATTESTATION)
    throw new Error("The exact human attestation was not provided; no call was made");

  const confirmation: IndividualCallConfirmation = {
    confirmationId: confirmationId(),
    operatorId,
    operatorAttestation: EDITORIAL_OPERATOR_ATTESTATION,
    experimentId: session.preflight.experimentId,
    label,
    modelIdentifier: call.modelIdentifier,
    caseId: session.preflight.caseId,
    caseFingerprint: session.preflight.caseFingerprint,
    requestHash: call.requestHash,
    estimatedMaximumCostUsd: call.estimatedMaximumCostUsd,
    confirmedAt: new Date(now()).toISOString(),
  };
  return session.run(label, confirmation);
}
