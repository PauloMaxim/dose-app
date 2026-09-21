import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useContext, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { friendlyAuthError, type AuthCallbackKind } from "@/lib/auth/auth-flow";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { acceptCurrentLegalDocuments } from "@/server/domains/account";
import {
  canReconcileFailedConfirmation,
  canReconcileFailedRecovery,
  finishConfirmedIdentity,
  resolveConfirmedCallbackKind,
} from "@/lib/auth/auth-callback";
import { AuthContext } from "@/lib/auth/context";

export const Route = createFileRoute("/auth/confirm")({ component: Confirm });
type ConfirmState = "confirming" | "identity-error" | "post-confirm-error";

export function Confirm() {
  const { hasRecoveryProof, hasCallbackProof } = useContext(AuthContext);
  const navigate = useNavigate();
  const [state, setState] = useState<ConfirmState>("confirming");
  const [message, setMessage] = useState("");
  const [confirmedKind, setConfirmedKind] = useState<AuthCallbackKind>(null);

  const finishAfterIdentity = useCallback(
    async (kind: AuthCallbackKind) => {
      setConfirmedKind(kind);
      const result = await finishConfirmedIdentity(kind, acceptCurrentLegalDocuments);
      if (result.status === "post-confirm-error") {
        setMessage("Seu e-mail foi confirmado, mas não conseguimos finalizar o cadastro agora.");
        setState("post-confirm-error");
        return;
      }
      if (kind === "recovery") {
        await navigate({ to: result.destination, replace: true });
        return;
      }
      window.location.replace(result.destination);
    },
    [navigate],
  );

  useEffect(() => {
    let active = true;
    let unsubscribeCallback: (() => void) | undefined;
    let observedRecoveryUserId: string | null = null;
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const requestedKind = params.get("kind") as AuthCallbackKind;
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const otpType = params.get("type") as "signup" | "recovery" | "email_change" | null;
        const client = getSupabaseBrowserClient();
        let confirmedUserId: string | null = null;
        const { data: listener } = client.auth.onAuthStateChange((event, session) => {
          if (event === "PASSWORD_RECOVERY") observedRecoveryUserId = session?.user.id ?? null;
        });
        unsubscribeCallback = () => listener.subscription.unsubscribe();
        if (code) {
          const { data, error } = await client.auth.exchangeCodeForSession(code);
          if (error) throw error;
          confirmedUserId = data.user.id;
        } else if (tokenHash && otpType) {
          const { data, error } = await client.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (error) throw error;
          confirmedUserId = data.user?.id ?? null;
        } else {
          const result = await client.auth.getSession();
          if (result.error) throw result.error;
          if (!result.data.session) throw new Error("invalid link");
          confirmedUserId = result.data.session.user.id;
          if (!hasCallbackProof(confirmedUserId)) throw new Error("invalid link");
        }
        unsubscribeCallback();
        unsubscribeCallback = undefined;

        // Recovery is accepted only when Supabase emits its dedicated event;
        // a forgeable `kind` query parameter can never promote a normal session.
        const recoveryProven = Boolean(
          confirmedUserId &&
          (observedRecoveryUserId === confirmedUserId || hasRecoveryProof(confirmedUserId)),
        );
        const kind = resolveConfirmedCallbackKind({
          requestedKind,
          redirectType: recoveryProven ? "recovery" : null,
          otpType,
        });
        if (active) await finishAfterIdentity(kind);
      } catch (error) {
        if (active) {
          const requestedKind = new URLSearchParams(window.location.search).get(
            "kind",
          ) as AuthCallbackKind;
          const reconciliation = await getSupabaseBrowserClient()
            .auth.getUser()
            .catch(() => null);
          const user = reconciliation?.data.user;
          const recoveryProofUserId =
            user && (observedRecoveryUserId === user.id || hasRecoveryProof(user.id))
              ? user.id
              : null;
          if (
            active &&
            canReconcileFailedRecovery({
              requestedKind,
              revalidatedUserId: user?.id ?? null,
              recoveryProofUserId,
            })
          ) {
            await finishAfterIdentity("recovery");
            return;
          }
          if (
            active &&
            user &&
            canReconcileFailedConfirmation({
              requestedKind,
              remotelyConfirmed: Boolean(user.email_confirmed_at),
              hasCallbackProof: hasCallbackProof(user.id),
            })
          ) {
            await finishAfterIdentity(requestedKind === "signup" ? "signup" : null);
            return;
          }
          setMessage(
            friendlyAuthError(error, "Este link não é válido, expirou ou já foi utilizado."),
          );
          setState("identity-error");
        }
      }
    })();
    return () => {
      active = false;
      unsubscribeCallback?.();
    };
  }, [finishAfterIdentity, hasCallbackProof, hasRecoveryProof]);

  return (
    <AuthShell
      title={
        state === "confirming"
          ? "Confirmando…"
          : state === "identity-error"
            ? "Não foi possível confirmar"
            : "Confirmação concluída"
      }
      description={state === "confirming" ? "Estamos validando seu link com segurança." : message}
    >
      {state === "confirming" ? (
        <p role="status" aria-live="polite">
          Aguarde um instante.
        </p>
      ) : state === "post-confirm-error" ? (
        <div className="space-y-3">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-card"
            onClick={() => void finishAfterIdentity(confirmedKind)}
          >
            Tentar finalizar novamente
          </button>
          <Link to="/login" className="flex min-h-11 items-center justify-center">
            Continuar depois
          </Link>
        </div>
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
