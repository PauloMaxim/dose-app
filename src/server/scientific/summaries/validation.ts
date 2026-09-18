import { scientificSummarySchema, type ScientificSummary } from "./contract";
import { SummaryProviderError, type SummaryInput } from "./provider.server";

const numbers = (text: string) => text.match(/(?<![\p{L}])\d+(?:[.,]\d+)?%?/gu) ?? [];
export function validateSummary(output: unknown, input: SummaryInput): ScientificSummary {
  const parsed = scientificSummarySchema.safeParse(output);
  if (!parsed.success)
    throw new SummaryProviderError(
      "invalid_output",
      "Provider returned an invalid structured summary",
      false,
    );
  const sourceNumbers = new Set(numbers(`${input.title}\n${input.abstract}`));
  const claims = parsed.data.keyNumbers.flatMap((item) =>
    numbers(`${item.value} ${item.context ?? ""}`),
  );
  const unsupported = claims.filter((number) => !sourceNumbers.has(number));
  if (unsupported.length)
    throw new SummaryProviderError(
      "invalid_output",
      "Structured summary contains unsupported numeric claims",
      false,
    );
  return parsed.data;
}
export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown summary generation error";
  return raw
    .replace(/(?:sk-[A-Za-z0-9_-]+|Bearer\s+\S+|api[_-]?key\s*[:=]\s*\S+)/gi, "[REDACTED]")
    .slice(0, 500);
}
