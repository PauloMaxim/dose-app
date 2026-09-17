import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ReactNode }[]
}) {
  return (
    <div className="flex rounded-full bg-card p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors duration-200",
              active ? "tab-gradient text-on-accent" : "text-muted",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function UnderlineTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex items-end gap-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 pb-2.5 text-center text-[15px] font-medium",
              active ? "text-fg" : "text-subtle",
            )}
          >
            {opt.label}
            {active && (
              <span className="absolute inset-x-6 bottom-0 h-0.5 rounded-full tab-gradient" />
            )}
          </button>
        );
      })}
    </div>
  );
}
