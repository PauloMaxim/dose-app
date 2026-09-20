import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, fieldClass } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { friendlyAuthError, PASSWORD_MIN_LENGTH } from "@/lib/auth/auth-flow";
import { signUpWithPassword } from "@/lib/auth/client";
import { useDose } from "@/lib/store";
import { acceptCurrentLegalDocuments } from "@/server/domains/account";

export const Route = createFileRoute("/auth/signup")({ component: Signup });
function Signup() {
  const navigate = useNavigate();
  const profile = useDose((s) => s.profile);
  const draft = useDose((s) => s.onboardingDraftReady);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use uma senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const result = await signUpWithPassword(
      email.trim(),
      password,
      draft ? profile.name : undefined,
    );
    if (result.error) {
      setBusy(false);
      setError(friendlyAuthError(result.error, "Não foi possível criar a conta agora."));
      return;
    }
    if (result.needsConfirmation) {
      setBusy(false);
      sessionStorage.setItem("dose-auth-email", email.trim());
      void navigate({ to: "/auth/verify-email" });
      return;
    }
    try {
      await acceptCurrentLegalDocuments();
    } catch {
      setBusy(false);
      setError(
        "A conta foi criada, mas não foi possível registrar os documentos. Tente entrar novamente.",
      );
      return;
    }
    setBusy(false);
    void navigate({ to: "/onboarding", replace: true });
  }
  return (
    <AuthShell
      title="Criar minha conta"
      description="Salve sua seleção e mantenha suas preferências sincronizadas."
    >
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <Field id="signup-email" label="E-mail">
          <input
            id="signup-email"
            className={fieldClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field id="signup-password" label="Senha">
          <input
            id="signup-password"
            className={fieldClass}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">Pelo menos {PASSWORD_MIN_LENGTH} caracteres.</p>
        </Field>
        <Field id="signup-confirm" label="Confirmar senha">
          <input
            id="signup-confirm"
            className={fieldClass}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <button
          type="button"
          className="min-h-11 text-sm text-muted"
          onClick={() => setShow(!show)}
        >
          {show ? "Ocultar senhas" : "Mostrar senhas"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button size="lg" className="w-full" disabled={busy}>
          {busy ? "Criando…" : "Criar minha conta"}
        </Button>
      </form>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Ao criar sua conta, você concorda com os{" "}
        <Link to="/termos" className="underline">
          Termos de Uso
        </Link>{" "}
        e reconhece nossa{" "}
        <Link to="/privacidade" className="underline">
          Política de Privacidade
        </Link>
        .
      </p>
      <Link to="/login" className="mt-5 flex min-h-11 items-center justify-center text-sm">
        Já tenho uma conta
      </Link>
    </AuthShell>
  );
}
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
