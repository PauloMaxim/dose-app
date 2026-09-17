import { parseInsightBlocks } from "@/lib/insight-format";

export function InsightView({ text }: { text: string }) {
  const blocks = parseInsightBlocks(text);
  if (!blocks) {
    return <p className="text-[15px] leading-relaxed text-fg">{text}</p>;
  }
  return (
    <div className="space-y-3">
      {blocks.map((b) => (
        <div key={b.label}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
            {b.label}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-fg">{b.body}</p>
        </div>
      ))}
    </div>
  );
}
