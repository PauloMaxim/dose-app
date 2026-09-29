import assert from "node:assert/strict";
import test from "node:test";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";
import {
  EDITORIAL_REAL_EXPERIMENT_ID,
  Pmid42717033RealExperimentSession,
  preflightPmid42717033RealExperiment,
  type EditorialExperimentProtocol,
} from "./real-experiment.server";
import type { OpenAIEditorialTransport } from "./openai.server";

function protocol(
  overrides: Partial<EditorialExperimentProtocol> = {},
): EditorialExperimentProtocol {
  const pricing = {
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 2,
    reasoningUsdPerMillionTokens: 2,
    sourceUrl: "https://openai.com/api/pricing/",
    checkedAt: "2026-09-29T00:00:00.000Z",
  };
  return {
    experimentId: EDITORIAL_REAL_EXPERIMENT_ID,
    budgetUsd: 1,
    maxCallsTotal: 2,
    maxCallsPerModel: 1,
    retries: 0,
    timeoutMs: 90_000,
    maxOutputTokens: 8_000,
    models: [
      {
        label: "sol",
        providerIdentifier: "openai",
        modelIdentifier: "sol-test-model",
        accountAvailabilityVerifiedAt: "2026-09-29T00:00:00.000Z",
        pricing,
        reasoning: { mode: "standard", effort: "medium" },
      },
      {
        label: "luna",
        providerIdentifier: "openai",
        modelIdentifier: "luna-test-model",
        accountAvailabilityVerifiedAt: "2026-09-29T00:00:00.000Z",
        pricing,
        reasoning: { mode: "standard", effort: "medium" },
      },
    ],
    ...overrides,
  };
}

function successfulTransport(counter: { calls: number }): OpenAIEditorialTransport {
  return {
    async create(request) {
      counter.calls += 1;
      return {
        id: `response-${counter.calls}`,
        model: String(request.model),
        status: "completed",
        output_text: JSON.stringify(pmid42717033ExperimentalDraft),
        usage: {
          input_tokens: 1_000,
          output_tokens: 2_000,
          output_tokens_details: { reasoning_tokens: 500 },
          total_tokens: 3_000,
        },
      };
    },
  };
}

test("preflight fails closed for unknown exact identifiers, prices, and account availability", () => {
  const result = preflightPmid42717033RealExperiment();
  assert.equal(result.ok, false);
  assert.equal(result.estimatedMaximumCostUsd, null);
  assert.match(result.blockers.join(" "), /identifier is unverified/);
  assert.match(result.blockers.join(" "), /pricing is unknown/);
  assert.match(result.blockers.join(" "), /account availability is unverified/);
});

test("preflight exposes exact requests and rejects combined budget excess", () => {
  const expensive = protocol();
  for (const model of expensive.models)
    model.pricing = {
      ...model.pricing!,
      outputUsdPerMillionTokens: 100,
      reasoningUsdPerMillionTokens: 100,
    };
  const result = preflightPmid42717033RealExperiment(expensive);
  assert.equal(result.ok, false);
  assert.ok((result.estimatedMaximumCostUsd ?? 0) > 1);
  assert.match(result.blockers.at(-1)!, /exceeds/);
  assert.equal(result.calls[0].request?.store, false);
  assert.equal(result.calls[0].request?.max_output_tokens, 8_000);
});

test("preflight rejects invalid experiment configuration", () => {
  const result = preflightPmid42717033RealExperiment(
    protocol({ retries: 1 as 0, maxOutputTokens: 25_000 as 8_000 }),
  );
  assert.equal(result.ok, false);
  assert.match(result.blockers.join(" "), /protocol call limits/);
});

test("session requires a fresh per-model confirmation tied to the frozen case", async () => {
  const counter = { calls: 0 };
  const session = new Pmid42717033RealExperimentSession(
    protocol(),
    successfulTransport(counter),
    "mock-key-not-real",
    () => Date.parse("2026-09-29T00:01:00.000Z"),
  );
  await assert.rejects(session.run("sol"), /confirmation/);
  const divergent = session.createConfirmation("sol");
  divergent.caseFingerprint = `sha256:${"0".repeat(64)}`;
  await assert.rejects(session.run("sol", divergent), /confirmation/);
  assert.equal(counter.calls, 0);
});

test("one confirmation cannot authorize Luna and each model has at most one attempt", async () => {
  const counter = { calls: 0 };
  const now = Date.parse("2026-09-29T00:01:00.000Z");
  const session = new Pmid42717033RealExperimentSession(
    protocol(),
    successfulTransport(counter),
    "mock-key-not-real",
    () => now,
  );
  const solConfirmation = session.createConfirmation("sol");
  const sol = await session.run("sol", solConfirmation);
  assert.equal(sol.error, null);
  assert.equal(sol.rawProviderResponse?.id, "response-1");
  assert.equal(sol.providerMetrics?.usage?.reasoningTokens, 500);
  assert.equal(sol.providerReportedCostUsd, null);
  await assert.rejects(session.run("luna", solConfirmation), /confirmation/);
  await assert.rejects(session.run("sol", session.createConfirmation("sol")), /one-call limit/);
  assert.equal(counter.calls, 1);
});

test("a failed transport is charged as the only attempt and is never retried", async () => {
  let calls = 0;
  const transport: OpenAIEditorialTransport = {
    async create() {
      calls += 1;
      throw new Error("simulated timeout after provider acceptance");
    },
  };
  const session = new Pmid42717033RealExperimentSession(
    protocol(),
    transport,
    "mock-key-not-real",
    () => Date.parse("2026-09-29T00:01:00.000Z"),
  );
  const capture = await session.run("luna", session.createConfirmation("luna"));
  assert.notEqual(capture.error, null);
  assert.equal(calls, 1);
  await assert.rejects(session.run("luna", session.createConfirmation("luna")), /one-call limit/);
  assert.equal(calls, 1);
});
