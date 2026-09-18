import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, CreditCard, QrCode } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Mascot, STETH_LOOK } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { PLANS, planName } from "@/lib/plans";
import { playSound } from "@/lib/sound";
import { useDose } from "@/lib/store";
import { authEnabled } from "@/lib/auth/client";
import type { PlanId } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const navigate = useNavigate();
  const id = (plan ?? "yearly") as Exclude<PlanId, "free">;
  const meta = PLANS.find((p) => p.id === id) ?? PLANS[1];
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  const pixCode = useMemo(
    () => `00020126580014br.gov.bcb.pix0136dose+${id}@dose.app5204000053039865802BR5920DOSE MEDICINA LTDA6009SAO PAULO62070503***6304`,
    [id],
  );

  function finish() {
    // This screen remains a visual prototype. A configured production client
    // cannot create premium authority locally; a future payment webhook will
    // create the entitlement server-side.
    update(authEnabled ? { planScreenSeen: true } : { plan: id, planScreenSeen: true });
    setDone(true);
    playSound("success");
  }

  async function payCard(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const digits = number.replace(/\D/g, "");
    if (digits.length < 16) {
      setError("Número do cartão incompleto.");
      return;
    }
    if (!/^[A-Za-zÀ-ÿ' ]{3,}$/.test(holder.trim()) || !holder.trim().includes(" ")) {
      setError("Nome como está no cartão.");
      return;
    }
    const exp = expiry.replace(/\s/g, "");
    if (!/^\d{2}\/\d{2}$/.test(exp)) {
      setError("Validade no formato MM/AA.");
      return;
    }
    const [mm, yy] = exp.split("/").map(Number);
    if (!mm || mm < 1 || mm > 12) {
      setError("Mês de validade inválido.");
      return;
    }
    const now = new Date();
    const expDate = new Date(2000 + (yy ?? 0), mm, 1);
    if (expDate < now) {
      setError("Cartão vencido.");
      return;
    }
    if (cvv.replace(/\D/g, "").length < 3) {
      setError("CVV com 3 dígitos.");
      return;
    }
    setBusy(true);
    await wait(1100);
    setBusy(false);
    finish();
  }

  async function payPix() {
    setBusy(true);
    await wait(900);
    setBusy(false);
    finish();
  }

  const period =
    id === "weekly" ? t("plans.week") : id === "monthly" ? t("plans.month") : t("plans.installments");

  if (done) {
    return (
      <main className="flex h-full min-h-0 flex-col items-center justify-center bg-bg px-6 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal">Dose+</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Pagamento confirmado</h1>
        <p className="mt-2 max-w-[28ch] text-sm text-muted">
          {planName(id, locale)} ativo. 7 dias de teste, depois{" "}
          {id === "yearly" ? `${t("plans.installments")} ` : ""}
          R$ {meta.priceLabel}
          {id === "yearly" ? "" : period}.
        </p>
        <Button
          size="lg"
          className="mt-6 w-full"
          onClick={() => {
            playSound("tap");
            void navigate({ to: "/", replace: true });
          }}
        >
          Ir para a ronda
        </Button>
      </main>
    );
  }

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
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">{t("pay.why")}</p>
          <ul className="mt-2 space-y-1.5">
            {(["plans.b1", "plans.b2", "plans.b3"] as const).map((key) => (
              <li key={key} className="flex items-start gap-2 text-[13px] leading-snug">
                <Check className="mt-0.5 size-3.5 shrink-0 text-teal" strokeWidth={3} />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-card p-1">
          <MethodTab on={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard className="size-4" />} label="Cartão" />
          <MethodTab on={method === "pix"} onClick={() => setMethod("pix")} icon={<QrCode className="size-4" />} label="PIX" />
        </div>

        {method === "card" ? (
          <form className="space-y-3" onSubmit={(e) => void payCard(e)}>
            <Field label="Número do cartão">
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                value={number}
                onChange={(e) => setNumber(formatCard(e.target.value))}
                placeholder="ACCT-000003"
                className="field-input"
              />
            </Field>
            <Field label="Nome no cartão">
              <input
                autoComplete="cc-name"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="Como está gravado"
                className="field-input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Validade">
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/AA"
                  className="field-input"
                />
              </Field>
              <Field label="CVV">
                <input
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  className="field-input"
                />
              </Field>
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
            <Button size="lg" className="mt-2 w-full" type="submit" disabled={busy}>
              {busy ? "Autorizando…" : "Pagar e ativar Dose+"}
            </Button>
          </form>
        ) : (
          <div className="rounded-2xl bg-card px-4 py-5 text-center">
            <div className="mx-auto grid size-[168px] place-items-center rounded-2xl bg-white p-3">
              <PixMark />
            </div>
            <p className="mt-3 text-sm text-muted">Escaneie o QR ou copie o código.</p>
            <button
              type="button"
              className="mt-3 w-full break-all rounded-2xl bg-card-2 px-3 py-3 text-left font-mono text-[11px] text-muted"
              onClick={async () => {
                setPixCopied(false);
                try {
                  await navigator.clipboard.writeText(pixCode);
                  setPixCopied(true);
                } catch {
                  setError("Não foi possível copiar o código PIX neste navegador.");
                }
                playSound("tap");
              }}
            >
              {pixCode.slice(0, 72)}…
            </button>
            <p className="mt-2 min-h-4 text-[12px] text-teal" aria-live="polite">
              {pixCopied ? "Código PIX copiado." : ""}
            </p>
            {error && <p className="mt-1 text-[13px] text-danger" role="alert">{error}</p>}
            <Button size="lg" className="mt-4 w-full" onClick={() => void payPix()} disabled={busy}>
              {busy ? "Confirmando PIX…" : "Já paguei"}
            </Button>
          </div>
        )}
        <p className="mt-4 text-center text-[11px] leading-relaxed text-subtle">
          Pagamento processado neste aparelho para o preview. Na loja, cartão e PIX passam pelo adquirente.
        </p>
      </div>
    </main>
  );
}

function MethodTab({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium",
        on ? "tab-gradient text-on-accent" : "text-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function formatCard(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function PixMark() {
  return (
    <svg viewBox="0 0 120 120" className="size-full" aria-hidden>
      <rect width="120" height="120" fill="#fff" />
      {Array.from({ length: 12 }, (_, y) =>
        Array.from({ length: 12 }, (_, x) => {
          const on = ((x * 7 + y * 13) % 5) > 1 || x < 3 && y < 3 || x > 8 && y < 3 || x < 3 && y > 8;
          return on ? <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="8" height="8" fill="#121214" /> : null;
        }),
      )}
    </svg>
  );
}
