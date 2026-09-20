import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, fieldClass } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { friendlyAuthError, PASSWORD_MIN_LENGTH } from "@/lib/auth/auth-flow";
import { getCurrentSession, requestPasswordReset, updatePassword } from "@/lib/auth/client";
export const Route = createFileRoute("/auth/reset-password")({ component: ResetPassword });
function ResetPassword() {
  const request =
    typeof window !== "undefined" && new URLSearchParams(location.search).get("request") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    if (request) {
      await requestPasswordReset(email.trim());
      setBusy(false);
      setMessage("Se houver uma conta associada a este e-mail, enviaremos as instruções.");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH || password !== confirm) {
      setBusy(false);
      setError(
        password !== confirm
          ? "As senhas não coincidem."
          : `Use uma senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      );
      return;
    }
    if (!(await getCurrentSession())) {
      setBusy(false);
      setError("Este link não é válido, expirou ou já foi utilizado.");
      return;
    }
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) setError(friendlyAuthError(result.error));
    else setMessage("Senha atualizada com sucesso. Você já pode continuar.");
  }
  return (
    <AuthShell
      title={request ? "Recuperar senha" : "Criar nova senha"}
      description={
        request
          ? "Informe seu e-mail para receber um link seguro."
          : "Escolha uma nova senha para sua conta."
      }
    >
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        {request ? (
          <>
            <label htmlFor="recovery-email" className="block text-sm font-medium">
              E-mail
            </label>
            <input
              id="recovery-email"
              className={fieldClass}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </>
        ) : (
          <>
            <label htmlFor="new-password" className="block text-sm font-medium">
              Nova senha
            </label>
            <input
              id="new-password"
              className={fieldClass}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="confirm-password" className="block text-sm font-medium">
              Confirmar senha
            </label>
            <input
              id="confirm-password"
              className={fieldClass}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-muted">
            {message}
          </p>
        )}
        <Button size="lg" className="w-full" disabled={busy}>
          {busy ? "Aguarde…" : request ? "Enviar instruções" : "Atualizar senha"}
        </Button>
      </form>
      <Link to="/login" className="mt-4 flex min-h-11 items-center justify-center text-sm">
        Voltar para entrar
      </Link>
    </AuthShell>
  );
}
