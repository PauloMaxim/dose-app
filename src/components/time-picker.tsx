import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatClock(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function TimePicker({
  hour,
  minute,
  onChange,
}: {
  hour: number
  minute: number
  onChange: (hour: number, minute: number) => void
}) {
  return (
    <div className="flex items-center justify-center gap-3" role="group" aria-label="Horário do lembrete">
      <Stepper
        label="Hora"
        value={hour}
        pad
        onUp={() => onChange((hour + 1) % 24, minute)}
        onDown={() => onChange((hour + 23) % 24, minute)}
      />
      <span className="text-3xl font-semibold tabular-nums text-muted" aria-hidden>
        :
      </span>
      <Stepper
        label="Minuto"
        value={minute}
        pad
        onUp={() => onChange(hour, (minute + 5) % 60)}
        onDown={() => onChange(hour, (minute + 55) % 60)}
      />
    </div>
  );
}

function Stepper({
  label,
  value,
  pad,
  onUp,
  onDown,
}: {
  label: string
  value: number
  pad?: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <div className="flex w-[7.5rem] flex-col items-center rounded-2xl bg-card py-2">
      <button
        type="button"
        aria-label={`${label} seguinte`}
        onClick={onUp}
        className="grid size-11 place-items-center text-muted"
      >
        <ChevronUp className="size-5" />
      </button>
      <p className={cn("text-[40px] font-semibold leading-none tabular-nums")}>
        {pad ? String(value).padStart(2, "0") : value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <button
        type="button"
        aria-label={`${label} anterior`}
        onClick={onDown}
        className="grid size-11 place-items-center text-muted"
      >
        <ChevronDown className="size-5" />
      </button>
    </div>
  );
}
