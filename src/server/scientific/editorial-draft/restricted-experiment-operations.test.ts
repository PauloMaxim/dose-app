import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";
import {
  EDITORIAL_OPERATOR_ATTESTATION,
  EDITORIAL_REAL_EXPERIMENT_ID,
  Pmid42717033RealExperimentSession,
  type EditorialExperimentProtocol,
  type ExperimentAttemptClaim,
} from "./real-experiment.server";
import { DurableRestrictedExperimentAttemptLedger } from "./restricted-experiment-ledger.server";
import {
  assertPrivateCaptureDestination,
  type PersistedRestrictedExperimentCapture,
  persistRestrictedExperimentCapture,
} from "./restricted-experiment-capture.server";
import { adaptRestrictedCaptureToRecordedEditorialResponse } from "./restricted-capture-evaluation-adapter";
import {
  createPmid42717033EvaluationCase,
  evaluateRecordedEditorialResponse,
} from "./evaluation-lab";
import {
  checkOpenAIModelAvailability,
  confirmAndRunRestrictedExperimentCall,
} from "./restricted-experiment-operator.server";
import type { OpenAIEditorialTransport } from "./openai.server";

const NOW = Date.parse("2026-09-29T12:00:00.000Z");

function verifiedProtocol(): EditorialExperimentProtocol {
  const verification = {
    sourceUrl: "https://developers.openai.com/test-only",
    checkedAt: new Date(NOW).toISOString(),
  };
  return {
    experimentId: EDITORIAL_REAL_EXPERIMENT_ID,
    budgetUsd: 1,
    maxCallsTotal: 2,
    maxCallsPerModel: 1,
    retries: 0,
    timeoutMs: 90_000,
    maxOutputTokens: 8_000,
    accountFunding: { availableUsd: 1, ...verification },
    models: ["sol", "luna"].map((label) => ({
      label: label as "sol" | "luna",
      providerIdentifier: "openai" as const,
      modelIdentifier: `${label}-synthetic-test-model`,
      accountAvailabilityVerifiedAt: verification.checkedAt,
      capabilities: {
        strictJsonSchema: true as const,
        standardReasoningWithMediumEffort: true as const,
        ...verification,
      },
      pricing: {
        inputUsdPerMillionTokens: 1,
        outputUsdPerMillionTokens: 2,
        reasoningUsdPerMillionTokens: 2,
        ...verification,
      },
      reasoning: { mode: "standard" as const, effort: "medium" as const },
    })) as unknown as EditorialExperimentProtocol["models"],
  };
}

function claim(label: "sol" | "luna", confirmationId: string): ExperimentAttemptClaim {
  return {
    experimentId: EDITORIAL_REAL_EXPERIMENT_ID,
    caseFingerprint: "sha256:test-case",
    label,
    modelIdentifier: `${label}-synthetic-test-model`,
    requestHash: `sha256:${label}`,
    confirmationId,
    attemptedAt: new Date(NOW).toISOString(),
  };
}

