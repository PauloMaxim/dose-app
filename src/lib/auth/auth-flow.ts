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

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "seu e-mail";
  return `${local.slice(0, Math.min(2, local.length))}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

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
