export const PASSWORD_MIN_LENGTH = 8;

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
  return `/auth/confirm?kind=${kind}`;
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
  if (kind === "email-change") return "/";
  return "/onboarding";
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
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login") || message.includes("invalid credentials"))
    return "E-mail ou senha não conferem.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("password") && (message.includes("weak") || message.includes("short")))
    return `Use uma senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (message.includes("rate") || message.includes("too many"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos.";
  if (message.includes("expired")) return "Este link expirou. Solicite um novo.";
  if (message.includes("invalid") && (message.includes("token") || message.includes("link")))
    return "Este link não é válido ou já foi utilizado.";
  if (message.includes("network") || message.includes("fetch") || message.includes("timeout"))
    return "Não foi possível conectar. Verifique sua internet e tente novamente.";
  return fallback;
}
