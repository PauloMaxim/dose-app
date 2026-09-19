import "./server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PubMedAdapter } from "./adapters/pubmed.server";
import { ScientificHttpError } from "./http";
import { deduplicateArticles } from "./merge";
import { ingestScientificBatch } from "./service.server";
import type { ScientificArticle } from "./types";

export const SCIENTIFIC_PILOT_DEFAULT_LIMIT = 10;
export const SCIENTIFIC_PILOT_MAX_LIMIT = 20;

const payloadSchema = z
  .object({
    operationKey: z.string().regex(/^[A-Za-z0-9_-]{16,80}$/),
    limit: z.number().int().min(1).max(SCIENTIFIC_PILOT_MAX_LIMIT).default(SCIENTIFIC_PILOT_DEFAULT_LIMIT),
    dateFrom: z.string().date(),
    dateTo: z.string().date(),
  })
  .strict()
  .refine((value) => value.dateFrom <= value.dateTo, { message: "invalid date range" })
  .refine(
    (value) =>
      Date.parse(`${value.dateTo}T00:00:00Z`) - Date.parse(`${value.dateFrom}T00:00:00Z`) <=
      366 * 24 * 60 * 60 * 1000,
    { message: "date range exceeds pilot limit" },
  );

export interface PilotReport {
  operationKey: string;
  providers: ["pubmed"];
  discovered: number;
  normalized: number;
  deduplicated: number;
  inserted: number;
  mergedOrUpdated: number;
  skipped: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

interface OperationRecord {
  requestHash: string;
  status: "running" | "completed" | "failed";
  report: PilotReport | null;
}

export interface PilotOperationStore {
  claim(operationKey: string, requestHash: string): Promise<{ claimed: boolean; existing?: OperationRecord }>;
  finish(operationKey: string, status: "completed" | "failed", report: PilotReport): Promise<void>;
}

export interface PilotDependencies {
  expectedToken: string;
  query: string;
  operations: PilotOperationStore;
  discover(options: { query: string; limit: number; dateFrom: string; dateTo: string }): Promise<ScientificArticle[]>;
  persist(articles: ScientificArticle[]): Promise<{
    found: number;
    new: number;
    updated: number;
    reconciled: number;
    failed: number;
    errors: string[];
  }>;
  now?: () => number;
}

export interface PilotRequest {
  method: string;
  authorization?: string | null;
  body: unknown;
}

export interface PilotResponse {
  status: number;
  body: { ok: boolean; report?: PilotReport; error?: string; replayed?: boolean };
}

export const isScientificPilotAuthorized = (
  header: string | null | undefined,
  expected: string,
) => {
  const prefix = "Bearer ";
  if (!header?.startsWith(prefix) || expected.length < 32) return false;
  const received = createHash("sha256").update(header.slice(prefix.length)).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return timingSafeEqual(received, wanted);
};

const requestHash = (query: string, payload: z.infer<typeof payloadSchema>) =>
  createHash("sha256").update(JSON.stringify({ query, ...payload })).digest("hex");

const safeErrors = (errors: readonly unknown[]) =>
  errors.slice(0, 20).map((error) => {
    if (error instanceof ScientificHttpError)
      return error.status === 429 ? "provider_rate_limited" : "provider_http_error";
    if (error instanceof Error && error.name === "AbortError") return "provider_timeout";
    return "scientific_ingestion_error";
  });

/** Purely operational handler; dependencies are injected so tests never use network or the real database. */
export async function handleScientificPilotRequest(
  request: PilotRequest,
  dependencies: PilotDependencies,
): Promise<PilotResponse> {
  if (request.method.toUpperCase() !== "POST") return { status: 405, body: { ok: false, error: "method_not_allowed" } };
  if (!isScientificPilotAuthorized(request.authorization, dependencies.expectedToken))
    return { status: 401, body: { ok: false, error: "unauthorized" } };
  const parsed = payloadSchema.safeParse(request.body);
  if (!parsed.success) return { status: 400, body: { ok: false, error: "invalid_request" } };
  const query = dependencies.query.trim();
  if (query.length < 3 || query.length > 300)
    return { status: 503, body: { ok: false, error: "pilot_not_configured" } };

  const hash = requestHash(query, parsed.data);
  const claim = await dependencies.operations.claim(parsed.data.operationKey, hash);
  if (!claim.claimed) {
    if (claim.existing?.requestHash !== hash)
      return { status: 409, body: { ok: false, error: "operation_key_conflict" } };
    if (claim.existing.status === "completed" && claim.existing.report)
      return { status: 200, body: { ok: true, report: claim.existing.report, replayed: true } };
    return { status: 409, body: { ok: false, error: "operation_in_progress_or_failed" } };
  }

  const now = dependencies.now ?? Date.now;
  const started = now();
  let discovered: ScientificArticle[] = [];
  try {
    discovered = await dependencies.discover({
      query,
      limit: parsed.data.limit,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
    });
    const unique = deduplicateArticles(discovered);
    const persisted = await dependencies.persist(unique);
    const report: PilotReport = {
      operationKey: parsed.data.operationKey,
      providers: ["pubmed"],
      discovered: discovered.length,
      normalized: discovered.length,
      deduplicated: unique.length,
      inserted: persisted.new,
      mergedOrUpdated: persisted.updated + persisted.reconciled,
      skipped: Math.max(0, discovered.length - unique.length),
      failed: persisted.failed,
      durationMs: Math.max(0, now() - started),
      errors: persisted.errors.length ? persisted.errors.map(() => "persistence_error") : [],
    };
    await dependencies.operations.finish(parsed.data.operationKey, "completed", report);
    return { status: 200, body: { ok: true, report } };
  } catch (error) {
    const report: PilotReport = {
      operationKey: parsed.data.operationKey,
      providers: ["pubmed"],
      discovered: discovered.length,
      normalized: discovered.length,
      deduplicated: 0,
      inserted: 0,
      mergedOrUpdated: 0,
      skipped: 0,
      failed: 1,
      durationMs: Math.max(0, now() - started),
      errors: safeErrors([error]),
    };
    // A failed final ledger update must not reveal infrastructure details or trigger an unsafe retry.
    await dependencies.operations.finish(parsed.data.operationKey, "failed", report).catch(() => undefined);
    return { status: 502, body: { ok: false, report, error: "pilot_failed" } };
  }
}

export function createSupabasePilotOperationStore(client: SupabaseClient): PilotOperationStore {
  return {
    async claim(operationKey, hash) {
      const inserted = await client
        .from("scientific_ingestion_operations")
        .insert({ operation_key: operationKey, request_hash: hash, status: "running" })
        .select("operation_key")
        .maybeSingle();
      if (!inserted.error) return { claimed: true };
      if (inserted.error.code !== "23505") throw new Error("operation_store_unavailable");
      const existing = await client
        .from("scientific_ingestion_operations")
        .select("request_hash,status,report")
        .eq("operation_key", operationKey)
        .single();
      if (existing.error) throw new Error("operation_store_unavailable");
      return {
        claimed: false,
        existing: {
          requestHash: existing.data.request_hash,
          status: existing.data.status,
          report: existing.data.report,
        },
      };
    },
    async finish(operationKey, status, report) {
      const result = await client
        .from("scientific_ingestion_operations")
        .update({ status, report, completed_at: new Date().toISOString() })
        .eq("operation_key", operationKey)
        .eq("status", "running");
      if (result.error) throw new Error("operation_store_unavailable");
    },
  };
}

/** Production dependencies: one fixed provider, bounded requests, and the existing persistence engine. */
export function createScientificPilotDependencies(
  client: SupabaseClient,
  configuration: { expectedToken: string; query: string },
): PilotDependencies {
  const adapter = new PubMedAdapter({ timeoutMs: 8_000, retries: 1 });
  return {
    ...configuration,
    operations: createSupabasePilotOperationStore(client),
    discover: (options) => adapter.discover({ ...options, sources: ["pubmed"] }),
    persist: (articles) => ingestScientificBatch(client, articles),
  };
}
