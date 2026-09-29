import "../server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createScientificEditorialProviderRequest } from "./generator";
import {
  buildOpenAIEditorialRequest,
  OpenAIScientificEditorialProvider,
  type OpenAIEditorialTransport,
  type ScientificEditorialProviderMetrics,
} from "./openai.server";
import { createPmid42717033EvaluationCase } from "./evaluation-lab";
import { ValidatedScientificEditorialDraftGenerator } from "./generator";
import type { ScientificEditorialRuntimeConfig } from "./config.server";

export const EDITORIAL_REAL_EXPERIMENT_ID = "editorial-experiment:pmid:42717033:phase-1.9b:v1";
export const EDITORIAL_REAL_EXPERIMENT_BUDGET_USD = 1;
export const EDITORIAL_REAL_EXPERIMENT_MAX_OUTPUT_TOKENS = 8_000;
export const EDITORIAL_REAL_EXPERIMENT_TIMEOUT_MS = 90_000;
export const EDITORIAL_CONFIRMATION_TTL_MS = 5 * 60_000;

export type ExperimentModel = "sol" | "luna";

export interface VerifiedModelPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  /** Reasoning tokens are included in the Responses API output-token allowance and billed as output. */
  reasoningUsdPerMillionTokens: number;
  sourceUrl: string;
  checkedAt: string;
}

export interface ExperimentModelConfiguration {
  label: ExperimentModel;
  providerIdentifier: "openai";
  modelIdentifier: string | null;
  accountAvailabilityVerifiedAt: string | null;
  pricing: VerifiedModelPricing | null;
  reasoning: { mode: "standard"; effort: "medium" };
}

export interface EditorialExperimentProtocol {
  experimentId: typeof EDITORIAL_REAL_EXPERIMENT_ID;
  budgetUsd: typeof EDITORIAL_REAL_EXPERIMENT_BUDGET_USD;
  maxCallsTotal: 2;
  maxCallsPerModel: 1;
  retries: 0;
  timeoutMs: typeof EDITORIAL_REAL_EXPERIMENT_TIMEOUT_MS;
  maxOutputTokens: typeof EDITORIAL_REAL_EXPERIMENT_MAX_OUTPUT_TOKENS;
  models: readonly [ExperimentModelConfiguration, ExperimentModelConfiguration];
}

/**
 * Fail-closed checked-in run sheet. Exact public IDs/prices and availability for the operator's
 * account were not verifiable while preparing this change, so no paid call can be authorized.
 */
export const PMID_42717033_REAL_EXPERIMENT_PROTOCOL: EditorialExperimentProtocol = {
  experimentId: EDITORIAL_REAL_EXPERIMENT_ID,
  budgetUsd: EDITORIAL_REAL_EXPERIMENT_BUDGET_USD,
  maxCallsTotal: 2,
  maxCallsPerModel: 1,
  retries: 0,
  timeoutMs: EDITORIAL_REAL_EXPERIMENT_TIMEOUT_MS,
  maxOutputTokens: EDITORIAL_REAL_EXPERIMENT_MAX_OUTPUT_TOKENS,
  models: [
    {
      label: "sol",
      providerIdentifier: "openai",
      modelIdentifier: null,
      accountAvailabilityVerifiedAt: null,
      pricing: null,
      reasoning: { mode: "standard", effort: "medium" },
    },
    {
      label: "luna",
      providerIdentifier: "openai",
      modelIdentifier: null,
      accountAvailabilityVerifiedAt: null,
      pricing: null,
      reasoning: { mode: "standard", effort: "medium" },
    },
  ],
};

export interface ExperimentCallPreflight {
  label: ExperimentModel;
  providerIdentifier: "openai";
  modelIdentifier: string | null;
  accountAvailabilityVerifiedAt: string | null;
  pricing: VerifiedModelPricing | null;
  timeoutMs: number;
  maxInputTokensConservative: number;
  maxOutputTokens: number;
  maxReasoningTokens: number;
  estimatedMaximumCostUsd: number | null;
  request: Record<string, unknown> | null;
  blockers: string[];
}

export interface EditorialExperimentPreflight {
  ok: boolean;
  experimentId: string;
  caseId: string;
  caseFingerprint: string;
  promptVersion: string;
  budgetUsd: number;
  estimatedMaximumCostUsd: number | null;
  calls: readonly [ExperimentCallPreflight, ExperimentCallPreflight];
  blockers: string[];
}

const pricingSchema = z
  .object({
    inputUsdPerMillionTokens: z.number().finite().nonnegative(),
    outputUsdPerMillionTokens: z.number().finite().nonnegative(),
    reasoningUsdPerMillionTokens: z.number().finite().nonnegative(),
    sourceUrl: z.url().startsWith("https://"),
    checkedAt: z.iso.datetime(),
  })
  .strict();

