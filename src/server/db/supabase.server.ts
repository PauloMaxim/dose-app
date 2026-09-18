import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAuthEnv, getServerEnv } from "../config/env.server";

let adminClient: SupabaseClient | undefined;

/**
 * Privileged database client. Call only after authenticating and authorizing
 * the request. The service role bypasses RLS and must never enter client code.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  const env = getServerEnv();
  adminClient ??= createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}

export function getSupabaseUserClient(accessToken: string): SupabaseClient {
  const env = getAuthEnv();
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
