import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { friendlyAuthError, maskEmail } from "@/lib/auth/auth-flow";
import { getCurrentSession, resendSignup } from "@/lib/auth/client";
export const Route = createFileRoute("/auth/verify-email")({ component: VerifyEmail });
function VerifyEmail() {
  const email =
    typeof window === "undefined" ? "" : (sessionStorage.getItem("dose-auth-email") ?? "");
  const [cooldown, setCooldown] = useState(30);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);
  async function resend() {
    setBusy(true);
    const r = await resendSignup(email);
    setBusy(false);
    setMessage(
      r.error ? friendlyAuthError(r.error) : "Novo e-mail enviado. Confira também a caixa de spam.",
    );
    if (!r.error) setCooldown(30);
  }
  async function checked() {
    setBusy(true);
    const session = await getCurrentSession();
    setBusy(false);
    if (session) window.location.assign("/onboarding");
    else setMessage("Ainda não encontramos a confirmação. Aguarde um instante e tente novamente.");
  }
  return (
    <AuthShell
      title="Confirme seu e-mail"
      description={`Enviamos um link para ${maskEmail(email)}. Abra-o para concluir sua conta.`}
    >
      <div aria-live="polite">
        {message && <p className="mb-4 text-sm text-muted">{message}</p>}
      </div>
      <Button className="w-full" size="lg" disabled={busy} onClick={() => void checked()}>
        Já confirmei
      </Button>
      <button
        className="mt-3 min-h-11 w-full text-sm text-muted"
        disabled={busy || cooldown > 0 || !email}
        onClick={() => void resend()}
      >
        {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar confirmação"}
      </button>
      <Link to="/auth/signup" className="mt-3 flex min-h-11 items-center justify-center text-sm">
        Corrigir e-mail
      </Link>
    </AuthShell>
  );
}
