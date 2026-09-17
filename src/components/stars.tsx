import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({
  value,
  onChange,
  size = "md",
}: {
  value: number
  onChange?: (n: number) => void
  size?: "sm" | "md"
}) {
  const cls = size === "sm" ? "size-3.5" : "size-5";
  return (
    <div className="flex items-center gap-0.5" role={onChange ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value);
        const Comp = onChange ? "button" : "span";
        return (
          <Comp
            key={n}
            type={onChange ? "button" : undefined}
            aria-label={onChange ? `${n} de 5` : undefined}
            onClick={onChange ? () => onChange(n) : undefined}
            className={cn(onChange && "flex size-9 items-center justify-center")}
          >
            <Star
              className={cn(cls, on ? "fill-star text-star" : "text-subtle")}
            />
          </Comp>
        );
      })}
    </div>
  );
}

export function RatingSummary({
  average,
  count,
}: {
  average: number
  count: number
}) {
  if (count === 0) {
    return <p className="text-xs text-subtle">Ainda sem notas</p>;
  }
  return (
    <div className="flex items-center gap-2">
      <Stars value={average} size="sm" />
      <p className="text-xs tabular-nums text-muted">
        {average.toFixed(1)} · {count} {count === 1 ? "nota" : "notas"}
      </p>
    </div>
  );
}