test("durable ledger preserves claims and completions across instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dose-editorial-ledger-"));
  try {
    const first = new DurableRestrictedExperimentAttemptLedger(directory);
    assert.equal(await first.claim(claim("sol", "confirmation-sol")), true);
    await first.complete({
      confirmationId: "confirmation-sol",
      outcome: "failed_or_incomplete",
      completedAt: new Date(NOW + 1).toISOString(),
    });

    const restarted = new DurableRestrictedExperimentAttemptLedger(directory);
    assert.equal(await restarted.claim(claim("sol", "confirmation-sol-retry")), false);
    assert.equal(await restarted.claim(claim("luna", "confirmation-luna")), true);
    assert.equal(await restarted.claim(claim("luna", "confirmation-third")), false);
    const stored = await readFile(join(directory, "attempts", "confirmation-sol.json"), "utf8");
    assert.match(stored, /failed_or_incomplete/);
    assert.doesNotMatch(stored, /api[_-]?key|authorization/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("account availability check is GET-only and does not expose the credential", async () => {
  const observations: { input?: string; init?: RequestInit } = {};
  const result = await checkOpenAIModelAvailability(
    "secret-test-credential",
    ["sol-id", "luna-id"],
    (async (input: string | URL | Request, init?: RequestInit) => {
      observations.input = String(input);
      observations.init = init;
      return new Response(JSON.stringify({ data: [{ id: "sol-id" }] }), { status: 200 });
    }) as typeof fetch,
    () => NOW,
  );
  assert.equal(observations.input, "https://api.openai.com/v1/models");
  assert.equal(observations.init?.method, "GET");
  assert.deepEqual(result.availableModelIdentifiers, ["sol-id"]);
  assert.doesNotMatch(JSON.stringify(result), /secret-test-credential/);
});

test("operator sees bound call details and exact attestation is required before transport", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dose-editorial-operator-"));
  let transportCalls = 0;
  const transport: OpenAIEditorialTransport = {
    async create(request) {
      transportCalls += 1;
      return {
        model: String(request.model),
        status: "completed",
        output_text: JSON.stringify(pmid42717033ExperimentalDraft),
      };
    },
  };
  try {
    const rejectedSession = new Pmid42717033RealExperimentSession(
      verifiedProtocol(),
      transport,
      "synthetic-test-key",
      new DurableRestrictedExperimentAttemptLedger(directory),
      () => NOW,
    );
    await assert.rejects(
      confirmAndRunRestrictedExperimentCall(
        rejectedSession,
        "sol",
        "operator:test",
        async (details) => {
          assert.equal(details.modelIdentifier, "sol-synthetic-test-model");
          assert.match(details.requestHash, /^sha256:/);
          assert.ok(details.estimatedMaximumCostUsd > 0);
          return "no";
        },
        () => NOW,
      ),
      /exact human attestation/,
    );
    assert.equal(transportCalls, 0);

    const capture = await confirmAndRunRestrictedExperimentCall(
      rejectedSession,
      "sol",
      "operator:test",
      async () => EDITORIAL_OPERATOR_ATTESTATION,
      () => NOW,
      () => "confirmation-approved",
    );
    assert.equal(capture.error, null);
    assert.equal(transportCalls, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("private capture preserves the offline-lab record with restricted permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "dose-editorial-capture-"));
  const ledgerDirectory = join(root, "ledger");
  const captureDirectory = join(root, "captures");
  await mkdir(captureDirectory);
  const transport = successfulCaptureTransport();
  try {
    const current = new Pmid42717033RealExperimentSession(
      verifiedProtocol(),
      transport,
      "synthetic-test-key",
      new DurableRestrictedExperimentAttemptLedger(ledgerDirectory),
      () => NOW,
    );
    const capture = await confirmAndRunRestrictedExperimentCall(
      current,
      "sol",
      "operator:test",
      async () => EDITORIAL_OPERATOR_ATTESTATION,
      () => NOW,
      () => "capture-confirmation",
    );
    const path = await persistRestrictedExperimentCapture(captureDirectory, process.cwd(), capture);
    const persisted = JSON.parse(
      await readFile(path, "utf8"),
    ) as PersistedRestrictedExperimentCapture;
    assert.equal(persisted.experimentId, capture.experimentId);
    assert.equal(persisted.caseFingerprint, capture.caseFingerprint);
    assert.equal(persisted.requestHash, capture.requestHash);
    assert.equal(persisted.modelIdentifier, capture.modelIdentifier);
    assert.deepEqual(
      persisted.normalizedProviderResponse,
      JSON.parse(JSON.stringify(capture.normalizedProviderResponse)),
    );
    assert.deepEqual(
      persisted.providerMetrics,
      JSON.parse(JSON.stringify(capture.providerMetrics)),
    );
    assert.deepEqual(persisted.validationResult, JSON.parse(JSON.stringify(capture.result)));
    assert.doesNotMatch(JSON.stringify(persisted), /synthetic-test-key/);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal((await stat(captureDirectory)).mode & 0o777, 0o700);

    const labRecord = adaptRestrictedCaptureToRecordedEditorialResponse(
      persisted,
      "synthetic_test_fixture",
    );
    assert.equal(labRecord.provenance, "synthetic_test_fixture");
    assert.deepEqual(
      labRecord.response,
      JSON.parse(capture.normalizedProviderResponse!.output_text!),
    );
    assert.deepEqual(labRecord.metrics, {
      tokenUsage: { inputTokens: 10, outputTokens: 20, source: "provider_reported" },
      cost: null,
      latency: { milliseconds: 0, source: "client_measured" },
    });
    const report = await evaluateRecordedEditorialResponse(labRecord);
    assert.equal(report.automaticEvaluation.validationStatus, "passed");
    assert.equal(report.responseProvenance, "synthetic_test_fixture");

    await assert.rejects(
      persistRestrictedExperimentCapture(captureDirectory, process.cwd(), capture),
      /EEXIST/,
    );
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), persisted);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("offline capture adapter rejects incomplete output and never invents partial metrics", () => {
  const { snapshot } = createPmid42717033EvaluationCase();
  const base: PersistedRestrictedExperimentCapture = {
    experimentId: EDITORIAL_REAL_EXPERIMENT_ID,
    caseId: snapshot.caseId,
    caseFingerprint: snapshot.caseFingerprint,
    requestHash: `sha256:${"1".repeat(64)}`,
    confirmationId: "adapter-test",
    label: "sol",
    modelIdentifier: "sol-synthetic-test-model",
    startedAt: new Date(NOW).toISOString(),
    durationMs: 10,
    estimatedMaximumCostUsd: 0.1,
    providerReportedCostUsd: null,
    normalizedProviderResponse: {
      status: "completed",
      output_text: JSON.stringify(pmid42717033ExperimentalDraft),
    },
    providerMetrics: {
      usage: { inputTokens: 10, outputTokens: -1, totalTokens: 9 },
    },
    validationResult: null,
    outcome: "completed",
  };
  const adapted = adaptRestrictedCaptureToRecordedEditorialResponse(base, "synthetic_test_fixture");
  assert.equal(adapted.metrics?.tokenUsage, null);
  assert.equal(adapted.metrics?.cost, null);
  assert.throws(
    () =>
      adaptRestrictedCaptureToRecordedEditorialResponse(
        { ...base, outcome: "failed_or_incomplete" },
        "synthetic_test_fixture",
      ),
    /no complete normalized model response/,
  );
});

test("capture failure after transport keeps the durable attempt consumed", async () => {
  const root = await mkdtemp(join(tmpdir(), "dose-editorial-capture-failure-"));
  const ledger = new DurableRestrictedExperimentAttemptLedger(join(root, "ledger"));
  const captureDirectory = join(root, "captures");
  let calls = 0;
  try {
    await mkdir(captureDirectory);
    await assertPrivateCaptureDestination(captureDirectory, process.cwd());
    const current = new Pmid42717033RealExperimentSession(
      verifiedProtocol(),
      successfulCaptureTransport(() => calls++),
      "synthetic-test-key",
      ledger,
      () => NOW,
    );
    const capture = await confirmAndRunRestrictedExperimentCall(
      current,
      "luna",
      "operator:test",
      async () => EDITORIAL_OPERATOR_ATTESTATION,
      () => NOW,
      () => "failed-write-confirmation",
    );
    await rm(captureDirectory, { recursive: true });
    await assert.rejects(
      persistRestrictedExperimentCapture(captureDirectory, process.cwd(), capture),
      /ENOENT/,
    );
    const restarted = new Pmid42717033RealExperimentSession(
      verifiedProtocol(),
      successfulCaptureTransport(() => calls++),
      "synthetic-test-key",
      ledger,
      () => NOW,
    );
    await assert.rejects(
      confirmAndRunRestrictedExperimentCall(
        restarted,
        "luna",
        "operator:test",
        async () => EDITORIAL_OPERATOR_ATTESTATION,
        () => NOW,
        () => "retry-after-write-failure",
      ),
      /attempt limit is exhausted/,
    );
    assert.equal(calls, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("capture destination rejects repository paths and blocked CLI preflight exits nonzero", async () => {
  await assert.rejects(
    assertPrivateCaptureDestination(process.cwd(), process.cwd()),
    /outside the repository/,
  );
  const command = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/scientific-editorial-experiment.ts", "preflight"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(command.status, 2, command.stderr);
  assert.match(command.stdout, /Preflight: BLOCKED/);
  assert.match(command.stdout, /exact model identifier is unverified/);
  assert.match(command.stdout, /balance or spend capacity is unverified/);
});

function successfulCaptureTransport(
  onCall: () => void = () => undefined,
): OpenAIEditorialTransport {
  return {
    async create(request) {
      onCall();
      return {
        id: "response-private-capture",
        model: String(request.model),
        status: "completed",
        output_text: JSON.stringify(pmid42717033ExperimentalDraft),
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      };
    },
  };
}
