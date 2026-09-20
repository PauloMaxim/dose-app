import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
import { legalReturnPath } from "@/lib/auth/auth-flow";
export const Route = createFileRoute("/termos")({ component: Terms });
function Terms() {
  const from =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("from");
  return (
    <AuthShell title="Termos de Uso" description="Versão técnica: 2026-09-20">
      <article className="space-y-4 text-sm leading-relaxed text-muted">
        <p>
          <strong className="text-fg">Conteúdo pendente de aprovação jurídica.</strong>
        </p>
        <p>
          Esta página reserva a superfície pública e o versionamento dos Termos de Uso da Dose. O
          texto jurídico definitivo será publicado após revisão especializada.
        </p>
        <p>
          Até essa aprovação, esta estrutura não pretende criar obrigações adicionais nem substituir
          orientação jurídica.
        </p>
      </article>
      <Link to={legalReturnPath(from)} className="mt-8 flex min-h-11 items-center justify-center">
        Voltar
      </Link>
    </AuthShell>
  );
}
