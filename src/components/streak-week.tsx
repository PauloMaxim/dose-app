import { selectWeekDates } from "@/lib/store";
import { WEEK_LABELS } from "@/lib/content";
import type { DayLog } from "@/lib/types";
import { todayIso, cn } from "@/lib/utils";

export function StreakWeek({ logs }: { logs: DayLog[] }) {
  const dates = selectWeekDates();
  const today = todayIso();
  const byDate = new Map(logs.map((l) => [l.date, l]));

  return (
    <div className="rounded-2xl bg-card px-3 py-3.5">
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
          const log = byDate.get(date);
          const isToday = date === today;
          const done = Boolean(log?.goalMet);
          const future = date > today;
          return (
            <div key={date} className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-subtle">
                {WEEK_LABELS[i]}
              </span>
              <div
                className={cn(
                  "size-8 rounded-full border-2",
                  done && "day-done border-transparent",
                  isToday && !done && "border-fg bg-transparent",
                  !isToday && !done && !future && "border-faint bg-bg",
                  future && "border-faint/60 bg-transparent",
                )}
                aria-label={
                  done
                    ? `${WEEK_LABELS[i]} cumprido`
                    : isToday
                      ? "Hoje"
                      : WEEK_LABELS[i]
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
