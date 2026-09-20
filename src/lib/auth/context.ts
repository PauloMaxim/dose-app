import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createContext } from "react";

export type AuthSecurityState = { recoveryUserId: string | null; callbackUserId: string | null };

export function reduceAuthSecurityState(
  state: AuthSecurityState,
  event: AuthChangeEvent,
  session: Session | null,
  atAuthCallback = false,
): AuthSecurityState {
  if (event === "PASSWORD_RECOVERY")
    return {
      recoveryUserId: session?.user.id ?? null,
      callbackUserId: atAuthCallback ? (session?.user.id ?? null) : state.callbackUserId,
    };
  if (event === "SIGNED_IN" && atAuthCallback)
    return { ...state, callbackUserId: session?.user.id ?? null };
  if (event === "SIGNED_OUT") return { recoveryUserId: null, callbackUserId: null };
  return state;
}

export type AuthContextValue = {
  session: Session | null;
  isPending: boolean;
  recoveryUserId: string | null;
  recoveryPending: boolean;
  callbackUserId: string | null;
  consumeRecovery: () => void;
};
export const AuthContext = createContext<AuthContextValue>({
  session: null,
  isPending: true,
  recoveryUserId: null,
  recoveryPending: false,
  callbackUserId: null,
  consumeRecovery: () => undefined,
});
