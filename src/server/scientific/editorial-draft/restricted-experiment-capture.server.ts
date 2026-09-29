import "../server-only";
import { randomUUID } from "node:crypto";
import { chmod, link, open, realpath, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { RestrictedExperimentCapture } from "./real-experiment.server";

export interface PersistedRestrictedExperimentCapture {
  experimentId: string;
  caseId: string;
  caseFingerprint: string;
  requestHash: string;
  confirmationId: string;
  label: RestrictedExperimentCapture["label"];
  modelIdentifier: string;
  startedAt: string;
  durationMs: number;
  estimatedMaximumCostUsd: number;
  providerReportedCostUsd: null;
  normalizedProviderResponse: RestrictedExperimentCapture["normalizedProviderResponse"];
  providerMetrics: RestrictedExperimentCapture["providerMetrics"];
  validationResult: RestrictedExperimentCapture["result"];
  outcome: "completed" | "failed_or_incomplete";
}

function isWithin(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function captureFileName(capture: RestrictedExperimentCapture): string {
  const safeConfirmationId = capture.confirmationId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${capture.experimentId.replace(/[^a-zA-Z0-9._-]/g, "_")}-${safeConfirmationId}.json`;
}

export async function assertPrivateCaptureDestination(
  destinationDirectory: string,
  repositoryRoot: string,
): Promise<string> {
  if (!destinationDirectory.trim()) throw new Error("A private capture destination is required");
  const [destination, repository] = await Promise.all([
    realpath(resolve(destinationDirectory)),
    realpath(resolve(repositoryRoot)),
  ]);
  if (isWithin(repository, destination))
    throw new Error("The private capture destination must be outside the repository");
  await chmod(destination, 0o700);
  return destination;
}

/**
 * Persists the private Phase 1.9A input without printing it or placing it in the repository.
 * The destination must already exist so its ownership and backing storage can be reviewed first.
 */
export async function persistRestrictedExperimentCapture(
  destinationDirectory: string,
  repositoryRoot: string,
  capture: RestrictedExperimentCapture,
): Promise<string> {
  const destination = await assertPrivateCaptureDestination(destinationDirectory, repositoryRoot);

  const record: PersistedRestrictedExperimentCapture = {
    experimentId: capture.experimentId,
    caseId: capture.caseId,
    caseFingerprint: capture.caseFingerprint,
    requestHash: capture.requestHash,
    confirmationId: capture.confirmationId,
    label: capture.label,
    modelIdentifier: capture.modelIdentifier,
    startedAt: capture.startedAt,
    durationMs: capture.durationMs,
    estimatedMaximumCostUsd: capture.estimatedMaximumCostUsd,
    providerReportedCostUsd: capture.providerReportedCostUsd,
    normalizedProviderResponse: capture.normalizedProviderResponse,
    providerMetrics: capture.providerMetrics,
    validationResult: capture.result,
    outcome: capture.error ? "failed_or_incomplete" : "completed",
  };
  const finalPath = resolve(destination, captureFileName(capture));
  const temporaryPath = resolve(destination, `.${captureFileName(capture)}.${randomUUID()}.tmp`);
  try {
    const temporary = await open(temporaryPath, "wx", 0o600);
    try {
      await temporary.writeFile(`${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8" });
      await temporary.sync();
    } finally {
      await temporary.close();
    }
    // link is atomic and, unlike rename, refuses to overwrite an existing capture.
    await link(temporaryPath, finalPath);
    const directory = await open(destination, "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  return finalPath;
}
