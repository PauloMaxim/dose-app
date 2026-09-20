import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { friendlyAuthError } from "@/lib/auth/auth-flow";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { acceptCurrentLegalDocuments } from "@/server/domains/account";

export const Route = createFileRoute("/auth/confirm")({ component: Confirm });
function Confirm() {
  const [state, setState] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const type = params.get("type") as "signup" | "recovery" | "email_change" | null;
        const kind = params.get("kind");
        const client = getSupabaseBrowserClient();
        let error = null;
        if (code) ({ error } = await client.auth.exchangeCodeForSession(code));
        else if (tokenHash && type)
          ({ error } = await client.auth.verifyOtp({ token_hash: tokenHash, type }));
        else {
          const result = await client.auth.getSession();
          error = result.error;
          if (!result.data.session && !error) throw new Error("invalid link");
        }
        if (error) throw error;
        if (type === "signup" || kind === "signup") await acceptCurrentLegalDocuments();
        if (!active) return;
        window.location.replace(type === "recovery" ? "/auth/reset-password" : "/onboarding");
      } catch (e) {
        if (active) {
          setMessage(friendlyAuthError(e, "Este link não é válido, expirou ou já foi utilizado."));
          setState("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <AuthShell
      title={state === "loading" ? "Confirmando…" : "Não foi possível confirmar"}
      description={state === "loading" ? "Estamos validando seu link com segurança." : message}
    >
      {state === "loading" ? (
        <p role="status" aria-live="polite">
          Aguarde um instante.
        </p>
      ) : (
        <div className="space-y-3">
          <Link
            to="/auth/verify-email"
            className="flex min-h-11 items-center justify-center rounded-xl bg-card"
          >
            Solicitar novo link
          </Link>
          <Link to="/login" className="flex min-h-11 items-center justify-center">
            Voltar para entrar
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
