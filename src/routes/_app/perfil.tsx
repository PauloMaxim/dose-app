import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Clock,
  Flame,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { useState } from "react";
import { deriveMood, Mascot, mascotName } from "@/components/mascot";
import { Segmented } from "@/components/segmented";
import { getArticle } from "@/lib/content";
import {
  isSaved,
  selectCompletedCount,
  selectStreak,
  todayGoalMet,
  useDose,
} from "@/lib/store";
import { formatMinutes } from "@/lib/utils";

export const Route = createFileRoute("/_app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const profile = useDose((s) => s.profile);
  const logs = useDose((s) => s.logs);
  const progress = useDose((s) => s.progress);
  const saved = useDose((s) => s.saved);
  const [seg, setSeg] = useState<"atividades" | "salvos">("atividades");

  const streak = selectStreak(logs);
  const hours = logs.reduce((s, l) => s + l.minutes, 0) / 60;
  const finished = selectCompletedCount(progress);
  const goalMet = todayGoalMet(logs);
  const mood = deriveMood({
    goalMetToday: goalMet,
    streak,
    hour: new Date().getHours(),
  });
  const name = mascotName();
  const savedItems = saved.filter((s) => isSaved(s) || s.liked);

  return (
    <main className="min-h-0 flex-1 overflow-y-auto scrollbar-none px-5 pb-8 pt-4">
      <header className="relative mb-4 flex items-center justify-center">
        <h1 className="text-[22px] font-semibold tracking-tight">
          {profile.title} {profile.name}
        </h1>
        <Link
          to="/config"
          aria-label="Mais"
          className="absolute right-0 flex size-10 items-center justify-center rounded-full bg-card text-muted"
        >
          <MoreHorizontal className="size-5" />
        </Link>
      </header>

      <div className="mb-6 flex justify-center gap-2 overflow-x-auto scrollbar-none">
        <span className="tab-gradient rounded-full px-4 py-1.5 text-xs font-semibold text-on-accent">
          {profile.specialty}
        </span>
        {profile.topics.slice(0, 2).map((t) => (
          <span
            key={t}
            className="rounded-full bg-card px-4 py-1.5 text-xs font-medium text-muted"
          >
            {t}
          </span>
        ))}
      </div>

      <Link to="/mascote" className="mb-6 flex flex-col items-center" data-tour="tour-wardrobe">
        <Mascot
          look={profile.look}
          mood={mood}
          streak={streak}
          size={120}
          fed={goalMet}
        />
        <p className="mt-2 text-sm font-medium">{name}</p>
        <p className="mt-1 text-xs text-muted">
          {finished === 0
            ? "Ainda sem artigos lidos"
            : `${finished} artigo${finished === 1 ? "" : "s"} · ofensiva ${streak}`}
        </p>
        <p className="mt-1 text-[11px] text-teal">Toque para o armário</p>
      </Link>

      <div className="my-4 h-px bg-border" />

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">
          Estatísticas
        </p>
        <Link to="/config" aria-label="Editar metas">
          <Pencil className="size-4 text-muted" />
        </Link>
      </div>

      <StatRow icon={<Flame className="size-5" />} label="Ofensiva atual" value={streak} />
      <div className="h-px bg-border" />
      <StatRow
        icon={<Clock className="size-5" />}
        label="Horas lidas"
        value={Number(hours.toFixed(1))}
      />
      <div className="h-px bg-border" />
      <StatRow icon={<BookOpen className="size-5" />} label="Artigos finalizados" value={finished} />

      <div className="mt-5">
        <Segmented
          value={seg}
          onChange={setSeg}
          options={[
            {
              value: "atividades",
              label: "Atividades",
              icon: <LayoutGrid className="size-4" />,
            },
            {
              value: "salvos",
              label: "Salvos",
              icon: <BookOpen className="size-4" />,
            },
          ]}
        />
      </div>

      {seg === "atividades" ? (
        <ul className="mt-4 space-y-2">
          {logs.length === 0 && (
            <li className="py-8 text-center text-sm text-muted">
              Nenhuma leitura registrada ainda.
            </li>
          )}
          {[...logs]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 8)
            .map((l) => (
              <li
                key={l.date}
                className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 text-sm"
              >
                <span className="text-muted">
                  {new Date(l.date + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <span className="tabular-nums">
                  {formatMinutes(l.minutes)}
                  {l.goalMet ? " · meta" : ""}
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <ul className="mt-4 space-y-2">
          {savedItems.length === 0 && (
            <li className="py-8 text-center text-sm text-muted">Nada salvo ainda.</li>
          )}
          {savedItems.map((s) => {
            const a = getArticle(s.articleId);
            if (!a) return null;
            return (
              <li key={s.articleId}>
                <Link
                  to="/artigo/$id"
                  params={{ id: a.id }}
                  className="flex items-center justify-between rounded-2xl bg-card px-4 py-3"
                >
                  <span className="truncate pr-3 text-sm font-medium">{a.title}</span>
                  <span className="text-xs text-muted">{a.minutes} min</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-[15px]">{label}</span>
      <span className="text-[15px] tabular-nums text-muted">{value}</span>
    </div>
  );
}
