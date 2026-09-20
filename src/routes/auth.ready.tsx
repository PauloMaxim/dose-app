import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { useDose } from "@/lib/store";

export const Route = createFileRoute("/auth/ready")({ component: Ready });
function Ready() {
  const hydrated = useDose((s) => s.hydrated);
  const ready = useDose((s) => s.onboardingDraftReady);
  if (!hydrated)
    return (
      <main className="grid h-full place-items-center" aria-busy="true">
        Carregando…
      </main>
    );
  if (!ready) return <Navigate to="/onboarding" replace />;
  return (
    <AuthShell
      title="Sua Dose está pronta"
      description="Crie sua conta para salvar sua seleção, sincronizar preferências e acessar a Dose em outros dispositivos."
    >
      <div className="space-y-3">
        <Button asChild size="lg" className="w-full">
          <Link to="/auth/signup">Criar minha conta</Link>
        </Button>
        <Link
          to="/login"
          className="flex min-h-12 items-center justify-center rounded-xl bg-card text-sm font-medium"
        >
          Já tenho uma conta
        </Link>
      </div>
    </AuthShell>
  );
}
