export type RemoteOnboardingState = "idle" | "loading" | "complete" | "incomplete" | "error";

export type AppAccessState =
  | "session_loading"
  | "signed_out"
  | "profile_loading"
  | "profile_error"
  | "onboarding_required"
  | "ready";

export function resolveAppAccessState(input: {
  sessionPending: boolean;
  hasUser: boolean;
  remoteOnboarding: RemoteOnboardingState;
}): AppAccessState {
  if (input.sessionPending) return "session_loading";
  if (!input.hasUser) return "signed_out";
  if (input.remoteOnboarding === "error") return "profile_error";
  if (input.remoteOnboarding === "complete") return "ready";
  if (input.remoteOnboarding === "incomplete") return "onboarding_required";
  return "profile_loading";
}

export function privateCacheMustReset(
  previousOwner: string | null,
  nextOwner: string | null,
): boolean {
  return previousOwner !== nextOwner;
}

const PROTECTED_EXACT_PATHS = new Set([
  "/",
  "/artigos",
  "/dashboard",
  "/insights",
  "/mascote",
  "/perfil",
  "/config",
]);

export function isProtectedAppPath(pathname: string): boolean {
  return (
    PROTECTED_EXACT_PATHS.has(pathname) ||
    pathname.startsWith("/artigo/") ||
    pathname.startsWith("/edicao/") ||
    pathname.startsWith("/ler/")
  );
}

export function destinationAfterPlan(input: {
  hasUser: boolean;
  remoteOnboardingComplete: boolean;
}): "/login" | "/onboarding" | "/" {
  if (!input.hasUser) return "/login";
  return input.remoteOnboardingComplete ? "/" : "/onboarding";
}
