#!/usr/bin/env tsx
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  PMID_42717033_REAL_EXPERIMENT_PROTOCOL,
  Pmid42717033RealExperimentSession,
  preflightPmid42717033RealExperiment,
  type EditorialExperimentProtocol,
  type ExperimentModel,
} from "../src/server/scientific/editorial-draft/real-experiment.server";
import { openAIEditorialFetchTransport } from "../src/server/scientific/editorial-draft/openai.server";
import { DurableRestrictedExperimentAttemptLedger } from "../src/server/scientific/editorial-draft/restricted-experiment-ledger.server";
import {
  assertPrivateCaptureDestination,
  persistRestrictedExperimentCapture,
} from "../src/server/scientific/editorial-draft/restricted-experiment-capture.server";
import {
  checkOpenAIModelAvailability,
  confirmAndRunRestrictedExperimentCall,
} from "../src/server/scientific/editorial-draft/restricted-experiment-operator.server";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadProtocol(): Promise<EditorialExperimentProtocol> {
  const path = argument("--protocol");
  if (!path) return PMID_42717033_REAL_EXPERIMENT_PROTOCOL;
  return JSON.parse(await readFile(path, "utf8")) as EditorialExperimentProtocol;
}

function printPreflight(protocol: EditorialExperimentProtocol): boolean {
  const preflight = preflightPmid42717033RealExperiment(protocol);
  console.log(`Experiment: ${preflight.experimentId}`);
  console.log(`Case: ${preflight.caseId}`);
  console.log(`Case fingerprint: ${preflight.caseFingerprint}`);
  for (const call of preflight.calls) {
    console.log(`\n${call.label.toUpperCase()}`);
    console.log(`  model: ${call.modelIdentifier ?? "UNVERIFIED"}`);
    console.log(`  request hash: ${call.requestHash ?? "UNAVAILABLE"}`);
    console.log(
      `  conservative maximum: ${call.estimatedMaximumCostUsd === null ? "UNKNOWN" : `US$ ${call.estimatedMaximumCostUsd.toFixed(6)}`}`,
    );
  }
  console.log(
    `\nCombined conservative maximum: ${preflight.estimatedMaximumCostUsd === null ? "UNKNOWN" : `US$ ${preflight.estimatedMaximumCostUsd.toFixed(6)}`}`,
  );
  console.log(`Budget: US$ ${preflight.budgetUsd.toFixed(2)}`);
  console.log(`Preflight: ${preflight.ok ? "PASS" : "BLOCKED"}`);
  for (const blocker of preflight.blockers) console.log(`  - ${blocker}`);
  return preflight.ok;
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? "preflight";
  const protocol = await loadProtocol();
  if (command === "preflight") {
    if (!printPreflight(protocol)) process.exitCode = 2;
    return;
  }
  if (command === "availability") {
    const identifiers = protocol.models.flatMap((model) =>
      model.modelIdentifier ? [model.modelIdentifier] : [],
    );
    if (identifiers.length !== 2)
      throw new Error("Exact model IDs must be verified from official documentation first");
    const result = await checkOpenAIModelAvailability(
      process.env.OPENAI_API_KEY ?? "",
      identifiers,
    );
    console.log(`Checked at: ${result.checkedAt}`);
    for (const identifier of identifiers)
      console.log(
        `${identifier}: ${result.availableModelIdentifiers.includes(identifier) ? "AVAILABLE" : "NOT RETURNED"}`,
      );
    return;
  }
  if (command !== "execute") throw new Error("Use preflight, availability, or execute");

  const label = argument("--model") as ExperimentModel | undefined;
  const ledgerDirectory = argument("--ledger");
  const captureDirectory = argument("--capture");
  const operatorId = argument("--operator");
  if ((label !== "sol" && label !== "luna") || !ledgerDirectory || !captureDirectory || !operatorId)
    throw new Error(
      "execute requires --model sol|luna --ledger <shared-path> --capture <private-path> --operator <id>",
    );
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  if (!printPreflight(protocol)) throw new Error("Blocked preflight forbids execution");
  // Validate the explicitly configured destination before asking for confirmation or entering the
  // paid-call path. Persistence is repeated after the call to detect a changed/symlinked destination.
  await assertPrivateCaptureDestination(captureDirectory, process.cwd());
  const session = new Pmid42717033RealExperimentSession(
    protocol,
    openAIEditorialFetchTransport,
    apiKey,
    new DurableRestrictedExperimentAttemptLedger(ledgerDirectory),
  );
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const capture = await confirmAndRunRestrictedExperimentCall(
      session,
      label,
      operatorId,
      async (details) => {
        console.log(`\nOperator: ${details.operatorId}`);
        console.log(`Model: ${details.label} (${details.modelIdentifier})`);
        console.log(`Request hash: ${details.requestHash}`);
        console.log(`Maximum cost: US$ ${details.estimatedMaximumCostUsd.toFixed(6)}`);
        return prompt.question(`Type exactly "${details.attestation}" to authorize this call: `);
      },
    );
    const capturePath = await persistRestrictedExperimentCapture(
      captureDirectory,
      process.cwd(),
      capture,
    );
    // Deliberately exclude response and validation content from terminal output.
    console.log(
      JSON.stringify(
        {
          experimentId: capture.experimentId,
          label: capture.label,
          modelIdentifier: capture.modelIdentifier,
          requestHash: capture.requestHash,
          confirmationId: capture.confirmationId,
          startedAt: capture.startedAt,
          durationMs: capture.durationMs,
          estimatedMaximumCostUsd: capture.estimatedMaximumCostUsd,
          providerMetrics: capture.providerMetrics,
          outcome: capture.error ? "failed_or_incomplete" : "completed",
          capturePath,
        },
        null,
        2,
      ),
    );
  } finally {
    prompt.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Restricted experiment command failed");
  process.exitCode = 1;
});
