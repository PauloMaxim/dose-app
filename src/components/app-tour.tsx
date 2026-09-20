import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { getTodayEdition } from "@/lib/content";
import { useAppAccess } from "@/lib/auth/app-access-context";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useDose } from "@/lib/store";

export function AppTour() {
  const { user } = useCurrentUserState();
  const { remoteOnboarding } = useAppAccess();
  const onboarded = useDose((s) => s.profile.onboardingComplete);
  const plansSeen = useDose((s) => s.profile.planScreenSeen);
  const done = useDose((s) => s.profile.tutorialComplete);
  const finish = useDose((s) => s.completeTutorial);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const editionId = getTodayEdition().id;
  const steps = useMemo(
    () => [
      {
        href: "/",
        target: "tour-header",
        title: "Aqui é você",
        line: "Nome, título e a engrenagem. Meta, aviso e sair ficam em Configurações.",
      },
      {
        href: "/",
        target: "tour-streak",
        title: "A ofensiva",
        line: "Cada dia com a edição lida acende um ponto. O hábito é a cadeia, não o recorde.",
      },
      {
        href: "/mascote",
        target: "tour-lumen",
        title: "Eu sou a Lúmen",
        line: "Quando você lê a dose, eu como. Roupa nova aparece conforme os artigos.",
      },
      {
        href: "/mascote",
        target: "tour-clothes",
        title: "O armário",
        line: "Toque numa peça. Bloqueadas mostram quantos artigos faltam. Premium pede assinatura.",
      },
      {
        href: `/edicao/${editionId}`,
        target: "tour-edition-page",
        title: "A edição de hoje",
        line: "Abre, lê os 10–15 minutos, volta amanhã. Esta é a ronda — o resto espera.",
      },
      {
        href: "/",
        target: "tour-goals",
        title: "Sua meta",
        line: "Os minutos que você escolheu. Cumpriu, eu fico satisfeita e a ofensiva segue.",
      },
      {
        href: "/dashboard",
        target: "tour-dash",
        title: "O dashboard",
        line: "Artigos, minutos e a semana. O número que cresce é o que vale.",
      },
      {
        href: "/artigos",
        target: "tour-lib",
        title: "A biblioteca",
        line: "Notas, salvos e catálogo. PMID, AND, OR — a mesma lógica de quem já procura paper.",
      },
      {
        href: "/artigos",
        target: "tour-catalog",
        title: "O catálogo",
        line: "Tudo o que a Dose já publicou. Salva o que quiser para ler depois.",
      },
      {
        href: "/perfil",
        target: "tour-wardrobe",
        title: "Seu perfil",
        line: "Atividade, salvos e o atalho para me vestir. A engrenagem fica no canto.",
      },
      {
        href: "/",
        target: "tour-nav",
        title: "Três portas",
        line: "Artigos, home e perfil. A edição do dia está sempre no meio.",
      },
    ],
    [editionId],
  );
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const step = steps[index];
  const active = Boolean(
    user && remoteOnboarding === "complete" && onboarded && plansSeen && !done && step,
  );

  useEffect(() => {
    if (!active || !step) return;
    if (pathname === step.href) return;
    if (step.href.startsWith("/edicao/")) {
      void navigate({
        to: "/edicao/$id",
        params: { id: editionId },
        search: { from: "home" },
      });
      return;
    }
    void navigate({ to: step.href as "/" });
  }, [active, index, pathname, step, navigate, editionId]);

  useEffect(() => {
    if (!active || !step || pathname !== step.href) return;

    function measure() {
      const host = rootRef.current;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!host || !el) return;
      el.scrollIntoView({ block: "center", inline: "nearest" });
      const hr = host.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const pad = 8;
      const x = Math.max(6, r.left - hr.left - pad);
      const y = Math.max(6, r.top - hr.top - pad);
      const w = Math.min(hr.width - x - 6, r.width + pad * 2);
      const h = Math.min(Math.min(hr.height - y - 6, r.height + pad * 2), 280);
      setHole({ x, y, w: Math.max(40, w), h: Math.max(40, h) });
    }

    measure();
    const t1 = window.setTimeout(measure, 80);
    const t2 = window.setTimeout(measure, 240);
    const t3 = window.setTimeout(measure, 480);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, pathname]);

  if (!active || !step) return null;

  const holeBottom = hole ? hole.y + hole.h : 120;
  const below = holeBottom + 176 < (rootRef.current?.clientHeight ?? 700);

  function close() {
    finish();
    if (pathname !== "/") void navigate({ to: "/" });
  }

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="dose-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx="16" fill="black" />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgb(9 9 11 / 0.78)" mask="url(#dose-tour-mask)" />
        {hole && (
          <rect
            x={hole.x}
            y={hole.y}
            width={hole.w}
            height={hole.h}
            rx="16"
            fill="none"
            stroke="#2EE6A6"
            strokeWidth="2"
          />
        )}
      </svg>
      <div
        className="absolute inset-x-4 z-[81] flex gap-3 rounded-2xl bg-card p-3 shadow-card"
        style={below ? { top: holeBottom + 12 } : { bottom: 16 }}
      >
        <Mascot mood="happy" streak={1} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-teal">Lúmen</p>
          <h2 id="tour-title" className="mt-0.5 text-[15px] font-semibold">
            {step.title}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{step.line}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (index >= steps.length - 1) close();
                else setIndex((i) => i + 1);
              }}
            >
              {index >= steps.length - 1 ? "Começar a ronda" : "Próximo"}
            </Button>
            <button type="button" className="h-9 px-2 text-xs text-subtle" onClick={() => close()}>
              Pular tutorial
            </button>
            <span className="ml-auto text-[11px] tabular-nums text-subtle">
              {index + 1}/{steps.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
