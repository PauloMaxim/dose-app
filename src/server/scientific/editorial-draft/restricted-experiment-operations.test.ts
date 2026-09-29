import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
