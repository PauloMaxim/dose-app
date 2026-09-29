import assert from "node:assert/strict";
import test from "node:test";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";
import {
  EDITORIAL_OPERATOR_ATTESTATION,
  EDITORIAL_REAL_EXPERIMENT_ID,
  Pmid42717033RealExperimentSession,
  preflightPmid42717033RealExperiment,
  type EditorialExperimentProtocol,
  type ExperimentAttemptClaim,
  type ExperimentAttemptCompletion,
  type ExperimentModel,
  type IndividualCallConfirmation,
  type RestrictedExperimentAttemptLedger,
} from "./real-experiment.server";
import type { OpenAIEditorialTransport } from "./openai.server";

const NOW = Date.parse("2026-09-29T00:01:00.000Z");

function protocol(
  overrides: Partial<EditorialExperimentProtocol> = {},
): EditorialExperimentProtocol {
  const verification = {
    sourceUrl: "https://openai.com/api/pricing/",
    checkedAt: "2026-09-29T00:00:00.000Z",
  };
  const pricing = {
    inputUsdPerMillionTokens: 1,
    outputUsdPerMillionTokens: 2,
    reasoningUsdPerMillionTokens: 2,
    ...verification,
  };
  const capabilities = {
    strictJsonSchema: true as const,
    standardReasoningWithMediumEffort: true as const,
    ...verification,
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
        accountAvailabilityVerifiedAt: verification.checkedAt,
        capabilities,
        pricing,
        reasoning: { mode: "standard", effort: "medium" },
      },
      {
        label: "luna",
        providerIdentifier: "openai",
        modelIdentifier: "luna-test-model",
        accountAvailabilityVerifiedAt: verification.checkedAt,
        capabilities,
        pricing,
        reasoning: { mode: "standard", effort: "medium" },
      },
    ],
    ...overrides,
  };
}

class SharedTestLedger implements RestrictedExperimentAttemptLedger {
  readonly claims: ExperimentAttemptClaim[] = [];
  readonly completions: ExperimentAttemptCompletion[] = [];

  async claim(attempt: ExperimentAttemptClaim): Promise<boolean> {
    if (this.claims.some((item) => item.confirmationId === attempt.confirmationId)) return false;
    if (this.claims.some((item) => item.label === attempt.label)) return false;
    if (this.claims.length >= 2) return false;
    this.claims.push(structuredClone(attempt));
    return true;
  }

  async complete(completion: ExperimentAttemptCompletion): Promise<void> {
    this.completions.push(structuredClone(completion));
  }
}

