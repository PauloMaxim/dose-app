import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { Mascot, STETH_LOOK } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { destinationAfterPlan } from "@/lib/auth/app-access";
import { useAppAccess } from "@/lib/auth/app-access-context";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PLANS } from "@/lib/plans";
import { playSound } from "@/lib/sound";
import { useDose } from "@/lib/store";
import type { PlanId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Paywall Dose+. Skip ou pagamento bem-sucedido marcam planScreenSeen. */

export const Route = createFileRoute("/planos")({
  component: PlanosPage,
});

const BENEFITS = ["plans.b1", "plans.b2", "plans.b3", "plans.b4", "plans.b5"] as const;

function PlanosPage() {
  const t = useT();
  const navigate = useNavigate();
  const update = useDose((s) => s.updateProfile);
  const { user } = useCurrentUserState();
  const { remoteOnboarding } = useAppAccess();
  const [picked, setPicked] = useState<Exclude<PlanId, "free">>("yearly");
  const [landed, setLanded] = useState(false);

  function skip() {
    playSound("tap");
    update({ planScreenSeen: true });
    void navigate({
      to: destinationAfterPlan({
        hasUser: Boolean(user),
        remoteOnboardingComplete: remoteOnboarding === "complete",
      }),
      replace: true,
    });
  }

  function goPay() {
    playSound("whoosh");
    void navigate({ to: "/pagamento", search: { plan: picked } });
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
      <section className="pay-sky relative flex min-h-0 flex-1 flex-col items-center overflow-hidden px-5 pt-8">
        <Clouds />
        <p className="pay-fade relative z-[1] text-[11px] font-medium uppercase tracking-[0.18em] text-teal">
          {t("plans.kicker")}
        </p>
        <h1 className="pay-fade relative z-[1] mt-1.5 max-w-[16ch] text-center text-[24px] font-semibold leading-tight tracking-tight text-white">
          {t("plans.title")}
        </h1>
        <div className="pay-fade relative z-[1] mt-3 max-w-[24ch] rounded-2xl rounded-br-md bg-white px-3.5 py-2 text-center text-[13px] font-medium leading-snug text-ink shadow-sm">
          {t("plans.bubble")}
        </div>
        <div
          className="pay-bird-arrive relative z-[1] mt-1"
          onAnimationEnd={(e) => {
            if (e.animationName.includes("bird-arrive")) setLanded(true);
          }}
        >
          <Mascot mood="waiting" streak={4} size={132} still={landed} look={STETH_LOOK} />
        </div>
      </section>

      <section className="pay-sheet relative z-[2] flex shrink-0 flex-col rounded-t-[28px] bg-bg px-5 pb-5 pt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">
          {t("plans.why")}
        </p>
        <ul className="mb-3 space-y-1.5">
          {BENEFITS.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-[13px] leading-snug text-fg">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal/15 text-teal">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
        <div className="space-y-1.5" role="radiogroup" aria-label="Escolha do plano">
          {PLANS.map((p) => {
            const on = picked === p.id;
            const yearly = p.id === "yearly";
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  playSound("tap");
                  setPicked(p.id);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-shadow",
                  on ? "bg-card ring-2 ring-teal shadow-card" : "bg-card ring-1 ring-border",
                )}
              >
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full ring-2",
                    on ? "ring-teal" : "ring-subtle",
                  )}
                >
                  {on && <span className="size-2.5 rounded-full bg-teal" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {p.id === "weekly"
                      ? t("plans.weekly")
                      : p.id === "monthly"
                        ? t("plans.monthly")
                        : t("plans.yearly")}
                    {yearly && (
                      <span className="ml-2 rounded-full tab-gradient px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-on-accent">
                        {t("plans.best")}
                      </span>
                    )}
                  </p>
                  {yearly && <p className="mt-0.5 text-[11px] text-teal">{t("plans.save")}</p>}
                </div>
                <div className="text-right">
                  {yearly ? (
                    <>
                      <p className="text-[11px] text-muted">{t("plans.installments")}</p>
                      <p className="text-lg font-semibold tabular-nums leading-none">
                        R$ {p.priceLabel}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold tabular-nums leading-none">
                        R$ {p.priceLabel}
                      </p>
                      <p className="text-[11px] text-muted">
                        {p.id === "weekly" ? t("plans.week") : t("plans.month")}
                      </p>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-center text-[11px] leading-snug text-subtle">
          {t("plans.cancel")}
        </p>
        <Button size="lg" className="mt-2.5 w-full" onClick={goPay}>
          {t("plans.cta")}
        </Button>
        <button type="button" className="mt-1 h-10 text-sm text-muted" onClick={skip}>
          {t("plans.skip")}
        </button>
      </section>
    </main>
  );
}

function Clouds() {
  return (
    <>
      <svg
        className="pay-cloud-left pointer-events-none absolute -left-8 bottom-0 h-40 w-[80%]"
        viewBox="0 0 280 150"
        aria-hidden
      >
        <ellipse cx="40" cy="130" rx="90" ry="44" fill="#f7fbff" />
        <ellipse cx="150" cy="124" rx="110" ry="52" fill="#fff" />
        <ellipse cx="70" cy="118" rx="70" ry="36" fill="#eef8f6" />
      </svg>
      <svg
        className="pay-cloud-right pointer-events-none absolute -right-10 bottom-0 h-40 w-[80%]"
        viewBox="0 0 280 150"
        aria-hidden
      >
        <ellipse cx="220" cy="132" rx="100" ry="46" fill="#fff" />
        <ellipse cx="120" cy="126" rx="90" ry="42" fill="#eef8f6" />
        <ellipse cx="40" cy="136" rx="70" ry="34" fill="#f7fbff" />
      </svg>
    </>
  );
}
