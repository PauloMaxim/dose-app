import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim());
}

function publicSupabaseConfig(): { url: string; publishableKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and " +
        "VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, publishableKey };
}

/**
 * Browser client for Supabase Auth and RLS-protected data access.
 *
 * This client deliberately has no service-role credential. Authentication and
 * RLS-protected browser requests use only the project's publishable key.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  const { url, publishableKey } = publicSupabaseConfig();
  browserClient ??= createClient(url, publishableKey);
  return browserClient;
}