function confirmation(
  session: Pmid42717033RealExperimentSession,
  label: ExperimentModel,
  overrides: Partial<IndividualCallConfirmation> = {},
): IndividualCallConfirmation {
  const call = session.preflight.calls.find((candidate) => candidate.label === label)!;
  return {
    confirmationId: `human-confirmation-${label}-${Math.random()}`,
    operatorId: "operator:test-human",
    operatorAttestation: EDITORIAL_OPERATOR_ATTESTATION,
    experimentId: session.preflight.experimentId,
    label,
    modelIdentifier: call.modelIdentifier!,
    caseId: session.preflight.caseId,
    caseFingerprint: session.preflight.caseFingerprint,
    requestHash: call.requestHash!,
    estimatedMaximumCostUsd: call.estimatedMaximumCostUsd!,
    confirmedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

function successfulTransport(counter: {
  calls: number;
  requests?: unknown[];
}): OpenAIEditorialTransport {
  return {
    async create(request) {
      counter.calls += 1;
      counter.requests?.push(structuredClone(request));
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

function session(
  suppliedProtocol = protocol(),
  transport = successfulTransport({ calls: 0 }),
  ledger = new SharedTestLedger(),
): Pmid42717033RealExperimentSession {
  return new Pmid42717033RealExperimentSession(
    suppliedProtocol,
    transport,
    "mock-key-not-real",
    ledger,
    () => NOW,
  );
}

test("preflight fails closed for unknown identifiers, prices, capabilities, and availability", () => {
  const result = preflightPmid42717033RealExperiment(undefined, NOW);
  assert.equal(result.ok, false);
  assert.equal(result.estimatedMaximumCostUsd, null);
  assert.match(result.blockers.join(" "), /identifier is unverified/);
  assert.match(result.blockers.join(" "), /pricing is unknown/);
  assert.match(result.blockers.join(" "), /availability date/);
  assert.match(result.blockers.join(" "), /compatibility is unverified/);
});

test("preflight exposes immutable exact requests and rejects combined budget excess", () => {
  const expensive = protocol();
  for (const model of expensive.models)
    model.pricing = {
      ...model.pricing!,
      outputUsdPerMillionTokens: 100,
      reasoningUsdPerMillionTokens: 100,
    };
  const result = preflightPmid42717033RealExperiment(expensive, NOW);
  assert.equal(result.ok, false);
  assert.ok((result.estimatedMaximumCostUsd ?? 0) > 1);
  assert.match(result.blockers.at(-1)!, /exceeds/);
  assert.equal(result.calls[0].request?.store, false);
  assert.equal(result.calls[0].request?.max_output_tokens, 8_000);
  assert.match(result.calls[0].requestHash!, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(result.calls[0].request), true);
  assert.throws(() => Object.assign(result.calls[0].request!, { model: "changed" }), TypeError);
});

test("preflight rejects equal model IDs, invalid/future dates, and incompatible parameters", () => {
  const invalid = protocol();
  invalid.models[1].modelIdentifier = invalid.models[0].modelIdentifier;
  invalid.models[0].accountAvailabilityVerifiedAt = "not-a-date";
  invalid.models[0].pricing = {
    ...invalid.models[0].pricing!,
    checkedAt: "2099-01-01T00:00:00.000Z",
  };
  invalid.models[1].capabilities = null;
  invalid.models[1].reasoning = { mode: "standard", effort: "high" as "medium" };
  const result = preflightPmid42717033RealExperiment(invalid, NOW);
  assert.equal(result.ok, false);
  assert.match(result.blockers.join(" "), /distinct exact model identifiers/);
  assert.match(result.blockers.join(" "), /invalid, or future/);
  assert.match(result.blockers.join(" "), /reasoning parameters/);
  assert.match(result.blockers.join(" "), /compatibility is unverified/);
});

test("protocol mutation after preflight cannot change the approved request", async () => {
  const mutable = protocol();
  const counter = { calls: 0, requests: [] as unknown[] };
  const current = session(mutable, successfulTransport(counter));
  const approved = structuredClone(current.preflight.calls[0].request);
  mutable.models[0].modelIdentifier = "mutated-after-preflight";
  mutable.models[0].reasoning.effort = "high" as "medium";
  const capture = await current.run("sol", confirmation(current, "sol"));
  assert.equal(capture.error, null);
  assert.deepEqual(counter.requests[0], approved);
});

test("session cannot mint authorization and rejects absent or altered confirmations", async () => {
  const counter = { calls: 0 };
  const current = session(protocol(), successfulTransport(counter));
  assert.equal("createConfirmation" in current, false);
  await assert.rejects(current.run("sol"), /explicit human authorization/);
  await assert.rejects(
    current.run("sol", confirmation(current, "sol", { operatorAttestation: "automatic" as never })),
    /explicit human authorization/,
  );
  await assert.rejects(
    current.run("sol", confirmation(current, "sol", { requestHash: `sha256:${"0".repeat(64)}` })),
    /explicit human authorization/,
  );
  await assert.rejects(
    current.run("sol", confirmation(current, "sol", { estimatedMaximumCostUsd: 0 })),
    /explicit human authorization/,
  );
  await assert.rejects(
    current.run(
      "sol",
      confirmation(current, "sol", { caseFingerprint: `sha256:${"0".repeat(64)}` }),
    ),
    /explicit human authorization/,
  );
  assert.equal(counter.calls, 0);
});

test("generated request divergence is blocked before the underlying transport", async () => {
  const counter = { calls: 0 };
  const current = session(protocol(), successfulTransport(counter));
  const altered = structuredClone(current.preflight);
  const call = altered.calls[0] as { request: Record<string, unknown> };
  call.request.instructions = "changed after approval";
  Object.defineProperty(current, "preflight", { value: altered });
  const capture = await current.run("sol", confirmation(current, "sol"));
  assert.notEqual(capture.error, null);
  assert.equal(counter.calls, 0);
});

test("shared ledger preserves one-call limits across new sessions, including failures", async () => {
  const ledger = new SharedTestLedger();
  let calls = 0;
  const failingTransport: OpenAIEditorialTransport = {
    async create() {
      calls += 1;
      throw new Error("simulated timeout after provider acceptance");
    },
  };
  const first = session(protocol(), failingTransport, ledger);
  const failed = await first.run("luna", confirmation(first, "luna"));
  assert.notEqual(failed.error, null);
  assert.equal(failed.normalizedProviderResponse, null);
  assert.equal(ledger.completions[0].outcome, "failed_or_incomplete");

  const restarted = session(protocol(), successfulTransport({ calls: 0 }), ledger);
  await assert.rejects(
    restarted.run("luna", confirmation(restarted, "luna")),
    /shared experiment attempt limit/,
  );
  assert.equal(calls, 1);
});

test("sent request equals its approved request and normalized metrics remain separate", async () => {
  const counter = { calls: 0, requests: [] as unknown[] };
  const current = session(protocol(), successfulTransport(counter));
  const capture = await current.run("sol", confirmation(current, "sol"));
  assert.equal(capture.error, null);
  assert.deepEqual(counter.requests[0], current.preflight.calls[0].request);
  assert.equal(capture.normalizedProviderResponse?.id, "response-1");
  assert.equal(capture.providerMetrics?.usage?.reasoningTokens, 500);
  assert.equal(capture.providerReportedCostUsd, null);
  assert.equal(capture.estimatedMaximumCostUsd, current.preflight.calls[0].estimatedMaximumCostUsd);
});
