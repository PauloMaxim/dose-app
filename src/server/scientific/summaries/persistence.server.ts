import "../server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScientificSummary } from "./contract";
import type { SummaryRecord, SummaryRepository } from "./pipeline.server";

type SummaryRow = Record<string, any>;
const fromRow = (row: SummaryRow): SummaryRecord => ({
  identityKey: row.identity_key,
  articleId: row.article_id,
  inputHash: row.input_hash,
  status: row.status,
  provider: row.provider,
  model: row.model,
  promptVersion: row.prompt_version,
  schemaVersion: row.schema_version,
  summary: row.structured_summary as ScientificSummary | null,
  attempts: row.attempts,
  usage:
    row.total_tokens == null
      ? undefined
      : {
          inputTokens: row.input_tokens ?? 0,
          outputTokens: row.output_tokens ?? 0,
          totalTokens: row.total_tokens,
          cachedTokens: row.cached_tokens ?? undefined,
        },
  estimatedCostMicros:
    row.estimated_cost_micros == null ? undefined : Number(row.estimated_cost_micros),
  costConfigVersion: row.cost_config_version ?? undefined,
  error: row.sanitized_error ?? undefined,
  failureCode: row.failure_code ?? undefined,
  durationMs: row.duration_ms ?? undefined,
  providerMetadata: row.generation_metadata?.providerMetadata,
  createdAt: row.created_at,
  completedAt: row.completed_at ?? undefined,
  claimToken: row.claim_token ?? undefined,
});

/** Trusted service-role repository. The database RPC is the concurrency boundary. */
export class SupabaseSummaryRepository implements SummaryRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly leaseSeconds = 60,
    private readonly maxAttempts = 3,
  ) {}

  async get(key: string): Promise<SummaryRecord | null> {
    const { data, error } = await this.client
      .from("article_summaries")
      .select("*")
      .eq("identity_key", key)
      .maybeSingle();
    if (error) throw new Error("Summary persistence read failed");
    return data ? fromRow(data) : null;
  }

  async claim(record: SummaryRecord): Promise<{ claimed: boolean; record: SummaryRecord }> {
    const { data, error } = await this.client
      .rpc("claim_article_summary", {
        p_article_id: record.articleId,
        p_identity_key: record.identityKey,
        p_input_hash: record.inputHash,
        p_provider: record.provider,
        p_model: record.model,
        p_prompt_version: record.promptVersion,
        p_schema_version: record.schemaVersion,
        p_claim_token: record.claimToken,
        p_lease_seconds: this.leaseSeconds,
        p_max_attempts: this.maxAttempts,
      })
      .maybeSingle();
    if (error) throw new Error("Summary persistence claim failed");
    const current = data ? fromRow(data) : await this.get(record.identityKey);
    if (!current) throw new Error("Summary persistence claim returned no record");
    return { claimed: current.claimToken === record.claimToken, record: current };
  }

  async save(record: SummaryRecord): Promise<void> {
    if (!record.claimToken) throw new Error("Summary save requires a claim token");
    const usage = record.usage;
    const { data, error } = await this.client
      .from("article_summaries")
      .update({
        status: record.status,
        structured_summary: record.summary,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
        total_tokens: usage?.totalTokens ?? null,
        cached_tokens: usage?.cachedTokens ?? null,
        estimated_cost_micros: record.estimatedCostMicros ?? null,
        cost_config_version: record.costConfigVersion ?? null,
        generation_metadata: { providerMetadata: record.providerMetadata ?? null },
        sanitized_error: record.error ?? null,
        failure_code: record.failureCode ?? null,
        duration_ms: record.durationMs ?? null,
        completed_at: record.completedAt ?? null,
        lease_expires_at: null,
      })
      .eq("identity_key", record.identityKey)
      .eq("claim_token", record.claimToken)
      .select("id");
    if (error || !data?.length) throw new Error("Summary persistence save lost its claim");
  }
}
