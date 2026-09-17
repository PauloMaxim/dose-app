import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Clock, Flame, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PaywallGate } from "@/components/paywall-gate";
import { ARTICLES } from "@/lib/content";
import { isPremium } from "@/lib/premium";
import {
  selectCompletedCount,
  selectStreak,
  useDose,
} from "@/lib/store";
import { addDaysIso, formatMinutes, todayIso } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

const PAPER_MIN = 35;

function DashboardPage() {
  const logs = useDose((s) => s.logs);
  const progress = useDose((s) => s.progress);
  const plan = useDose((s) => s.profile.plan);
  const [range, setRange] = useState<"7" | "14">("14");
  const [picked, setPicked] = useState<string | null>(null);

  const finished = selectCompletedCount(progress);
  const streak = selectStreak(logs);
  const minutes = logs.reduce((s, l) => s + l.minutes, 0);
  const savedMin = Object.values(progress)
    .filter((p) => p.completed)
    .reduce((s, p) => {
      const art = ARTICLES.find((a) => a.id === p.articleId);
      return s + Math.max(0, PAPER_MIN - (art?.minutes ?? 8));
    }, 0);

  const days = range === "7" ? 7 : 14;
  const chart = useMemo(() => {
    const today = todayIso();
    return Array.from({ length: days }, (_, i) => {
      const date = addDaysIso(today, -(days - 1 - i));
      const log = logs.find((l) => l.date === date);
      return {
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        artigos: log?.articlesCompleted.length ?? 0,
        minutos: log?.minutes ?? 0,
      };
    });
  }, [logs, days]);

  const bySpec = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of Object.values(progress)) {
      if (!p.completed) continue;
      const a = ARTICLES.find((x) => x.id === p.articleId);
      if (!a) continue;
      map.set(a.specialty, (map.get(a.specialty) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [progress]);

  const pickedLog = picked ? logs.find((l) => l.date === picked) : undefined;

  if (!isPremium(plan)) {
    return (
      <PaywallGate
        title="Dashboard é Dose+"
        line="Minutos, ofensiva e especialidade em um só lugar. No Free a home já mostra a ronda do dia."
      />
    );
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-5 pb-10 pt-4">
      <header className="mb-5 flex items-center gap-2">
        <Link
          to="/"
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-full bg-card"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight">Dashboard</h1>
      </header>

      <div className="grid grid-cols-2 gap-2.5" data-tour="tour-dash">
        <Stat icon={<BookOpen className="size-5 text-blue" />} value={finished} label="Artigos lidos" />
        <Stat icon={<Clock className="size-5 text-teal" />} value={minutes} label="Minutos na Dose" hint={formatMinutes(minutes)} />
        <Stat icon={<Flame className="size-5 text-teal" />} value={streak} label="Ofensiva" />
        <Stat
          icon={<Timer className="size-5 text-blue" />}
          value={savedMin}
          label="Tempo economizado"
          hint={`${formatMinutes(savedMin)} vs. paper completo`}
        />
      </div>

      <section className="mt-6 rounded-2xl bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">Artigos por dia</h2>
          <div className="flex gap-1 rounded-full bg-elevated p-1">
            {(["7", "14"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={
                  range === r
                    ? "h-7 rounded-full tab-gradient px-3 text-[11px] font-semibold text-on-accent"
                    : "h-7 rounded-full px-3 text-[11px] font-medium text-muted"
                }
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} onClick={(s) => {
              const d = (s?.activePayload?.[0]?.payload as { date?: string } | undefined)?.date;
              if (d) setPicked(d);
            }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8e8e93", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} width={18} tick={{ fill: "#8e8e93", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  background: "#1c1c1f",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  color: "#f5f5f7",
                }}
                formatter={(v: number) => [`${v}`, "artigos"]}
              />
              <Bar dataKey="artigos" fill="#2ee6c5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-[11px] text-subtle">Toque numa barra para ver o dia.</p>
        {pickedLog && (
          <div className="mt-3 rounded-xl bg-elevated px-3 py-3">
            <p className="text-xs text-muted">
              {new Date(pickedLog.date + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <p className="mt-1 text-sm">
              {pickedLog.articlesCompleted.length} artigos · {formatMinutes(pickedLog.minutes)}
              {pickedLog.goalMet ? " · meta" : ""}
            </p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-card p-4">
        <h2 className="mb-3 text-[13px] font-semibold">Por especialidade</h2>
        {bySpec.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Leia um artigo para ver o recorte.</p>
        ) : (
          <ul className="space-y-2">
            {bySpec.map(([spec, n]) => (
              <li key={spec} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{spec}</span>
                <span className="text-sm tabular-nums text-muted">{n}</span>
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
                  <span
                    className="block h-full tab-gradient"
                    style={{ width: `${Math.round((n / finished) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
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
