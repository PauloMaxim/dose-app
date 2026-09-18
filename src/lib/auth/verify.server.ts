import { createClient } from "@supabase/supabase-js";
import { getAuthEnv } from "../../server/config/env.server.ts";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

export async function verifyAccessToken(
  accessToken: string | undefined,
  lookup: (token: string) => Promise<{ id: string; email?: string | null } | null>,
): Promise<VerifiedUser | null> {
  if (!accessToken) return null;
  const user = await lookup(accessToken);
  return user ? { id: user.id, email: user.email ?? null } : null;
}

export async function getSessionUser(accessToken?: string): Promise<VerifiedUser | null> {
  return verifyAccessToken(accessToken, async (token) => {
    const env = getAuthEnv();
    const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.getUser(token);
    return error || !data.user ? null : data.user;
  });
}

export async function requireUserId(accessToken?: string): Promise<string> {
  const user = await getSessionUser(accessToken);
  if (!user) throw new UnauthorizedError();
  return user.id;
}