function maximumCost(
  inputTokens: number,
  outputTokens: number,
  pricing: VerifiedModelPricing,
): number {
  // Charge every output token at the more expensive of visible-output and reasoning rates. This
  // avoids double-counting one shared allowance while remaining conservative for either mix.
  const outputRate = Math.max(
    pricing.outputUsdPerMillionTokens,
    pricing.reasoningUsdPerMillionTokens,
  );
  return (inputTokens * pricing.inputUsdPerMillionTokens + outputTokens * outputRate) / 1_000_000;
}

/** Offline only. It creates the exact request body but owns no transport and performs no I/O. */
export function preflightPmid42717033RealExperiment(
  protocol: EditorialExperimentProtocol = PMID_42717033_REAL_EXPERIMENT_PROTOCOL,
): EditorialExperimentPreflight {
  const { snapshot, input } = createPmid42717033EvaluationCase();
  const providerRequest = createScientificEditorialProviderRequest(input);
  const calls = protocol.models.map((model): ExperimentCallPreflight => {
    const blockers: string[] = [];
    if (!model.modelIdentifier)
      blockers.push(`${model.label}: exact model identifier is unverified`);
    if (!model.accountAvailabilityVerifiedAt)
      blockers.push(`${model.label}: account availability is unverified`);
    const parsedPricing = pricingSchema.safeParse(model.pricing);
    if (!parsedPricing.success)
      blockers.push(`${model.label}: official pricing is unknown or invalid`);
    const request = model.modelIdentifier
      ? buildOpenAIEditorialRequest(providerRequest, {
          model: model.modelIdentifier,
          maxOutputTokens: protocol.maxOutputTokens,
        })
      : null;
    const maxInputTokensConservative = request
      ? Buffer.byteLength(JSON.stringify(request), "utf8")
      : 0;
    const estimatedMaximumCostUsd = parsedPricing.success
      ? maximumCost(maxInputTokensConservative, protocol.maxOutputTokens, parsedPricing.data)
      : null;
    return {
      ...model,
      timeoutMs: protocol.timeoutMs,
      maxInputTokensConservative,
      maxOutputTokens: protocol.maxOutputTokens,
      maxReasoningTokens: protocol.maxOutputTokens,
      estimatedMaximumCostUsd,
      request,
      blockers,
    };
  }) as unknown as [ExperimentCallPreflight, ExperimentCallPreflight];
  const priced = calls.every((call) => call.estimatedMaximumCostUsd !== null);
  const estimatedMaximumCostUsd = priced
    ? calls.reduce((sum, call) => sum + (call.estimatedMaximumCostUsd ?? 0), 0)
    : null;
  const blockers = calls.flatMap((call) => call.blockers);
  if (
    protocol.maxCallsTotal !== 2 ||
    protocol.maxCallsPerModel !== 1 ||
    protocol.retries !== 0 ||
    protocol.maxOutputTokens <= 0 ||
    protocol.maxOutputTokens >= 25_000 ||
    protocol.timeoutMs <= 0 ||
    calls
      .map(({ label }) => label)
      .sort()
      .join(",") !== "luna,sol"
  )
    blockers.push("protocol call limits, timeout, output limit, or model slots are invalid");
  if (estimatedMaximumCostUsd !== null && estimatedMaximumCostUsd > protocol.budgetUsd)
    blockers.push(
      `combined conservative maximum ${estimatedMaximumCostUsd.toFixed(6)} USD exceeds ${protocol.budgetUsd.toFixed(2)} USD budget`,
    );
  return {
    ok: blockers.length === 0,
    experimentId: protocol.experimentId,
    caseId: snapshot.caseId,
    caseFingerprint: snapshot.caseFingerprint,
    promptVersion: snapshot.promptVersion,
    budgetUsd: protocol.budgetUsd,
    estimatedMaximumCostUsd,
    calls,
    blockers,
  };
}

export interface IndividualCallConfirmation {
  confirmationId: string;
  experimentId: string;
  label: ExperimentModel;
  modelIdentifier: string;
  caseId: string;
  caseFingerprint: string;
  confirmedAt: string;
}

type RawProviderResponse = Awaited<ReturnType<OpenAIEditorialTransport["create"]>>;

export interface RestrictedExperimentCapture {
  experimentId: string;
  caseId: string;
  caseFingerprint: string;
  confirmationId: string;
  label: ExperimentModel;
  modelIdentifier: string;
  startedAt: string;
  durationMs: number;
  rawProviderResponse: RawProviderResponse | null;
  providerMetrics: ScientificEditorialProviderMetrics | null;
  estimatedMaximumCostUsd: number;
  providerReportedCostUsd: null;
  result: Awaited<ReturnType<ValidatedScientificEditorialDraftGenerator["generate"]>> | null;
  error: unknown | null;
}

