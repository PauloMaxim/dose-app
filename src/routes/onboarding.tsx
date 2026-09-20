import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mascot } from "@/components/mascot";
import { formatClock, TimePicker } from "@/components/time-picker";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useAppAccess } from "@/lib/auth/app-access-context";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SPECIALTIES, TOPIC_OPTIONS } from "@/lib/content";
import type { ScientificCatalog } from "@/lib/scientific-catalog";
import { useDose } from "@/lib/store";
import type { Specialty, TitlePrefix } from "@/lib/types";
import { cn, slugUsername } from "@/lib/utils";
import { readScientificCatalog } from "@/server/domains/catalog";
import { completeMyOnboarding, readMyInterests } from "@/server/domains/user-data";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const LAST = 8;
const GOALS = [5, 10, 15, 20];
const HABITS = [
  "Sim, leio artigos com frequência",
  "Leio de vez em quando",
  "Faz tempo que não leio",
];
const BLOCKS = [
  "Perco o foco em poucos minutos",
  "Cansaço no fim do dia",
  "Nunca sei o que ler depois",
  "Falta de tempo",
];
const TIMES: Array<{ label: string; hour: number | null }> = [
  { label: "De manhã cedo", hour: 7 },
  { label: "No horário do almoço", hour: 12 },
  { label: "No fim da tarde", hour: 18 },
  { label: "Antes de dormir", hour: 21 },
  { label: "Não tenho horário fixo", hour: null },
];

