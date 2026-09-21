import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useContext, useState } from "react";
import { AuthShell, fieldClass } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { friendlyAuthError, safeReturnTo } from "@/lib/auth/auth-flow";
import { signInWithPassword } from "@/lib/auth/client";
import { useAppAccess } from "@/lib/auth/app-access-context";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthContext } from "@/lib/auth/context";

export const Route = createFileRoute("/login")({ component: Login });

export function Login() {
  const { user, isPending } = useCurrentUserState();
  const { recoveryPending } = useContext(AuthContext);
  const { remoteOnboarding } = useAppAccess();
  const navigate = useNavigate();
  const params =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const returnTo = safeReturnTo(params.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (recoveryPending) return <Navigate to="/auth/reset-password" replace />;
  if (isPending || (user && ["idle", "loading"].includes(remoteOnboarding)))
    return (
      <main className="grid h-full place-items-center bg-bg" aria-busy="true">
        <p role="status">Validando sua sessão…</p>
      </main>
    );
  if (user)
    return <Navigate to={remoteOnboarding === "complete" ? returnTo : "/onboarding"} replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (result.error) {
      setError(friendlyAuthError(result.error, "E-mail ou senha não conferem."));
      return;
    }
    // Do not guess onboarding state here. The protected root waits for the
    // authenticated remote profile and routes accordingly.
    void navigate({ to: "/", replace: true });
  }
  return (
    <AuthShell title="Entrar" description="Acesse sua Dose e continue de onde parou.">
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            className={fieldClass}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Senha
          </label>
          <input
            id="password"
            className={fieldClass}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        {error && (
          <p id="login-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </form>
      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        <Link
          to="/auth/reset-password"
          search={{ request: 1 }}
          className="min-h-11 py-3 text-muted"
        >
          Esqueci minha senha
        </Link>
        <Link to="/auth/signup" className="min-h-11 py-3 font-medium">
          Criar minha conta
        </Link>
      </div>
    </AuthShell>
  );
}
