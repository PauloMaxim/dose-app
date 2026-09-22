import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Clock, Flame, LayoutDashboard, Lock, Settings } from "lucide-react";
import { GoalBar } from "@/components/goal-bar";
import { Avatar } from "@/components/avatar";
import { deriveMood, Mascot, mascotCopy, mascotName } from "@/components/mascot";
import { StreakWeek } from "@/components/streak-week";
import { ScientificFeedCard, ScientificFeedStatus } from "@/components/scientific-feed";
import { isPremium } from "@/lib/premium";
import { useScientificFeed } from "@/lib/use-scientific-feed";
import {
  selectStreak,
  selectTodayLog,
  selectWeekMinutes,
  todayGoalMet,
  useDose,
} from "@/lib/store";
import { greetingForHour } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({
  component: HomePage,
});

function HomePage() {
  const profile = useDose((s) => s.profile);
  const logs = useDose((s) => s.logs);
  const progress = useDose((s) => s.progress);

  const scientificFeed = useScientificFeed(5);
  const today = selectTodayLog(logs);
  const streak = selectStreak(logs);
  const weekMin = selectWeekMinutes(logs);
  const goalMet = todayGoalMet(logs);
  const hour = new Date().getHours();
  const mood = deriveMood({ goalMetToday: goalMet, streak, hour });
  const name = mascotName();
  const copy = mascotCopy(mood, name);
  const greet = greetingForHour(hour, profile.locale);
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
        <Mascot look={profile.look} mood={mood} streak={streak} size={88} fed={goalMet} />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">{copy.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{copy.body}</p>
        </div>
      </Link>

      <section data-tour="tour-edition" className="mt-4" aria-labelledby="scientific-update-title">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Sua Dose</p>
        <h2 id="scientific-update-title" className="mt-1 text-[26px] font-semibold tracking-tight">
          Atualização científica
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Literatura priorizada pela correspondência com seus interesses.
        </p>
        <div className="mt-4 space-y-3">
          {scientificFeed.status === "loading" && <ScientificFeedStatus status="loading" />}
          {scientificFeed.status === "error" && (
            <ScientificFeedStatus status="error" onRetry={scientificFeed.retry} />
          )}
          {scientificFeed.status === "ready" && scientificFeed.items.length === 0 && (
            <ScientificFeedStatus status="empty" />
          )}
          {scientificFeed.status === "ready" &&
            scientificFeed.items.map((item) => (
              <ScientificFeedCard key={item.id} item={item} compact />
            ))}
        </div>
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
        <GoalBar label="Meta diária" current={today?.minutes ?? 0} goal={profile.dailyGoalMin} />
        <GoalBar label="Meta semanal" current={weekMin} goal={profile.weeklyGoalMin} />
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
  icon: React.ReactNode;
  value: number;
  label: string;
  hint?: string;
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
