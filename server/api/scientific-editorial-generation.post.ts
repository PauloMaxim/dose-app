import { defineEventHandler, getHeader, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { getScientificOperationEnv } from "../../src/server/config/env.server";
import { isScientificPilotAuthorized } from "../../src/server/scientific/pilot-ingestion.server";
import {
  runRealEditorialGeneration,
  SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID,
} from "../../src/server/scientific/editorial-draft/real-generation.server";

const requestSchema = z
  .object({
    articleId: z.literal(SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID),
    confirmRealGeneration: z.literal(true),
  })
  .strict();
const MAX_BODY_BYTES = 512;

/** Manual, authenticated, one-shot operation. Visiting a page can never invoke this POST endpoint. */
export default defineEventHandler(async (event) => {
  if (event.req.method?.toUpperCase() !== "POST") {
    setResponseStatus(event, 405);
    return { ok: false, error: "method_not_allowed" };
  }
  const contentLength = Number(getHeader(event, "content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    setResponseStatus(event, 413);
    return { ok: false, error: "request_too_large" };
  }
  const { SCIENTIFIC_INGESTION_TOKEN } = getScientificOperationEnv();
  if (!isScientificPilotAuthorized(getHeader(event, "authorization"), SCIENTIFIC_INGESTION_TOKEN)) {
    setResponseStatus(event, 401);
    return { ok: false, error: "unauthorized" };
  }
  const parsed = requestSchema.safeParse(await readBody(event).catch(() => null));
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { ok: false, error: "explicit_confirmation_and_authorized_canary_required" };
  }
  const result = await runRealEditorialGeneration(parsed.data);
  setResponseStatus(event, result.error ? 502 : result.validationStatus === "rejected" ? 422 : 200);
  return { ok: !result.error && result.validationStatus === "accepted", result };
});
