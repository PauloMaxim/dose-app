import { defineEventHandler, getHeader, readBody, setResponseStatus } from "h3";
import { getScientificPilotEnv } from "../../src/server/config/env.server";
import { getSupabaseAdminClient } from "../../src/server/db/supabase.server";
import {
  createScientificPilotDependencies,
  handleScientificPilotRequest,
  isScientificPilotAuthorized,
} from "../../src/server/scientific/pilot-ingestion.server";

/** Manually invoked operational endpoint. No client module imports or UI route expose it. */
export default defineEventHandler(async (event) => {
  const configuration = getScientificPilotEnv();
  const authorization = getHeader(event, "authorization");
  if (!isScientificPilotAuthorized(authorization, configuration.SCIENTIFIC_INGESTION_TOKEN)) {
    setResponseStatus(event, 401);
    return { ok: false, error: "unauthorized" };
  }
  const response = await handleScientificPilotRequest(
    {
      method: event.req.method,
      authorization,
      body: await readBody(event).catch(() => null),
    },
    createScientificPilotDependencies(getSupabaseAdminClient(), {
      expectedToken: configuration.SCIENTIFIC_INGESTION_TOKEN,
      query: configuration.SCIENTIFIC_PILOT_QUERY,
    }),
  );
  setResponseStatus(event, response.status);
  return response.body;
});
