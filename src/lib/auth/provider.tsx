import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "../supabase/client";
import { authEnabled } from "./client";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setPending] = useState(authEnabled);

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
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setPending(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, isPending }), [session, isPending]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
