import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "../supabase/client";
import { authEnabled } from "./client";
import { canResetPassword } from "./auth-flow";
import { AuthContext, reduceAuthSecurityState } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setPending] = useState(authEnabled);
  const [security, setSecurity] = useState({
    recoveryUserId: null as string | null,
    callbackUserId: null as string | null,
  });
  const securityRef = useRef(security);

  useEffect(() => {
    if (!authEnabled) {
      setPending(false);
      return;
    }
    const client = getSupabaseBrowserClient();
    let active = true;
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        setSession(error ? null : data.session);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setPending(false);
        const nextSecurity = reduceAuthSecurityState(
          securityRef.current,
          event,
          nextSession,
          typeof window !== "undefined" && window.location.pathname === "/auth/confirm",
        );
        securityRef.current = nextSecurity;
        setSecurity(nextSecurity);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const hasRecoveryProof = useCallback(
    (userId: string) => securityRef.current.recoveryUserId === userId,
    [],
  );
  const hasCallbackProof = useCallback(
    (userId: string) => securityRef.current.callbackUserId === userId,
    [],
  );
  const consumeRecovery = useCallback(() => {
    const nextSecurity = { ...securityRef.current, recoveryUserId: null };
    securityRef.current = nextSecurity;
    setSecurity(nextSecurity);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isPending,
      recoveryUserId: security.recoveryUserId,
      recoveryPending: canResetPassword(security.recoveryUserId, session?.user.id ?? null),
      callbackUserId: security.callbackUserId,
      hasRecoveryProof,
      hasCallbackProof,
      consumeRecovery,
    }),
    [
      consumeRecovery,
      hasCallbackProof,
      hasRecoveryProof,
      isPending,
      security.callbackUserId,
      security.recoveryUserId,
      session,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
