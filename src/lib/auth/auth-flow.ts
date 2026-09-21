import type { User } from "@supabase/supabase-js";

export const PASSWORD_MIN_LENGTH = 8;

export type EmailConfirmationReconciliation =
  | { status: "confirmed"; user: User }
  | { status: "unconfirmed" }
  | { status: "signed-out" }
  | { status: "error" };

export function classifyRevalidatedUser(user: User | null): EmailConfirmationReconciliation {
  if (!user) return { status: "signed-out" };
  return user.email_confirmed_at ? { status: "confirmed", user } : { status: "unconfirmed" };
}

export function isAcceptableEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function safeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return fallback;
  try {
    const url = new URL(value, "https://dose.local");
    return url.origin === "https://dose.local"
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

export function authRedirect(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function confirmationRedirectPath(kind: Exclude<AuthCallbackKind, null>): string {
  return `/auth/action?kind=${kind}`;
}

export type AuthEmailAction = {
  kind: Exclude<AuthCallbackKind, null>;
  type: "signup" | "recovery" | "email_change";
  tokenHash: string;
};

const actionKindByType = {
  signup: "signup",
  recovery: "recovery",
  email_change: "email-change",
} as const;

/**
 * Parses only the shape of an email action. This deliberately performs no
 * Supabase call: the token remains unconsumed until the user continues.
 */
export function parseAuthEmailAction(search: string): AuthEmailAction | null {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  const tokenHash = params.get("token_hash");
  const kind = params.get("kind");
  if (!(type && type in actionKindByType) || !tokenHash?.trim()) return null;
  const expectedKind = actionKindByType[type as keyof typeof actionKindByType];
  if (kind !== expectedKind) return null;
  return { kind: expectedKind, type: type as AuthEmailAction["type"], tokenHash };
}

export function authConfirmationPath(action: AuthEmailAction): string {
  const params = new URLSearchParams({
    kind: action.kind,
    token_hash: action.tokenHash,
    type: action.type,
  });
  return `/auth/confirm?${params.toString()}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "seu e-mail";
  return `${local.slice(0, Math.min(2, local.length))}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export type AuthCallbackKind = "signup" | "recovery" | "email-change" | null;

export function callbackDestination(
  kind: AuthCallbackKind,
): "/auth/reset-password" | "/" | "/onboarding" {
  if (kind === "recovery") return "/auth/reset-password";
  // The protected root is the single authority that checks the remote profile
  // before choosing Home or onboarding.
  return "/";
}

export function requiresLegalAcceptance(kind: AuthCallbackKind): boolean {
  return kind === "signup";
}

export function legalReturnPath(from: string | null): "/config" | "/auth/signup" {
  return from === "config" ? "/config" : "/auth/signup";
}

export function canResetPassword(
  recoveryUserId: string | null,
  sessionUserId: string | null,
): boolean {
  return Boolean(recoveryUserId && sessionUserId && recoveryUserId === sessionUserId);
}

export const RECOVERY_SUCCESS_DESTINATION = "/onboarding" as const;

export function friendlyAuthError(
  error: unknown,
  fallback = "Não foi possível concluir agora. Tente novamente.",
): string {
  const details =
    typeof error === "object" && error !== null
      ? (error as { status?: unknown; code?: unknown })
      : null;
  const code = typeof details?.code === "string" ? details.code.toLowerCase() : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (details?.status === 429 || code.includes("rate_limit") || code === "too_many_requests")
    return "Muitas tentativas em pouco tempo. Aguarde um momento antes de tentar novamente.";
  if (message.includes("invalid login") || message.includes("invalid credentials"))
    return "E-mail ou senha não conferem.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("password") && (message.includes("weak") || message.includes("short")))
    return `Use uma senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (message.includes("rate") || message.includes("too many"))
    return "Muitas tentativas em pouco tempo. Aguarde um momento antes de tentar novamente.";
  if (message.includes("expired")) return "Este link expirou. Solicite um novo.";
  if (message.includes("invalid") && (message.includes("token") || message.includes("link")))
    return "Este link não é válido ou já foi utilizado.";
  if (message.includes("network") || message.includes("fetch") || message.includes("timeout"))
    return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  return fallback;
}