function Onboarding() {
  const navigate = useNavigate();
  const { user, isPending: sessionPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const { remoteOnboarding, refreshRemoteProfile } = useAppAccess();
  const hydrated = useDose((s) => s.hydrated);
  const saveDraft = useDose((s) => s.saveOnboardingDraft);
  const update = useDose((s) => s.updateProfile);
  const setStep = useDose((s) => s.setOnboardingStep);
  const setReminderHour = useDose((s) => s.setReminderHour);
  const profile = useDose((s) => s.profile);
  const draftReady = useDose((s) => s.onboardingDraftReady);
  const returning = remoteOnboarding === "complete";
  const rawStep = useDose((s) => s.onboardingStep);
  const step = Math.min(LAST, rawStep);
  const [name, setName] = useState(profile.name === "Marina" ? "" : profile.name);
  const [title, setTitle] = useState<TitlePrefix>(profile.title);
  const [specialty, setSpecialty] = useState<Specialty>(profile.specialty);
  const [catalog, setCatalog] = useState<ScientificCatalog | null>(null);
  const [specialtyId, setSpecialtyId] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [habit, setHabit] = useState("");
  const [block, setBlock] = useState("");
  const [goal, setGoal] = useState(
    GOALS.includes(profile.dailyGoalMin) ? profile.dailyGoalMin : 15,
  );
  const [hour, setHour] = useState<number | null>(profile.reminderHour);
  const [minute, setMinute] = useState(profile.reminderMinute || 0);
  const [timeLabel, setTimeLabel] = useState("");
  const [demoOn, setDemoOn] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [permError, setPermError] = useState("");
  const touchX = useRef<number | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const [paneW, setPaneW] = useState(390);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const apply = () => setPaneW(el.clientWidth || 390);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    track("onboarding_view", { step });
  }, [hydrated, step]);

  useEffect(() => {
    if (!hydrated || !userId) return;
    if (catalog) return;
    let current = true;
    Promise.all([readScientificCatalog(), readMyInterests()])
      .then(([nextCatalog, interests]) => {
        if (!current) return;
        if (!nextCatalog.specialties.length) throw new Error("empty catalog");
        setCatalog(nextCatalog);
        const remoteSpecialty = interests.find((x) => x.specialty_id)?.specialty_id ?? "";
        const draftSpecialty =
          nextCatalog.specialties.find((x) => x.name === profile.specialty)?.id ?? "";
        setSpecialtyId(remoteSpecialty || (draftReady ? draftSpecialty : ""));
        const remoteTopics = interests.flatMap((x) => (x.topic_id ? [x.topic_id] : []));
        setTopicIds(
          remoteTopics.length || !draftReady
            ? remoteTopics
            : nextCatalog.topics.filter((x) => profile.topics.includes(x.name)).map((x) => x.id),
        );
        const remoteName = nextCatalog.specialties.find((x) => x.id === remoteSpecialty)?.name;
        if (remoteName && SPECIALTIES.includes(remoteName as Specialty))
          setSpecialty(remoteName as Specialty);
      })
      .catch(
        () =>
          current && setCatalogError("Catálogo indisponível. Tente novamente antes de concluir."),
      );
    return () => {
      current = false;
    };
  }, [catalog, draftReady, hydrated, profile.specialty, profile.topics, userId]);

  useEffect(() => {
    if (hydrated && returning) void navigate({ to: "/", replace: true });
  }, [hydrated, navigate, returning]);

  useEffect(() => {
    if (
      !hydrated ||
      !userId ||
      remoteOnboarding !== "incomplete" ||
      !draftReady ||
      !profile.planScreenSeen ||
      !catalog ||
      !specialtyId ||
      saving
    )
      return;
    void finishOnboarding(true);
    // finishOnboarding intentionally runs only once after all authoritative
    // inputs for a fresh, explicitly completed visitor draft are available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    catalog,
    draftReady,
    hydrated,
    profile.planScreenSeen,
    remoteOnboarding,
    saving,
    specialtyId,
    userId,
  ]);

  function go(next: number) {
    setStep(Math.max(0, Math.min(LAST, next)));
  }

  async function finishOnboarding(resumingAfterPlan = false) {
    setPermError("");
    if (user) {
      if (!catalog || !specialtyId) {
        setPermError(catalogError || "Escolha sua área principal antes de concluir.");
        go(6);
        return;
      }
      setSaving(true);
      try {
        await completeMyOnboarding({
          data: {
            displayName: name.trim() || "Colega",
            locale: profile.locale === "en" ? "en" : "pt-BR",
            specialtyId,
            topicIds,
          },
        });
        const remotelyComplete = await refreshRemoteProfile();
        if (!remotelyComplete) throw new Error("Não foi possível confirmar seu perfil salvo.");
      } catch (error) {
        setPermError(
          error instanceof Error ? error.message : "Não foi possível salvar seus interesses.",
        );
        setSaving(false);
        return;
      }
      setSaving(false);
      update({
        name: name.trim() || profile.name || "Colega",
        title,
        specialty,
        topics: catalog.topics.filter((x) => topicIds.includes(x.id)).map((x) => x.name),
        dailyGoalMin: goal,
        weeklyGoalMin: goal * 6,
        reminderHour: hour,
        reminderMinute: hour == null ? 0 : minute,
        tutorialComplete: false,
        username: name.trim() ? slugUsername(name.trim()) : profile.username || "dose",
      });
      track("onboarding_complete", { dest: resumingAfterPlan ? "home" : "planos" });
      void navigate({ to: resumingAfterPlan ? "/" : "/planos", replace: true });
      return;
    }
    saveDraft({
      name: name.trim() || "Colega",
      title,
      specialty,
      topics: catalog
        ? catalog.topics.filter((x) => topicIds.includes(x.id)).map((x) => x.name)
        : [],
      dailyGoalMin: goal,
      weeklyGoalMin: goal * 6,
      reminderHour: hour,
      reminderMinute: hour == null ? 0 : minute,
      tutorialComplete: false,
      username: name.trim() ? slugUsername(name.trim()) : "dose",
      planScreenSeen: false,
    });
    track("onboarding_complete", { dest: "planos" });
    void navigate({ to: "/planos", replace: true });
  }

  async function continueReminder() {
    setPermError("");
    setReminderHour(hour, hour == null ? 0 : minute);
    update({ reminderHour: hour, reminderMinute: hour == null ? 0 : minute });
    if (hour != null && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        track("onboarding_reminder_prompt");
        try {
          const result = await Notification.requestPermission();
          track("onboarding_reminder_result", { result });
          if (result !== "granted") {
            setPermError(
              "Sem permissão o aviso não chega. Você pode ligar depois em Configurações.",
            );
          }
        } catch {
          setPermError("Este aparelho não entrega aviso em segundo plano.");
        }
      } else if (Notification.permission === "denied") {
        setPermError("O aviso está bloqueado no sistema. Siga sem ele por agora.");
      }
    }
    track("onboarding_continue", { step: LAST, hour: hour ?? -1 });
    await finishOnboarding();
  }

  if (!hydrated || sessionPending || (user && remoteOnboarding === "loading")) {
    return (
      <div className="flex h-full items-center justify-center bg-bg" aria-busy="true">
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    );
  }

  if (user && draftReady && profile.planScreenSeen && permError) {
    return (
      <main className="flex h-full flex-col items-center justify-center bg-bg px-6 text-center">
        <Mascot mood="waiting" streak={0} size={112} />
        <h1 className="mt-5 text-[24px] font-semibold">Seu draft continua salvo</h1>
        <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-muted" role="alert">
          {permError}
        </p>
        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={saving}
          onClick={() => void finishOnboarding(true)}
        >
          {saving ? "Tentando novamente…" : "Tentar salvar novamente"}
        </Button>
      </main>
    );
  }

  const yearHours = Math.round((goal * 365) / 60);

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-bg"
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start == null || end == null) return;
        if (end - start > 64 && step > 0) go(step - 1);
      }}
    >
      {step > 0 && (
        <header
          className="flex items-center gap-3 px-5 pb-2 pt-3"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => go(step - 1)}
            className="text-sm text-muted"
          >
            Voltar
          </button>
          <div
            className="flex flex-1 gap-1.5"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={LAST}
            aria-valuenow={step}
            aria-label={`Passo ${step} de ${LAST}`}
          >
            {Array.from({ length: LAST }, (_, i) => (
              <span
                key={i}
                className={cn("h-1 flex-1 rounded-full", i < step ? "tab-gradient" : "bg-card")}
              />
            ))}
          </div>
          {step === 1 && (
            <button
              type="button"
              className="text-xs font-medium text-subtle"
              onClick={() => {
                track("onboarding_skip", { step: 1 });
                update({ name: "Colega", title });
                go(2);
              }}
            >
              Pular
            </button>
          )}
        </header>
      )}

      <div ref={viewRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{
            width: (LAST + 1) * paneW,
            transform: `translate3d(-${step * paneW}px,0,0)`,
          }}
        >
          <Pane width={paneW} active={step === 0}>
            <SplashBg />
            <div className="relative z-10 flex flex-1 flex-col">
              <div className="flex flex-1 flex-col items-center justify-end pb-4 text-center">
                <Mascot mood="waiting" streak={0} size={148} />
                <h1 className="mt-5 text-[32px] font-semibold leading-tight tracking-tight">
                  Cada paper.
                  <br />
                  Cada ronda.
                  <br />
                  Juntos.
                </h1>
                <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-muted">
                  Uma edição por dia. Papers reais, PMID na ponta.
                </p>
              </div>
              {authEnabled && (
                <div className="mb-4 flex justify-center gap-3">
                  {GROK_PROVIDERS.map((p) => (
                    <button
                      key={p.providerId}
                      type="button"
                      aria-label={`Continuar com ${p.label}`}
                      onClick={() => {
                        track("onboarding_continue", { step: 0, idp: p.idp });
                        void signIn(p.providerId, { callbackURL: "/onboarding" });
                      }}
                      className="flex size-14 items-center justify-center rounded-full bg-card"
                    >
                      {p.idp === "google" ? <GoogleMark /> : <XMark />}
                    </button>
                  ))}
                </div>
              )}
              <Button
                size="lg"
                className="relative z-10 w-full"
                onClick={() => {
                  track("onboarding_continue", { step: 0, returning });
                  if (returning || draftReady) {
                    void navigate({ to: returning ? "/" : "/planos" });
                    return;
                  }
                  go(1);
                }}
              >
                {returning ? "Continuar no Dose" : draftReady ? "Continuar" : "Começar"}
              </Button>
              <Link
                to="/login"
                className="relative z-10 mt-2 flex h-11 items-center justify-center text-sm text-muted"
              >
                {returning ? "Usar outro email" : "Entrar ou criar conta"}
              </Link>
            </div>
          </Pane>

          <Pane width={paneW} active={step === 1}>
            <h1 className="text-[28px] font-semibold tracking-tight">Como te chamamos?</h1>
            <p className="mt-2 text-sm text-muted">
              A saudação da home usa título e nome. Dá para mudar depois.
            </p>
            <div className="mt-6 flex gap-2" role="group" aria-label="Título">
              {(["Dra.", "Dr."] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={title === t}
                  onClick={() => setTitle(t)}
                  className={cn(
                    "h-11 flex-1 rounded-full text-sm font-semibold",
                    title === t ? "tab-gradient text-on-accent" : "bg-card text-muted",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <label htmlFor="onb-name" className="sr-only">
              Seu nome
            </label>
            <input
              id="onb-name"
              value={name}
              autoComplete="given-name"
              autoCapitalize="words"
              aria-invalid={nameError}
              aria-describedby={nameError ? "onb-name-error" : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
              onBlur={() => {
                const next = name.trim();
                if (next.length >= 2) update({ name: next, title });
              }}
              placeholder="Seu nome"
              className="mt-4 h-12 rounded-full bg-card px-5 text-sm text-fg outline-none placeholder:text-subtle"
            />
            {nameError && (
              <p id="onb-name-error" className="mt-2 text-xs text-danger" role="alert">
                Escreva o nome que aparece na saudação, ou pule esta etapa.
              </p>
            )}
            <div className="flex-1" />
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                const next = name.trim();
                if (next.length < 2) {
                  setNameError(true);
                  return;
                }
                update({ name: next, title });
                track("onboarding_continue", { step: 1 });
                go(2);
              }}
            >
              Continuar
            </Button>
          </Pane>

          <Pane width={paneW} active={step === 2}>
            <h1 className="text-[28px] font-semibold tracking-tight">
              Você lê artigos com regularidade?
            </h1>
            <p className="mt-2 text-sm text-muted">
              Não existe resposta certa. Só queremos saber por onde começar.
            </p>
            <div className="mt-6 space-y-2">
              {HABITS.map((h) => (
                <Option key={h} on={habit === h} onClick={() => setHabit(h)}>
                  {h}
                </Option>
              ))}
            </div>
            <div className="flex-1" />
            <Button
              size="lg"
              className="w-full"
              disabled={!habit}
              onClick={() => {
                track("onboarding_continue", { step: 2, habit });
                go(3);
              }}
            >
              Continuar
            </Button>
          </Pane>

          <Pane width={paneW} active={step === 3}>
            <h1 className="text-[28px] font-semibold tracking-tight">
              O que mais pesa na hora de ler?
            </h1>
            <p className="mt-2 text-sm text-muted">
              Escolhe o que mais te descreve. O ritmo da dose se ajusta depois.
            </p>
            <div className="mt-6 space-y-2">
              {BLOCKS.map((b) => (
                <Option key={b} on={block === b} onClick={() => setBlock(b)}>
                  {b}
                </Option>
              ))}
            </div>
            <div className="flex-1" />
            <Button
              size="lg"
              className="w-full"
              disabled={!block}
              onClick={() => {
                track("onboarding_continue", { step: 3, block });
                go(4);
              }}
            >
              Continuar
            </Button>
          </Pane>

          <Pane width={paneW} active={step === 4}>
            <h1 className="text-[28px] font-semibold tracking-tight">
              Qual a melhor hora do dia para você ler?
            </h1>
            <p className="mt-2 text-sm text-muted">
              O aviso da edição entra nesse horário — um toque, sem encheção.
            </p>
            <div className="mt-6 space-y-2">
              {TIMES.map((t) => (
                <Option
                  key={t.label}
                  on={timeLabel === t.label}
                  onClick={() => {
                    setTimeLabel(t.label);
                    setHour(t.hour);
                    setMinute(0);
                  }}
                >
                  {t.label}
                </Option>
              ))}
            </div>
            <div className="flex-1" />
            <Button
              size="lg"
              className="w-full"
              disabled={!timeLabel}
              onClick={() => {
                setReminderHour(hour, 0);
                track("onboarding_continue", { step: 4, hour: hour ?? -1 });
                go(5);
              }}
            >
              Continuar
            </Button>
          </Pane>

          <Pane width={paneW} active={step === 5}>
            <h1 className="text-[28px] font-semibold tracking-tight">Meta diária</h1>
            <p className="mt-2 text-sm text-muted">
              Quantos minutos por dia. A Lúmen come quando você cumpre. Dá para mudar depois.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={goal === g}
                  onClick={() => {
                    setGoal(g);
                    update({ dailyGoalMin: g, weeklyGoalMin: g * 6 });
                  }}
                  className={cn(
                    "rounded-2xl py-6 text-center",
                    goal === g ? "tab-gradient text-on-accent" : "bg-card text-fg",
                  )}
                >
                  <span className="text-3xl font-semibold tabular-nums">{g}</span>
                  <span className="mt-1 block text-xs opacity-80">minutos</span>
                </button>
              ))}
            </div>
            <p className="mt-5 text-center text-sm leading-relaxed text-muted">
              {goal} minutos por dia são cerca de{" "}
              <span className="font-semibold text-teal">{yearHours} horas</span> de evidência em um
              ano.
            </p>
            <div className="flex-1" />
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                update({ dailyGoalMin: goal, weeklyGoalMin: goal * 6 });
                track("onboarding_continue", { step: 5, goal });
                go(6);
              }}
            >
              Continuar
            </Button>
          </Pane>

          <Pane width={paneW} active={step === 6}>
            <h1 className="text-[28px] font-semibold tracking-tight">Sua lente clínica</h1>
            <p className="mt-2 text-sm text-muted">
              A edição do dia é a mesma para todos. A especialidade só ordena o catálogo.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {(catalog?.specialties ?? SPECIALTIES.map((name) => ({ id: name, name }))).map(
                (s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={catalog ? specialtyId === s.id : specialty === s.name}
                    onClick={() => {
                      setSpecialty(s.name as Specialty);
                      if (catalog) setSpecialtyId(s.id);
                      update({ specialty: s.name as Specialty });
                    }}
                    className={cn(
                      "h-11 rounded-full px-4 text-sm font-medium",
                      (catalog ? specialtyId === s.id : specialty === s.name)
                        ? "tab-gradient text-on-accent"
                        : "bg-card text-muted",
                    )}
                  >
                    {s.name}
                  </button>
                ),
              )}
            </div>
            <h2 className="mt-5 text-sm font-semibold">Interesses</h2>
            <p className="mt-1 text-xs text-muted">
              Selecione quantos quiser, inclusive temas transversais.
            </p>
            <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {[
                ...(catalog?.topics ??
                  TOPIC_OPTIONS.map((name) => ({ id: name, name, specialtyId: null }))),
              ]
                .sort(
                  (a, b) =>
                    Number(b.specialtyId === specialtyId) - Number(a.specialtyId === specialtyId),
                )
                .map((topic) => {
                  const on = catalog
                    ? topicIds.includes(topic.id)
                    : profile.topics.includes(topic.name);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        catalog &&
                        setTopicIds((ids) =>
                          ids.includes(topic.id)
                            ? ids.filter((id) => id !== topic.id)
                            : [...ids, topic.id],
                        )
                      }
                      className={cn(
                        "min-h-10 rounded-full px-3 text-xs font-medium",
                        on ? "tab-gradient text-on-accent" : "bg-card text-muted",
                      )}
                    >
                      {topic.name}
                    </button>
                  );
                })}
            </div>
            {catalogError && (
              <p className="mt-2 text-xs text-danger" role="alert">
                {catalogError}
              </p>
            )}
            <div className="flex-1" />
            <Button
              size="lg"
              className="w-full"
              disabled={Boolean(user && (!catalog || !specialtyId))}
              onClick={() => {
                update({ specialty });
                track("onboarding_continue", { step: 6, specialty });
                go(7);
              }}
            >
              Continuar
            </Button>
          </Pane>

          <Pane width={paneW} active={step === 7}>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Mascot
                mood={demoOn ? "happy" : "hungry"}
                streak={demoOn ? 3 : 0}
                size={168}
                fed={demoOn}
              />
              <h1 className="mt-5 text-[28px] font-semibold tracking-tight">
                {demoOn ? "Você leu. Ela comeu." : "A Lúmen come quando você lê"}
              </h1>
              <p className="mt-3 max-w-[32ch] text-sm leading-relaxed text-muted">
                {demoOn
                  ? "Cada artigo da edição é um bocado. Meta cumprida, ela fica satisfeita — e a ofensiva segue."
                  : "Não é um mascote parado. A ronda alimenta ela. Toque para ver."}
              </p>
            </div>
            {!demoOn ? (
              <Button size="lg" className="w-full" onClick={() => setDemoOn(true)}>
                Ver como funciona
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  track("onboarding_continue", { step: 7 });
                  go(8);
                }}
              >
                Continuar
              </Button>
            )}
          </Pane>

          <Pane width={paneW} active={step === 8}>
            <div className="rounded-2xl bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg tab-gradient text-xs font-bold text-on-accent">
                    D
                  </span>
                  <div>
                    <p className="text-xs font-semibold">Dose</p>
                    <p className="text-[11px] text-muted">A edição de hoje ainda está aberta.</p>
                  </div>
                </div>
                <span className="text-[11px] tabular-nums text-subtle">
                  {formatClock(hour ?? 12, minute)}
                </span>
              </div>
            </div>
            <h1 className="mt-6 text-[28px] font-semibold tracking-tight">Um toque por dia</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {hour != null
                ? "Ajuste a hora e o minuto se quiser. Só o lembrete da edição — sem encheção."
                : "Escolha a hora e o minuto, ou siga sem aviso."}
            </p>
            <div className="mt-5">
              <TimePicker
                hour={hour ?? 12}
                minute={minute}
                onChange={(h, m) => {
                  setHour(h);
                  setMinute(m);
                }}
              />
            </div>
            {permError && (
              <p className="mt-3 text-xs text-danger" role="alert">
                {permError}
              </p>
            )}
            <div className="flex-1" />
            <Button
              size="lg"
              className="w-full"
              disabled={saving}
              onClick={() => void continueReminder()}
            >
              {hour == null ? "Ir para a home" : `Ativar lembrete às ${formatClock(hour, minute)}`}
            </Button>
            <button
              type="button"
              className="mt-3 h-12 text-sm text-muted"
              onClick={() => {
                setHour(null);
                setMinute(0);
                setReminderHour(null);
                void finishOnboarding();
              }}
            >
              Agora não
            </button>
          </Pane>
        </div>
      </div>
    </div>
  );
}

