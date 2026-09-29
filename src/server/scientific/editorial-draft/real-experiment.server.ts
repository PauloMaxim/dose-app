import "../server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  createScientificEditorialProviderRequest,
  ValidatedScientificEditorialDraftGenerator,
} from "./generator";
import {
  buildOpenAIEditorialRequest,
  OpenAIScientificEditorialProvider,
  type OpenAIEditorialTransport,
  type ScientificEditorialProviderMetrics,
} from "./openai.server";
import { createPmid42717033EvaluationCase } from "./evaluation-lab";
import type { ScientificEditorialRuntimeConfig } from "./config.server";

export const EDITORIAL_REAL_EXPERIMENT_ID = "editorial-experiment:pmid:42717033:phase-1.9b:v1";
export const EDITORIAL_REAL_EXPERIMENT_BUDGET_USD = 1;
export const EDITORIAL_REAL_EXPERIMENT_MAX_OUTPUT_TOKENS = 8_000;
export const EDITORIAL_REAL_EXPERIMENT_TIMEOUT_MS = 90_000;
export const EDITORIAL_CONFIRMATION_TTL_MS = 5 * 60_000;
export const EDITORIAL_OPERATOR_ATTESTATION = "I authorize exactly this paid call" as const;

export type ExperimentModel = "sol" | "luna";

export interface VerifiedModelPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  /** Reasoning tokens share the Responses output allowance and are billed at this verified rate. */
  reasoningUsdPerMillionTokens: number;
  sourceUrl: string;
  checkedAt: string;
}

export interface VerifiedModelCapabilities {
  strictJsonSchema: true;
  standardReasoningWithMediumEffort: true;
  sourceUrl: string;
  checkedAt: string;
}

export interface ExperimentModelConfiguration {
  label: ExperimentModel;
  providerIdentifier: "openai";
  modelIdentifier: string | null;
  accountAvailabilityVerifiedAt: string | null;
  capabilities: VerifiedModelCapabilities | null;
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

/** Exact IDs, prices, capabilities and account availability remain unverified: paid use is blocked. */
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
      capabilities: null,
      pricing: null,
      reasoning: { mode: "standard", effort: "medium" },
    },
    {
      label: "luna",
      providerIdentifier: "openai",
      modelIdentifier: null,
      accountAvailabilityVerifiedAt: null,
      capabilities: null,
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
  capabilities: VerifiedModelCapabilities | null;
  pricing: VerifiedModelPricing | null;
  timeoutMs: number;
  maxInputTokensConservative: number;
  maxOutputTokens: number;
  maxReasoningTokens: number;
  estimatedMaximumCostUsd: number | null;
  request: Readonly<Record<string, unknown>> | null;
  requestHash: string | null;
  blockers: readonly string[];
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
  blockers: readonly string[];
}

const verificationSchema = z
  .object({ sourceUrl: z.url().startsWith("https://"), checkedAt: z.iso.datetime() })
  .strict();
const pricingSchema = verificationSchema
  .extend({
    inputUsdPerMillionTokens: z.number().finite().nonnegative(),
    outputUsdPerMillionTokens: z.number().finite().nonnegative(),
    reasoningUsdPerMillionTokens: z.number().finite().nonnegative(),
  })
  .strict();
const capabilitiesSchema = verificationSchema
  .extend({
    strictJsonSchema: z.literal(true),
    standardReasoningWithMediumEffort: z.literal(true),
  })
  .strict();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Experiment request must be JSON-serializable");
  return serialized;
}

