import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Mascot, STETH_LOOK } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { destinationAfterPlan } from "@/lib/auth/app-access";
import { useAppAccess } from "@/lib/auth/app-access-context";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PLANS, planName } from "@/lib/plans";
import { playSound } from "@/lib/sound";
import { useDose } from "@/lib/store";
import type { PlanId } from "@/lib/types";

const searchSchema = z.object({
  plan: z.enum(["weekly", "monthly", "yearly"]).optional(),
});

export const Route = createFileRoute("/pagamento")({
  component: PagamentoPage,
  validateSearch: searchSchema,
});

function PagamentoPage() {
  const t = useT();
  const { plan } = Route.useSearch();
  const locale = useDose((s) => s.profile.locale);
  const update = useDose((s) => s.updateProfile);
  const { user } = useCurrentUserState();
  const { remoteOnboarding } = useAppAccess();
  const navigate = useNavigate();
  const id = (plan ?? "yearly") as Exclude<PlanId, "free">;
  const meta = PLANS.find((p) => p.id === id) ?? PLANS[1];
  const period =
    id === "weekly"
      ? t("plans.week")
      : id === "monthly"
        ? t("plans.month")
        : t("plans.installments");

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
      <header
        className="shrink-0 px-5 pb-3 pt-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          aria-label={t("pay.back")}
          className="flex size-11 items-center justify-center rounded-full bg-card text-fg"
          onClick={() => {
            playSound("tap");
            void navigate({ to: "/planos" });
          }}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="mt-2 flex items-center gap-3">
          <Mascot mood="waiting" streak={4} size={72} still look={STETH_LOOK} />
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight">{t("pay.title")}</h1>
            <p className="mt-1 text-sm text-muted">
              {planName(id, locale)} · {id === "yearly" ? `${t("plans.installments")} ` : ""}
              R$ {meta.priceLabel}
              {id === "yearly" ? "" : period}
            </p>
            <p className="mt-1 text-[12px] text-teal">{t("pay.soon")}</p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-5 pb-6">
        <div className="mb-4 rounded-2xl bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
            {t("pay.why")}
          </p>
          <ul className="mt-2 space-y-1.5">
            {(["plans.b1", "plans.b2", "plans.b3"] as const).map((key) => (
              <li key={key} className="flex items-start gap-2 text-[13px] leading-snug">
                <Check className="mt-0.5 size-3.5 shrink-0 text-teal" strokeWidth={3} />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-card px-5 py-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-teal/10 text-teal">
            <ShieldCheck className="size-6" />
          </div>
          <h2 className="mt-3 text-base font-semibold">Pagamentos ainda não disponíveis</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Este ambiente não realiza cobranças nem coleta dados de cartão. Quando ativado, o
            pagamento será processado por um provedor seguro e o acesso será confirmado pelo
            servidor.
          </p>
          <Button
            size="lg"
            className="mt-5 w-full"
            onClick={() => {
              update({ planScreenSeen: true });
              void navigate({
                to: destinationAfterPlan({
                  hasUser: Boolean(user),
                  remoteOnboardingComplete: remoteOnboarding === "complete",
                }),
                replace: true,
              });
            }}
          >
            Continuar no Free
          </Button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-subtle">
          Nenhum checkout, cobrança ou webhook financeiro real é executado neste ambiente.
        </p>
      </div>
    </main>
  );
}
