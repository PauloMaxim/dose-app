import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Clock, Flame, LayoutDashboard, Lock, Settings } from "lucide-react";
import { GoalBar } from "@/components/goal-bar";
import { Avatar } from "@/components/avatar";
import { deriveMood, Mascot, mascotCopy, mascotName } from "@/components/mascot";
import { StreakWeek } from "@/components/streak-week";
import { Button } from "@/components/ui/button";
import { editionMinutes, getTodayEdition } from "@/lib/content";
import { isPremium } from "@/lib/premium";
import {
  selectStreak,
  selectTodayLog,
  selectWeekMinutes,
  todayGoalMet,
  useDose,
} from "@/lib/store";
import { formatMinutes, greetingForHour } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: HomePage,
});

function HomePage() {
  const profile = useDose((s) => s.profile);
  const logs = useDose((s) => s.logs);
  const progress = useDose((s) => s.progress);

  const edition = getTodayEdition();
  const today = selectTodayLog(logs);
  const streak = selectStreak(logs);
  const weekMin = selectWeekMinutes(logs);
  const goalMet = todayGoalMet(logs);
  const hour = new Date().getHours();
  const mood = deriveMood({ goalMetToday: goalMet, streak, hour });
  const name = mascotName();
  const copy = mascotCopy(mood, name);
  const greet = greetingForHour(hour, profile.locale);
  const unread = edition.articleIds.filter((id) => !progress[id]?.completed);
  const totalMin = editionMinutes(edition);
  const resumeId =
    edition.articleIds.find(
      (id) => (progress[id]?.scrollPct ?? 0) > 0 && !progress[id]?.completed,
    ) ?? unread[0];
  const midArticle = Boolean(
    resumeId && (progress[resumeId]?.scrollPct ?? 0) > 0 && !progress[resumeId]?.completed,
  );
  const started = edition.articleIds.some(
    (id) => progress[id]?.completed || (progress[id]?.scrollPct ?? 0) > 0,
  );
  const finishedCount = Object.values(progress).filter((p) => p.completed).length;

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-5 pb-8 pt-3">
      <header className="mb-5 flex items-center justify-between gap-3" data-tour="tour-header">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={profile.name} src={profile.avatar} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold leading-tight">
              {profile.title} {profile.name}
            </p>
            <Link
              to="/dashboard"
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted"
            >
              <LayoutDashboard className="size-3" />
              Dashboard
              {!isPremium(profile.plan) && <Lock className="size-3" />}
            </Link>
          </div>
        </div>
        <Link
          to="/config"
          aria-label="Configurações"
          className="flex size-11 items-center justify-center rounded-full bg-card text-muted"
        >
          <Settings className="size-5" />
        </Link>
      </header>

      <p className="mb-3 text-sm text-muted">
        {greet}, {profile.title} {profile.name.split(" ")[0]}.
      </p>

      <div data-tour="tour-streak">
        <StreakWeek logs={logs} />
      </div>

      <Link
        to="/mascote"
        data-tour="tour-mascot"
        className="mt-4 flex items-center gap-3 rounded-2xl bg-card px-3 py-3"
      >
        <Mascot
          look={profile.look}
          mood={mood}
          streak={streak}
          size={88}
          fed={goalMet}
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">{copy.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{copy.body}</p>
        </div>
      </Link>

      <section
        data-tour="tour-edition"
        className="surface-gradient mt-4 rounded-[28px] px-5 py-6 shadow-card"
      >
        {unread.length === 0 ? (
          <>
            <h2 className="text-[28px] font-semibold leading-tight tracking-tight">
              Edição de hoje concluída
            </h2>
            <p className="mt-2 text-[15px] text-on-accent/85">
              {edition.title}. Volte amanhã para a próxima dose.
            </p>
            <Button asChild variant="white" size="lg" className="mt-5 w-full">
              <Link to="/edicao/$id" params={{ id: edition.id }} search={{ from: "home" }}>
                Rever a edição
              </Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-on-accent/75">
              {edition.kicker}
            </p>
            <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
              {midArticle
                ? "Continuar de onde parou"
                : started
                  ? "Continuar a edição"
                  : "Edição de hoje pronta"}
            </h2>
            <p className="mt-2 text-[15px] text-on-accent/85">
              {edition.title} · {formatMinutes(totalMin)} · {edition.articleIds.length} itens
              {midArticle && resumeId
                ? ` · ${progress[resumeId]?.scrollPct ?? 0}%`
                : started
                  ? ` · ${edition.articleIds.length - unread.length}/${edition.articleIds.length} lidos`
                  : ""}
            </p>
            <Button asChild variant="white" size="lg" className="mt-5 w-full">
              {midArticle && resumeId ? (
                <Link to="/ler/$id" params={{ id: resumeId }}>
                  Continuar leitura
                </Link>
              ) : (
                <Link to="/edicao/$id" params={{ id: edition.id }} search={{ from: "home" }}>
                  {started ? "Continuar a edição" : "Ler a edição de hoje"}
                </Link>
              )}
            </Button>
          </>
        )}
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2.5" data-tour="tour-stats">
        <Stat icon={<Flame className="size-6 text-teal" />} value={streak} label="Dia" />
        <Stat
          icon={<BookOpen className="size-6 text-blue" />}
          value={finishedCount}
          label="Artigos"
        />
        <Stat
          icon={<Clock className="size-6 text-teal" />}
          value={weekMin}
          label="Minutos"
          hint="7 dias"
        />
      </div>

      <div className="mt-3 space-y-2.5" data-tour="tour-goals">
        <GoalBar
          label="Meta diária"
          current={today?.minutes ?? 0}
          goal={profile.dailyGoalMin}
        />
        <GoalBar
          label="Meta semanal"
          current={weekMin}
          goal={profile.weeklyGoalMin}
        />
      </div>
    </main>
  );
}

function Stat({
  icon,
  value,
  label,
  hint,
}: {
  icon: React.ReactNode
  value: number
  label: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl bg-card px-3 py-3">
      <div className="mb-2">{icon}</div>
      <p className="text-[22px] font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted">
        {label}
        {hint ? <span className="block text-subtle">{hint}</span> : null}
      </p>
    </div>
  );
}
