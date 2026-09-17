import { formatMinutes } from "@/lib/utils";

export function GoalBar({
  label,
  current,
  goal,
}: {
  label: string
  current: number
  goal: number
}) {
  const pct = goal <= 0 ? 0 : Math.min(100, Math.round((current / goal) * 100));
  return (
    <div className="rounded-2xl bg-card px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-[13px] text-fg">
          {label}:{" "}
          <span className="text-muted">
            {formatMinutes(current)} / {formatMinutes(goal)}
          </span>
        </p>
        <span className="text-[13px] tabular-nums text-muted">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