/** In-memory, single-use coordinator. It has no filesystem, database, feed, UI, or retry path. */
export class Pmid42717033RealExperimentSession {
  readonly preflight: EditorialExperimentPreflight;
  private readonly attempted = new Set<ExperimentModel>();
  private readonly confirmationIds = new Set<string>();

  constructor(
    private readonly protocol: EditorialExperimentProtocol,
    private readonly transport: OpenAIEditorialTransport,
    private readonly apiKey: string,
    private readonly now: () => number = Date.now,
  ) {
    this.preflight = preflightPmid42717033RealExperiment(protocol);
  }

  createConfirmation(label: ExperimentModel): IndividualCallConfirmation {
    const call = this.preflight.calls.find((candidate) => candidate.label === label);
    if (!call?.modelIdentifier) throw new Error("Cannot confirm a call that failed preflight");
    return {
      confirmationId: randomUUID(),
      experimentId: this.preflight.experimentId,
      label,
      modelIdentifier: call.modelIdentifier,
      caseId: this.preflight.caseId,
      caseFingerprint: this.preflight.caseFingerprint,
      confirmedAt: new Date(this.now()).toISOString(),
    };
  }

  async run(
    label: ExperimentModel,
    confirmation?: IndividualCallConfirmation,
  ): Promise<RestrictedExperimentCapture> {
    if (!this.preflight.ok)
      throw new Error(`Experiment preflight failed: ${this.preflight.blockers.join("; ")}`);
    const call = this.preflight.calls.find((candidate) => candidate.label === label);
    if (!call?.modelIdentifier || call.estimatedMaximumCostUsd === null)
      throw new Error("Model call is not fully configured");
    const now = this.now();
    if (
      !confirmation ||
      confirmation.experimentId !== this.preflight.experimentId ||
      confirmation.label !== label ||
      confirmation.modelIdentifier !== call.modelIdentifier ||
      confirmation.caseId !== this.preflight.caseId ||
      confirmation.caseFingerprint !== this.preflight.caseFingerprint ||
      !Number.isFinite(Date.parse(confirmation.confirmedAt)) ||
      now - Date.parse(confirmation.confirmedAt) < 0 ||
      now - Date.parse(confirmation.confirmedAt) > EDITORIAL_CONFIRMATION_TTL_MS
    )
      throw new Error(
        "Fresh individual human confirmation is required immediately before this call",
      );
    if (this.confirmationIds.has(confirmation.confirmationId))
      throw new Error("A confirmation cannot authorize more than one call");
    if (this.attempted.has(label))
      throw new Error("The one-call limit for this model is exhausted");
    if (this.attempted.size >= this.protocol.maxCallsTotal)
      throw new Error("The experiment call limit is exhausted");
    // Consume both allowances before transport invocation: timeouts/incomplete/failed responses count.
    this.confirmationIds.add(confirmation.confirmationId);
    this.attempted.add(label);
    const { input } = createPmid42717033EvaluationCase();
    const startedAt = new Date(now).toISOString();
    let rawProviderResponse: RawProviderResponse | null = null;
    let providerMetrics: ScientificEditorialProviderMetrics | null = null;
    const capturingTransport: OpenAIEditorialTransport = {
      create: async (request, options) => {
        rawProviderResponse = await this.transport.create(request, options);
        return rawProviderResponse;
      },
    };
    const runtimeConfig: ScientificEditorialRuntimeConfig = {
      apiKey: this.apiKey,
      model: call.modelIdentifier,
      timeoutMs: this.protocol.timeoutMs,
      maxInputCharacters: 250_000,
      maxOutputTokens: this.protocol.maxOutputTokens,
    };
    try {
      const result = await new ValidatedScientificEditorialDraftGenerator(
        new OpenAIScientificEditorialProvider(capturingTransport, runtimeConfig, (metrics) => {
          providerMetrics = metrics;
        }),
      ).generate(input);
      return {
        experimentId: this.preflight.experimentId,
        caseId: this.preflight.caseId,
        caseFingerprint: this.preflight.caseFingerprint,
        confirmationId: confirmation.confirmationId,
        label,
        modelIdentifier: call.modelIdentifier,
        startedAt,
        durationMs: Math.max(0, this.now() - now),
        rawProviderResponse,
        providerMetrics,
        estimatedMaximumCostUsd: call.estimatedMaximumCostUsd,
        providerReportedCostUsd: null,
        result,
        error: null,
      };
    } catch (error) {
      return {
        experimentId: this.preflight.experimentId,
        caseId: this.preflight.caseId,
        caseFingerprint: this.preflight.caseFingerprint,
        confirmationId: confirmation.confirmationId,
        label,
        modelIdentifier: call.modelIdentifier,
        startedAt,
        durationMs: Math.max(0, this.now() - now),
        rawProviderResponse,
        providerMetrics,
        estimatedMaximumCostUsd: call.estimatedMaximumCostUsd,
        providerReportedCostUsd: null,
        result: null,
        error,
      };
    }
  }
}