function Pane({
  width,
  active,
  children,
}: {
  width: number;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex h-full shrink-0 flex-col overflow-x-hidden px-6 pb-8 pt-2"
      style={{ width }}
      aria-hidden={!active}
      inert={!active ? true : undefined}
    >
      {children}
    </div>
  );
}

function Option({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl px-4 py-4 text-left text-sm font-medium",
        on ? "tab-gradient text-on-accent" : "bg-card text-fg",
      )}
    >
      {children}
    </button>
  );
}

function SplashBg() {
  const srcs = ["/onb/a.jpg", "/onb/b.jpg", "/onb/c.jpg", "/onb/d.jpg", "/onb/c.jpg", "/onb/a.jpg"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="grid h-[58%] grid-cols-3 gap-1.5 p-2 opacity-45">
        {srcs.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            className="h-full w-full rounded-2xl object-cover"
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/70 to-bg" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1-.2-1.4H12Z"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="currentColor"
        d="M14.7 10.3 22 2h-2.2l-6.3 7.2L8.3 2H2l7.7 11.1L2 22h2.2l6.8-7.8L15.7 22H22l-7.3-11.7Zm-2.4 2.7-.8-1.1L5.1 3.5h2.6l5.1 7.3.8 1.1 6.7 9.6h-2.6l-5.4-7.5Z"
      />
    </svg>
  );
}
