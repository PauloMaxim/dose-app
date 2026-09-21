import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  authConfirmationPath,
  parseAuthEmailAction,
  type AuthEmailAction,
} from "@/lib/auth/auth-flow";

export const Route = createFileRoute("/auth/action")({
  validateSearch: (search: Record<string, unknown>) => ({
    kind: typeof search.kind === "string" ? search.kind : undefined,
    token_hash: typeof search.token_hash === "string" ? search.token_hash : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
  }),
  component: AuthActionRoute,
});

const contentByType: Record<
  AuthEmailAction["type"],
  { title: string; description: string; button: string }
> = {
  signup: {
    title: "Confirmar meu e-mail",
    description: "Confirme seu endereço de e-mail para concluir seu cadastro na Dose.",
    button: "Confirmar meu e-mail",
  },
  recovery: {
    title: "Redefinir minha senha",
    description: "Continue para criar uma nova senha para sua conta.",
    button: "Continuar",
  },
  email_change: {
    title: "Confirmar alteração de e-mail",
    description: "Confirme a alteração para usar seu novo endereço de e-mail na Dose.",
    button: "Confirmar alteração",
  },
};

function continueInBrowser(path: string) {
  window.location.assign(path);
}

function AuthActionRoute() {
  const search = Route.useSearch();
  const params = new URLSearchParams();
  if (search.kind) params.set("kind", search.kind);
  if (search.token_hash) params.set("token_hash", search.token_hash);
  if (search.type) params.set("type", search.type);
  return <AuthAction search={`?${params.toString()}`} />;
}

export function AuthAction({
  search,
  onContinue = continueInBrowser,
}: {
  search: string;
  onContinue?: (path: string) => void;
}) {
  // Reading and validating the query is intentionally the only work performed
  // during render. Token verification belongs exclusively to /auth/confirm.
  const action = parseAuthEmailAction(search);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);

  if (!action) {
    return (
      <AuthShell
        title="Link inválido"
        description="Este link está incompleto ou não é compatível com esta ação. Solicite um novo e tente novamente."
      >
        <Link to="/login" className="flex min-h-11 items-center justify-center">
          Voltar para entrar
        </Link>
      </AuthShell>
    );
  }

  const content = contentByType[action.type];
  const confirmationPath = authConfirmationPath(action);
  function submit() {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    onContinue(confirmationPath);
  }

  return (
    <AuthShell title={content.title} description={content.description}>
      <Button type="button" size="lg" className="w-full" disabled={busy} onClick={submit}>
        {busy ? "Continuando…" : content.button}
      </Button>
      <Link to="/login" className="mt-3 flex min-h-11 items-center justify-center text-sm">
        Cancelar e voltar para entrar
      </Link>
    </AuthShell>
  );
}
