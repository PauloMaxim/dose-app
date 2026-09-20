import "../server-only";
import { randomUUID } from "node:crypto";
import type { ScientificSummary } from "./contract";
import { SUMMARY_SCHEMA_VERSION } from "./contract";
import { buildSummaryInput, summaryIdentity, type SummaryArticle } from "./domain";
import { SUMMARY_PROMPT_VERSION } from "./prompt";
import {
  SummaryProviderError,
  type ScientificSummaryProvider,
  type TokenUsage,
} from "./provider.server";
import { sanitizeError, validateSummary } from "./validation";
import type { SummaryRuntimeConfig } from "./config.server";

export type SummaryStatus = "processing" | "completed" | "failed_retryable" | "failed_permanent";
export interface SummaryRecord {
  identityKey: string;
  articleId: string;
  inputHash: string;
  status: SummaryStatus;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  summary: ScientificSummary | null;
  attempts: number;
  usage?: TokenUsage;
  estimatedCostMicros?: number;
  costConfigVersion?: string;
  error?: string;
  failureCode?: string;
  durationMs?: number;
  providerMetadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  completedAt?: string;
  claimToken?: string;
}
export interface SummaryRepository {
  get(key: string): Promise<SummaryRecord | null>;
  claim(record: SummaryRecord): Promise<{ claimed: boolean; record: SummaryRecord }>;
  save(record: SummaryRecord): Promise<void>;
}
export type CostEstimator = (
  usage: TokenUsage,
  context: { provider: string; model: string },
) => number | { micros: number; configVersion: string } | undefined;

export class InMemorySummaryRepository implements SummaryRepository {
  private records = new Map<string, SummaryRecord>();
  async get(key: string) {
    return this.records.get(key) ?? null;
  }
  async claim(record: SummaryRecord) {
    const existing = this.records.get(record.identityKey);
    if (existing && existing.status !== "failed_retryable")
      return { claimed: false, record: existing };
    this.records.set(record.identityKey, record);
    return { claimed: true, record };
  }
  async save(record: SummaryRecord) {
    this.records.set(record.identityKey, record);
  }
}

export class ScientificSummaryPipeline {
  constructor(
    private readonly repository: SummaryRepository,
    private readonly provider: ScientificSummaryProvider,
    private readonly config: SummaryRuntimeConfig,
    private readonly estimateCost?: CostEstimator,
    private readonly versions = { prompt: SUMMARY_PROMPT_VERSION, schema: SUMMARY_SCHEMA_VERSION },
  ) {}
  async generate(
    article: SummaryArticle,
  ): Promise<SummaryRecord | { status: "disabled" | "ineligible" }> {
    if (!this.config.enabled) return { status: "disabled" };
    if (this.config.provider !== this.provider.id) return { status: "disabled" };
    const input = buildSummaryInput(article, this.config.maxInputCharacters);
    if (!input) return { status: "ineligible" };
    const identity = summaryIdentity(
      article.id,
      input,
      this.versions.prompt,
      this.versions.schema,
      this.provider.id,
      this.config.model,
    );
    const existing = await this.repository.get(identity.identityKey);
    if (existing) {
      if (
        existing.status === "completed" ||
        existing.status === "processing" ||
        existing.status === "failed_permanent" ||
        existing.attempts >= this.config.maxAttempts
      )
        return existing;
    }
    const processing: SummaryRecord = {
      identityKey: identity.identityKey,
      articleId: article.id,
      inputHash: identity.inputHash,
      status: "processing",
      provider: this.provider.id,
      model: this.config.model,
      promptVersion: this.versions.prompt,
      schemaVersion: this.versions.schema,
      summary: null,
      attempts: (existing?.attempts ?? 0) + 1,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      claimToken: randomUUID(),
    };
    const claim = await this.repository.claim(processing);
    if (!claim.claimed) return claim.record;
    const startedAt = Date.now();
    try {
      const result = await this.provider.generateScientificSummary(input, {
        model: this.config.model,
        maxOutputTokens: this.config.maxOutputTokens,
        promptVersion: this.versions.prompt,
        schemaVersion: this.versions.schema,
        timeoutMs: this.config.timeoutMs,
      });
      processing.summary = validateSummary(result.summary, input);
      processing.status = "completed";
      processing.usage = result.usage;
      const cost = result.usage
        ? this.estimateCost?.(result.usage, {
            provider: this.provider.id,
            model: this.config.model,
          })
        : undefined;
      processing.estimatedCostMicros = typeof cost === "number" ? cost : cost?.micros;
      processing.costConfigVersion = typeof cost === "object" ? cost.configVersion : undefined;
      processing.completedAt = new Date().toISOString();
      processing.providerMetadata = result.metadata;
    } catch (error) {
      const typed =
        error instanceof SummaryProviderError
          ? error
          : new SummaryProviderError("transient", "Summary provider failed", true);
      processing.status =
        typed.retryable && processing.attempts < this.config.maxAttempts
          ? "failed_retryable"
          : "failed_permanent";
      processing.error = sanitizeError(error);
      processing.failureCode = typed.code;
      processing.summary = null;
    }
    processing.durationMs = Math.max(0, Date.now() - startedAt);
    await this.repository.save(processing);
    return processing;
  }
}
