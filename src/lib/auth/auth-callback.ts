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

export function canReconcileFailedConfirmation(input: {
  requestedKind: AuthCallbackKind;
  remotelyConfirmed: boolean;
  hasCallbackProof: boolean;
}): boolean {
  // A failed recovery callback must remain failed. For ordinary confirmation,
  // only a provider event produced on this callback plus a fresh getUser result
  // can prove that identity confirmation actually completed before a later step
  // reported an error.
  return input.requestedKind !== "recovery" && input.remotelyConfirmed && input.hasCallbackProof;
}

export function canReconcileFailedRecovery(input: {
  requestedKind: AuthCallbackKind;
  revalidatedUserId: string | null;
  recoveryProofUserId: string | null;
}): boolean {
  // The URL only identifies the intended flow. Authorization still requires a
  // PASSWORD_RECOVERY event, bound to the identity freshly read from Supabase.
  return (
    input.requestedKind === "recovery" &&
    Boolean(input.revalidatedUserId && input.revalidatedUserId === input.recoveryProofUserId)
  );
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
