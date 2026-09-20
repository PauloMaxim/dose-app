import type { Provider, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "../supabase/client";
import { GROK_PROVIDERS } from "./providers";
import {
  loginWithPassword,
  logoutSession,
  registerWithPassword,
  sendPasswordRecovery,
  setAccountPassword,
} from "./auth-actions";
import { authRedirect, confirmationRedirectPath } from "./auth-flow";

export const authEnabled = isSupabaseBrowserConfigured();
export { GROK_PROVIDERS };
export type AuthResult = { error: Error | null; user?: User | null };

const unavailable = () => new Error("Supabase Auth não está configurado neste ambiente.");

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult & { needsConfirmation?: boolean }> {
  if (!authEnabled) return { error: unavailable() };
  const { data, error } = await registerWithPassword(
    getSupabaseBrowserClient().auth,
    email,
    password,
    authRedirect(confirmationRedirectPath("signup")),
    displayName,
  );
  return {
    // Preserve AuthError metadata such as status/code so the UI can distinguish
    // a real server rate limit from local validation failures.
    error:
      error &&
      Object.assign(new Error(error.message), {
        status: error.status,
        code: error.code,
      }),
    user: data.user as User | null,
    needsConfirmation: Boolean(data.user && !data.session),
  };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!authEnabled) return { error: unavailable() };
  const { data, error } = await loginWithPassword(getSupabaseBrowserClient().auth, email, password);
  return { error: error ? new Error(error.message) : null, user: data.user as User | null };
}

export async function signIn(
  providerId: string,
  opts: { callbackURL?: string } = {},
): Promise<void> {
  if (!authEnabled) throw unavailable();
  const provider = GROK_PROVIDERS.find((item) => item.providerId === providerId);
  if (!provider) throw new Error("Provedor de autenticação inválido.");
  const redirectTo = new URL(opts.callbackURL ?? "/", window.location.origin).toString();
  const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
    provider: provider.idp as Provider,
    options: { redirectTo },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(redirectTo = "/"): Promise<void> {
  if (authEnabled) {
    const { error } = await logoutSession(getSupabaseBrowserClient().auth);
    if (error) throw new Error(error.message);
  }
  if (typeof window !== "undefined") window.location.assign(redirectTo);
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!authEnabled) return { error: unavailable() };
  const redirectTo = authRedirect(confirmationRedirectPath("recovery"));
  const { error } = await sendPasswordRecovery(getSupabaseBrowserClient().auth, email, redirectTo);
  return { error: error ? new Error(error.message) : null };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  if (!authEnabled) return { error: unavailable() };
  const { data, error } = await setAccountPassword(getSupabaseBrowserClient().auth, password);
  return { error: error ? new Error(error.message) : null, user: data.user as User | null };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult> {
  if (!authEnabled) return { error: unavailable() };
  const client = getSupabaseBrowserClient();
  const { data } = await client.auth.getUser();
  const email = data.user?.email;
  if (!email) return { error: new Error("Sessão sem e-mail disponível.") };
  const verified = await signInWithPassword(email, currentPassword);
  if (verified.error) return verified;
  return updatePassword(newPassword);
}

export async function reauthenticatePassword(currentPassword: string): Promise<AuthResult> {
  if (!authEnabled) return { error: unavailable() };
  const { data } = await getSupabaseBrowserClient().auth.getUser();
  const email = data.user?.email;
  if (!email) return { error: new Error("Sessão sem e-mail disponível.") };
  return signInWithPassword(email, currentPassword);
}

export async function updateEmail(email: string): Promise<AuthResult> {
  if (!authEnabled) return { error: unavailable() };
  const { data, error } = await getSupabaseBrowserClient().auth.updateUser(
    { email },
    { emailRedirectTo: authRedirect(confirmationRedirectPath("email-change")) },
  );
  return { error: error ? new Error(error.message) : null, user: data.user };
}

export async function resendSignup(email: string): Promise<AuthResult> {
  if (!authEnabled) return { error: unavailable() };
  const { error } = await getSupabaseBrowserClient().auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: authRedirect(confirmationRedirectPath("signup")) },
  });
  return { error: error ? new Error(error.message) : null };
}

export async function getAccessToken(): Promise<string | null> {
  if (!authEnabled) return null;
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  return error ? null : (data.session?.access_token ?? null);
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!authEnabled) return null;
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session;
}
