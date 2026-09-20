import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useRef, useState } from "react";
import { AuthShell, fieldClass } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { friendlyAuthError, isAcceptableEmail, PASSWORD_MIN_LENGTH } from "@/lib/auth/auth-flow";
import { signUpWithPassword } from "@/lib/auth/client";
import { useDose } from "@/lib/store";
import { acceptCurrentLegalDocuments } from "@/server/domains/account";

export const Route = createFileRoute("/auth/signup")({ component: Signup });
export function Signup() {
  const navigate = useNavigate();
  const profile = useDose((s) => s.profile);
  const draft = useDose((s) => s.onboardingDraftReady);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    setError("");
    const trimmedEmail = email.trim();
    const nextErrors = {
      email: !trimmedEmail
        ? "Informe seu e-mail."
        : !isAcceptableEmail(trimmedEmail)
          ? "Informe um e-mail válido."
          : "",
      password: !password
        ? "Informe uma senha."
        : password.length < PASSWORD_MIN_LENGTH
          ? `Use uma senha com pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
          : "",
      confirm: !confirm
        ? "Confirme sua senha."
        : password !== confirm
          ? "As senhas não coincidem."
          : "",
    };
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    busyRef.current = true;
    setBusy(true);
    const result = await signUpWithPassword(
      trimmedEmail,
      password,
      draft ? profile.name : undefined,
    );
    if (result.error) {
      busyRef.current = false;
      setBusy(false);
      setError(friendlyAuthError(result.error, "Não foi possível criar a conta agora."));
      return;
    }
    if (result.needsConfirmation) {
      sessionStorage.setItem("dose-auth-email", trimmedEmail);
      void navigate({ to: "/auth/verify-email" });
      return;
    }
    try {
      await acceptCurrentLegalDocuments();
    } catch {
      busyRef.current = false;
      setBusy(false);
      setError(
        "A conta foi criada, mas não foi possível registrar os documentos. Tente entrar novamente.",
      );
      return;
    }
    void navigate({ to: "/onboarding", replace: true });
  }
  return (
    <AuthShell
      title="Criar minha conta"
      description="Salve sua seleção e mantenha suas preferências sincronizadas."
    >
      <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
        <Field id="signup-email" label="E-mail">
          <input
            id="signup-email"
            className={fieldClass}
            type="email"
            autoComplete="email"
            required
            value={email}
            aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: "" }));
            }}
          />
          <FieldError id="signup-email-error" message={fieldErrors.email} />
        </Field>
        <Field id="signup-password" label="Senha">
          <PasswordInput
            id="signup-password"
            label="senha"
            value={password}
            visible={showPassword}
            error={fieldErrors.password}
            onVisibilityChange={() => setShowPassword((current) => !current)}
            onChange={(value) => {
              setPassword(value);
              if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: "" }));
              if (confirm)
                setFieldErrors((current) => ({
                  ...current,
                  confirm: value === confirm ? "" : "As senhas não coincidem.",
                }));
            }}
          />
          <p className="mt-1 text-xs text-muted">Pelo menos {PASSWORD_MIN_LENGTH} caracteres.</p>
          <FieldError id="signup-password-error" message={fieldErrors.password} />
        </Field>
        <Field id="signup-confirm" label="Confirmar senha">
          <PasswordInput
            id="signup-confirm"
            label="confirmação de senha"
            value={confirm}
            visible={showConfirm}
            error={fieldErrors.confirm}
            onVisibilityChange={() => setShowConfirm((current) => !current)}
            onChange={(value) => {
              setConfirm(value);
              setFieldErrors((current) => ({
                ...current,
                confirm: value && value !== password ? "As senhas não coincidem." : "",
              }));
            }}
          />
          <FieldError id="signup-confirm-error" message={fieldErrors.confirm} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Criando…" : "Criar minha conta"}
        </Button>
      </form>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Ao criar sua conta, você concorda com os{" "}
        <Link to="/termos" search={{ from: "signup" } as never} className="underline">
          Termos de Uso
        </Link>{" "}
        e reconhece nossa{" "}
        <Link to="/privacidade" search={{ from: "signup" } as never} className="underline">
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

function PasswordInput({
  id,
  label,
  value,
  visible,
  error,
  onChange,
  onVisibilityChange,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  error: string;
  onChange: (value: string) => void;
  onVisibilityChange: () => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        className={`${fieldClass} pr-12`}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        required
        value={value}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex min-h-11 min-w-11 items-center justify-center text-muted"
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label}`}
          onClick={onVisibilityChange}
        >
          {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
        </button>
      )}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string }) {
  return message ? (
    <p id={id} className="mt-1 text-xs text-danger">
      {message}
    </p>
  ) : null;
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
