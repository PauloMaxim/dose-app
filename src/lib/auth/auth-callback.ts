import { callbackDestination, requiresLegalAcceptance, type AuthCallbackKind } from "./auth-flow";

export function resolveConfirmedCallbackKind(input: {
  requestedKind: AuthCallbackKind;
  redirectType: string | null;
  otpType: string | null;
}): AuthCallbackKind {
  if (input.requestedKind === "recovery" && input.redirectType !== "recovery")
    throw new Error("invalid recovery link");
  if (input.redirectType === "recovery") return "recovery";
  if (input.requestedKind === "signup") return "signup";
  if (input.requestedKind === "email-change" || input.otpType === "email_change")
    return "email-change";
  return null;
}

export async function finishConfirmedIdentity(
  kind: AuthCallbackKind,
  acceptLegal: () => Promise<unknown>,
): Promise<
  | { status: "ready"; destination: ReturnType<typeof callbackDestination> }
  | { status: "post-confirm-error" }
> {
  if (requiresLegalAcceptance(kind)) {
    try {
      await acceptLegal();
    } catch {
      return { status: "post-confirm-error" };
    }
  }
  return { status: "ready", destination: callbackDestination(kind) };
}
