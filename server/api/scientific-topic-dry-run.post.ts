import { defineEventHandler, getHeader, readBody, setResponseStatus } from "h3";
import { getScientificPilotEnv } from "../../src/server/config/env.server";
import { getSupabaseAdminClient } from "../../src/server/db/supabase.server";
import {
  createTopicDryRunDependencies,
  handleTopicDryRunRequest,
  TOPIC_DRY_RUN_MAX_BODY_BYTES,
} from "../../src/server/scientific/topic-backfill-dry-run.server";
import { isScientificPilotAuthorized } from "../../src/server/scientific/pilot-ingestion.server";

/** Authenticated administrative endpoint exposing only the topic backfill's read-only mode. */
export default defineEventHandler(async (event) => {
  if (event.req.method?.toUpperCase() !== "POST") {
    setResponseStatus(event, 405);
    return { ok: false, error: "method_not_allowed" };
  }
  const contentLength = Number(getHeader(event, "content-length"));
  if (Number.isFinite(contentLength) && contentLength > TOPIC_DRY_RUN_MAX_BODY_BYTES) {
    setResponseStatus(event, 413);
    return { ok: false, error: "request_too_large" };
  }
  const configuration = getScientificPilotEnv();
  const authorization = getHeader(event, "authorization");
  if (!isScientificPilotAuthorized(authorization, configuration.SCIENTIFIC_INGESTION_TOKEN)) {
    setResponseStatus(event, 401);
    return { ok: false, error: "unauthorized" };
  }
  const response = await handleTopicDryRunRequest(
    {
      method: event.req.method,
      authorization,
      body: await readBody(event).catch(() => null),
    },
    createTopicDryRunDependencies(
      getSupabaseAdminClient(),
      configuration.SCIENTIFIC_INGESTION_TOKEN,
    ),
  );
  setResponseStatus(event, response.status);
  return response.body;
});
