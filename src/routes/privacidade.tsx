import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
export const Route = createFileRoute("/privacidade")({ component: Privacy });
function Privacy() {
  return (
    <AuthShell title="Política de Privacidade" description="Versão técnica: 2026-09-20">
      <article className="space-y-4 text-sm leading-relaxed text-muted">
        <p>
          <strong className="text-fg">Conteúdo pendente de aprovação jurídica.</strong>
        </p>
        <p>
          Esta página reserva a superfície pública e o versionamento da Política de Privacidade da
          Dose. O texto jurídico definitivo será publicado após revisão especializada.
        </p>
        <p>
          A estrutura técnica distingue preferências do produto de consentimento de marketing;
          marketing não integra esta versão.
        </p>
      </article>
      <Link to="/auth/signup" className="mt-8 flex min-h-11 items-center justify-center">
        Voltar
      </Link>
    </AuthShell>
  );
}