function hashRequest(request: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(request)).digest("hex")}`;
}

function immutableSnapshot<T>(value: T): T {
  const clone = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
    Object.freeze(item);
    for (const child of Object.values(item)) freeze(child);
  };
  freeze(clone);
  return clone;
}

function validPastOrPresentDate(value: string | null | undefined, now: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now;
}

function maximumCost(
  inputTokens: number,
  outputTokens: number,
  pricing: VerifiedModelPricing,
): number {
  const outputRate = Math.max(
    pricing.outputUsdPerMillionTokens,
    pricing.reasoningUsdPerMillionTokens,
  );
  return (inputTokens * pricing.inputUsdPerMillionTokens + outputTokens * outputRate) / 1_000_000;
}

/** Offline only: creates and freezes the complete request approved for each model. */
export function preflightPmid42717033RealExperiment(
  suppliedProtocol: EditorialExperimentProtocol = PMID_42717033_REAL_EXPERIMENT_PROTOCOL,
  now: number = Date.now(),
): EditorialExperimentPreflight {
  const protocol = immutableSnapshot(suppliedProtocol);
  const { snapshot, input } = createPmid42717033EvaluationCase();
  const providerRequest = createScientificEditorialProviderRequest(input);
  const calls = protocol.models.map((model): ExperimentCallPreflight => {
    const blockers: string[] = [];
    if (!model.modelIdentifier)
      blockers.push(`${model.label}: exact model identifier is unverified`);
    if (!validPastOrPresentDate(model.accountAvailabilityVerifiedAt, now))
      blockers.push(`${model.label}: account availability date is absent, invalid, or future`);
    const parsedPricing = pricingSchema.safeParse(model.pricing);
    if (
      !parsedPricing.success ||
      !validPastOrPresentDate(parsedPricing.success ? parsedPricing.data.checkedAt : null, now)
    )
      blockers.push(`${model.label}: official pricing is unknown, invalid, or future-dated`);
    const parsedCapabilities = capabilitiesSchema.safeParse(model.capabilities);
    if (
      !parsedCapabilities.success ||
      !validPastOrPresentDate(
        parsedCapabilities.success ? parsedCapabilities.data.checkedAt : null,
        now,
      )
    )
      blockers.push(
        `${model.label}: strict JSON Schema and reasoning compatibility is unverified, invalid, or future-dated`,
      );
    if (model.reasoning.mode !== "standard" || model.reasoning.effort !== "medium")
      blockers.push(`${model.label}: reasoning parameters do not match the approved request`);
    const request = model.modelIdentifier
      ? buildOpenAIEditorialRequest(providerRequest, {
          model: model.modelIdentifier,
          maxOutputTokens: protocol.maxOutputTokens,
        })
      : null;
    if (request && canonicalJson(request.reasoning) !== canonicalJson(model.reasoning))
      blockers.push(`${model.label}: configured reasoning differs from the materialized request`);
    const maxInputTokensConservative = request
      ? Buffer.byteLength(JSON.stringify(request), "utf8")
      : 0;
    const estimatedMaximumCostUsd = parsedPricing.success
      ? maximumCost(maxInputTokensConservative, protocol.maxOutputTokens, parsedPricing.data)
      : null;
    return immutableSnapshot({
      ...model,
      timeoutMs: protocol.timeoutMs,
      maxInputTokensConservative,
      maxOutputTokens: protocol.maxOutputTokens,
      maxReasoningTokens: protocol.maxOutputTokens,
      estimatedMaximumCostUsd,
      request,
      requestHash: request ? hashRequest(request) : null,
      blockers,
    });
  }) as unknown as readonly [ExperimentCallPreflight, ExperimentCallPreflight];
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
    protocol.budgetUsd !== EDITORIAL_REAL_EXPERIMENT_BUDGET_USD ||
    calls
      .map(({ label }) => label)
      .sort()
      .join(",") !== "luna,sol"
  )
    blockers.push(
      "protocol budget, call limits, timeout, output limit, or model slots are invalid",
    );
  const identifiers = calls.map(({ modelIdentifier }) => modelIdentifier).filter(Boolean);
  if (identifiers.length === 2 && new Set(identifiers).size !== 2)
    blockers.push("Sol and Luna must use distinct exact model identifiers");
  if (estimatedMaximumCostUsd !== null && estimatedMaximumCostUsd > protocol.budgetUsd)
    blockers.push(
      `combined conservative maximum ${estimatedMaximumCostUsd.toFixed(6)} USD exceeds ${protocol.budgetUsd.toFixed(2)} USD budget`,
    );
  return immutableSnapshot({
    ok: blockers.length === 0,
    experimentId: protocol.experimentId,
    caseId: snapshot.caseId,
    caseFingerprint: snapshot.caseFingerprint,
    promptVersion: snapshot.promptVersion,
    budgetUsd: protocol.budgetUsd,
    estimatedMaximumCostUsd,
    calls,
    blockers,
  });
}

/** Must be supplied by an operator-controlled surface; the execution session cannot mint it. */
export interface IndividualCallConfirmation {
  confirmationId: string;
  operatorId: string;
  operatorAttestation: typeof EDITORIAL_OPERATOR_ATTESTATION;
  experimentId: string;
  label: ExperimentModel;
  modelIdentifier: string;
  caseId: string;
  caseFingerprint: string;
  requestHash: string;
  estimatedMaximumCostUsd: number;
  confirmedAt: string;
}

export interface ExperimentAttemptClaim {
  experimentId: string;
  caseFingerprint: string;
  label: ExperimentModel;
  modelIdentifier: string;
  requestHash: string;
  confirmationId: string;
  attemptedAt: string;
}

export interface ExperimentAttemptCompletion {
  confirmationId: string;
  outcome: "completed" | "failed_or_incomplete";
  completedAt: string;
}

/** Must be shared by all sessions for this experiment and implement an atomic unique claim. */
export interface RestrictedExperimentAttemptLedger {
  claim(attempt: ExperimentAttemptClaim): Promise<boolean>;
  complete(completion: ExperimentAttemptCompletion): Promise<void>;
}

type NormalizedProviderResponse = Awaited<ReturnType<OpenAIEditorialTransport["create"]>>;

export interface RestrictedExperimentCapture {
  experimentId: string;
  caseId: string;
  caseFingerprint: string;
  requestHash: string;
  confirmationId: string;
  label: ExperimentModel;
  modelIdentifier: string;
  startedAt: string;
  durationMs: number;
  normalizedProviderResponse: NormalizedProviderResponse | null;
  providerMetrics: ScientificEditorialProviderMetrics | null;
  estimatedMaximumCostUsd: number;
  providerReportedCostUsd: null;
  result: Awaited<ReturnType<ValidatedScientificEditorialDraftGenerator["generate"]>> | null;
  error: unknown | null;
}

/** In-memory coordinator; cross-session limits depend on the required shared restricted ledger. */
export class Pmid42717033RealExperimentSession {
  readonly preflight: EditorialExperimentPreflight;
  private readonly protocol: EditorialExperimentProtocol;
  private readonly usedConfirmationIds = new Set<string>();

  constructor(
    protocol: EditorialExperimentProtocol,
    private readonly transport: OpenAIEditorialTransport,
    private readonly apiKey: string,
    private readonly ledger: RestrictedExperimentAttemptLedger,
    private readonly now: () => number = Date.now,
  ) {
    this.protocol = immutableSnapshot(protocol);
    this.preflight = preflightPmid42717033RealExperiment(this.protocol, this.now());
  }

  async run(
    label: ExperimentModel,
    confirmation?: IndividualCallConfirmation,
  ): Promise<RestrictedExperimentCapture> {
    if (!this.preflight.ok)
      throw new Error(`Experiment preflight failed: ${this.preflight.blockers.join("; ")}`);
    const call = this.preflight.calls.find((candidate) => candidate.label === label);
    if (
      !call?.modelIdentifier ||
      !call.request ||
      !call.requestHash ||
      call.estimatedMaximumCostUsd === null
    )
      throw new Error("Model call is not fully configured");
    const now = this.now();
    if (
      !confirmation ||
      confirmation.operatorAttestation !== EDITORIAL_OPERATOR_ATTESTATION ||
      !confirmation.confirmationId.trim() ||
      !confirmation.operatorId.trim() ||
      confirmation.experimentId !== this.preflight.experimentId ||
      confirmation.label !== label ||
      confirmation.modelIdentifier !== call.modelIdentifier ||
      confirmation.caseId !== this.preflight.caseId ||
      confirmation.caseFingerprint !== this.preflight.caseFingerprint ||
      confirmation.requestHash !== call.requestHash ||
      confirmation.estimatedMaximumCostUsd !== call.estimatedMaximumCostUsd ||
      !Number.isFinite(Date.parse(confirmation.confirmedAt)) ||
      now - Date.parse(confirmation.confirmedAt) < 0 ||
      now - Date.parse(confirmation.confirmedAt) > EDITORIAL_CONFIRMATION_TTL_MS
    )
      throw new Error("Fresh explicit human authorization for this exact call is required");
    if (this.usedConfirmationIds.has(confirmation.confirmationId))
      throw new Error("A confirmation cannot authorize more than one call");

    const claim: ExperimentAttemptClaim = {
      experimentId: this.preflight.experimentId,
      caseFingerprint: this.preflight.caseFingerprint,
      label,
      modelIdentifier: call.modelIdentifier,
      requestHash: call.requestHash,
      confirmationId: confirmation.confirmationId,
      attemptedAt: new Date(now).toISOString(),
    };
    // The ledger claim must be atomic and shared across sessions. Claim before transport because
    // timeout, incomplete output and provider failure may all be billable attempts.
    if (!(await this.ledger.claim(claim)))
      throw new Error("The shared experiment attempt limit is exhausted");
    this.usedConfirmationIds.add(confirmation.confirmationId);

    const { input } = createPmid42717033EvaluationCase();
    const approvedRequest = immutableSnapshot(call.request);
    const startedAt = new Date(now).toISOString();
    let normalizedProviderResponse: NormalizedProviderResponse | null = null;
    let providerMetrics: ScientificEditorialProviderMetrics | null = null;
    const capturingTransport: OpenAIEditorialTransport = {
      create: async (generatedRequest, options) => {
        if (
          hashRequest(generatedRequest) !== call.requestHash ||
          canonicalJson(generatedRequest) !== canonicalJson(approvedRequest)
        )
          throw new Error("Generated provider request diverged from approved preflight request");
        normalizedProviderResponse = await this.transport.create(
          structuredClone(approvedRequest),
          options,
        );
        return normalizedProviderResponse;
      },
    };
    const runtimeConfig: ScientificEditorialRuntimeConfig = {
      apiKey: this.apiKey,
      model: call.modelIdentifier,
      timeoutMs: this.protocol.timeoutMs,
      maxInputCharacters: 250_000,
      maxOutputTokens: this.protocol.maxOutputTokens,
    };
    let outcome: ExperimentAttemptCompletion["outcome"] = "failed_or_incomplete";
    try {
      const result = await new ValidatedScientificEditorialDraftGenerator(
        new OpenAIScientificEditorialProvider(capturingTransport, runtimeConfig, (metrics) => {
          providerMetrics = metrics;
        }),
      ).generate(input);
      outcome = "completed";
      return {
        experimentId: this.preflight.experimentId,
        caseId: this.preflight.caseId,
        caseFingerprint: this.preflight.caseFingerprint,
        requestHash: call.requestHash,
        confirmationId: confirmation.confirmationId,
        label,
        modelIdentifier: call.modelIdentifier,
        startedAt,
        durationMs: Math.max(0, this.now() - now),
        normalizedProviderResponse,
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
        requestHash: call.requestHash,
        confirmationId: confirmation.confirmationId,
        label,
        modelIdentifier: call.modelIdentifier,
        startedAt,
        durationMs: Math.max(0, this.now() - now),
        normalizedProviderResponse,
        providerMetrics,
        estimatedMaximumCostUsd: call.estimatedMaximumCostUsd,
        providerReportedCostUsd: null,
        result: null,
        error,
      };
    } finally {
      await this.ledger.complete({
        confirmationId: confirmation.confirmationId,
        outcome,
        completedAt: new Date(this.now()).toISOString(),
      });
    }
  }
}
