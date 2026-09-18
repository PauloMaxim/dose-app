import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import {
  authEnabled,
  getCurrentSession,
  GROK_PROVIDERS,
  requestPasswordReset,
  signIn,
  signInWithPassword,
  signUpWithPassword,
  updatePassword,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useDose } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const onboarded = useDose((s) => s.profile.onboardingComplete);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") === "reset") setMode("reset");
  }, []);

  if (isPending) {
    return (
      <main className="grid h-full place-items-center bg-bg">
        <p className="text-sm text-muted">Carregando sessão…</p>
      </main>
    );
  }

  if (user) {
    return <Navigate to={onboarded ? "/" : "/onboarding"} />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode !== "reset" && !email.includes("@")) {
      setError("Informe um email válido.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("Email válido e senha com pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    if (mode === "up") {
      const { error: err } = await signUpWithPassword(email.trim(), password, email.trim().split("@")[0] ?? "Colega");
      setBusy(false);
      if (err) {
        setError("Não deu para criar a conta. Tente outro email.");
        return;
      }
      if (!(await getCurrentSession())) {
        setError("Conta criada. Confirme seu email para entrar.");
        setMode("in");
        return;
      }
    } else if (mode === "forgot") {
      const { error: err } = await requestPasswordReset(email.trim());
      setBusy(false);
      setError(err ? "Não foi possível enviar o link de recuperação." : "Se o email existir, você receberá um link de recuperação.");
      return;
    } else if (mode === "reset") {
      const { error: err } = await updatePassword(password);
      setBusy(false);
      if (err) {
        setError("O link expirou ou a senha não pôde ser atualizada.");
        return;
      }
      setError("Senha atualizada. Você já pode continuar.");
    } else {
      const { error: err } = await signInWithPassword(email.trim(), password);
      setBusy(false);
      if (err) {
        setError("Email ou senha não conferem.");
        return;
      }
    }
    void navigate({ to: onboarded ? "/" : "/onboarding" });
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-y-auto bg-bg px-6 py-8">
      <div className="flex flex-1 flex-col items-center text-center">
        <Mascot mood="waiting" streak={0} size={96} />
        <h1 className="mt-4 text-[28px] font-semibold tracking-tight">
          {mode === "in" ? "Entrar no Dose" : mode === "up" ? "Criar sua conta" : mode === "forgot" ? "Recuperar senha" : "Criar nova senha"}
        </h1>
        <p className="mt-2 max-w-[32ch] text-sm text-muted">
          {mode === "in"
            ? "A edição de hoje espera. Entre para continuar a ronda."
            : mode === "up" ? "Email e senha guardam a sessão neste aparelho." : mode === "forgot" ? "Enviaremos um link seguro para seu email." : "Escolha uma nova senha para sua conta."}
        </p>
      </div>
      <form className="mt-6 space-y-3" onSubmit={(e) => void submit(e)}>
        <label className="sr-only" htmlFor="login-email">
          Email
        </label>
        {mode !== "reset" && <input id="login-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-12 w-full rounded-full bg-card px-5 text-sm outline-none placeholder:text-subtle" />}
        <label className="sr-only" htmlFor="login-pass">
          Senha
        </label>
        {mode !== "forgot" && <input
          id="login-pass"
          type="password"
          autoComplete={mode === "up" || mode === "reset" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha (mín. 8)"
          className="h-12 w-full rounded-full bg-card px-5 text-sm outline-none placeholder:text-subtle"
        />}
        {error && (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <Button size="lg" className="w-full" disabled={busy} type="submit">
          {busy ? "Aguarde…" : mode === "in" ? "Entrar" : mode === "up" ? "Criar conta" : mode === "forgot" ? "Enviar link" : "Atualizar senha"}
        </Button>
      </form>
      <button
        type="button"
        className="mt-3 h-11 text-sm text-muted"
        onClick={() => {
          setMode(mode === "in" ? "up" : "in");
          setError("");
        }}
      >
        {mode === "in" ? "Não tenho conta" : "Voltar para entrar"}
      </button>
      {mode === "in" && <button type="button" className="h-10 text-sm text-subtle" onClick={() => { setMode("forgot"); setError(""); }}>Esqueci minha senha</button>}
      {!authEnabled && <p className="mt-3 text-center text-xs text-muted" role="status">Autenticação ainda não configurada neste ambiente.</p>}
      {authEnabled && (
        <div className="mt-6 space-y-2">
          <p className="text-center text-[11px] uppercase tracking-wide text-subtle">ou</p>
          {GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              className={cn(
                "h-12 w-full rounded-full bg-card text-sm font-medium text-fg",
              )}
            >
              Continuar com {p.label}
            </button>
          ))}
        </div>
      )}
      <Link
        to={onboarded ? "/" : "/onboarding"}
        className="mt-6 mb-4 text-center text-sm text-subtle"
      >
        {onboarded ? "Voltar ao Dose" : "Voltar ao início"}
      </Link>
    </main>
  );
}
