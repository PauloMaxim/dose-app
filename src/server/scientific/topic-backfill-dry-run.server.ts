import "./server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isScientificPilotAuthorized } from "./pilot-ingestion.server";
import {
  MAX_TOPIC_BACKFILL_BATCH_SIZE,
  runTopicBackfillBatch,
  type TopicBackfillReport,
} from "./topic-backfill.server";

export const TOPIC_DRY_RUN_MAX_BODY_BYTES = 1_024;

const topicDryRunPayloadSchema = z
  .object({
    batchSize: z.number().int().min(1).max(MAX_TOPIC_BACKFILL_BATCH_SIZE),
    afterArticleId: z.string().uuid().optional(),
  })
  .strict();

export interface TopicDryRunRequest {
  method: string;
  authorization?: string | null;
  body: unknown;
}

export interface TopicDryRunDependencies {
  expectedToken: string;
  run(request: {
    mode: "dry_run";
    batchSize: number;
    afterArticleId?: string;
  }): Promise<TopicBackfillReport>;
}

export type TopicDryRunResponse =
  | { status: 200; body: { ok: true; report: TopicBackfillReport } }
  | { status: 400 | 401 | 405 | 413 | 500; body: { ok: false; error: string } };

/** Authenticates and validates the administrative request before running the read-only planner. */
export async function handleTopicDryRunRequest(
  request: TopicDryRunRequest,
  dependencies: TopicDryRunDependencies,
): Promise<TopicDryRunResponse> {
  if (request.method.toUpperCase() !== "POST")
    return { status: 405, body: { ok: false, error: "method_not_allowed" } };
  if (!isScientificPilotAuthorized(request.authorization, dependencies.expectedToken))
    return { status: 401, body: { ok: false, error: "unauthorized" } };

  let bodyBytes = TOPIC_DRY_RUN_MAX_BODY_BYTES + 1;
  try {
    bodyBytes = Buffer.byteLength(JSON.stringify(request.body), "utf8");
  } catch {
    // Non-JSON bodies are rejected without reflecting parser details.
  }
  if (bodyBytes > TOPIC_DRY_RUN_MAX_BODY_BYTES)
    return { status: 413, body: { ok: false, error: "request_too_large" } };

  const parsed = topicDryRunPayloadSchema.safeParse(request.body);
  if (!parsed.success) return { status: 400, body: { ok: false, error: "invalid_request" } };

  try {
    const report = await dependencies.run({
      mode: "dry_run",
      batchSize: parsed.data.batchSize,
      ...(parsed.data.afterArticleId ? { afterArticleId: parsed.data.afterArticleId } : {}),
    });
    return { status: 200, body: { ok: true, report } };
  } catch {
    return { status: 500, body: { ok: false, error: "topic_dry_run_failed" } };
  }
}

/** Production dependency: the only exposed operation fixes the existing backfill to dry-run mode. */
export function createTopicDryRunDependencies(
  client: SupabaseClient,
  expectedToken: string,
): TopicDryRunDependencies {
  return {
    expectedToken,
    run: (request) => runTopicBackfillBatch(client, request),
  };
}
