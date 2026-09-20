import { scientificSummarySchema, type ScientificSummary } from "./contract";
import { SummaryProviderError, type SummaryInput } from "./provider.server";

const numbers = (text: string) => text.match(/(?<![\p{L}])\d+(?:[.,]\d+)?%?/gu) ?? [];
const normalizeIdentifier = (value: string | null) => value?.trim().toLowerCase() ?? null;

export function validateSummary(output: unknown, input: SummaryInput): ScientificSummary {
  const parsed = scientificSummarySchema.safeParse(output);
  if (!parsed.success)
    throw new SummaryProviderError(
      "invalid_output",
      "Provider returned an invalid structured summary",
      false,
    );
  for (const key of ["doi", "pmid", "pmcid"] as const) {
    if (normalizeIdentifier(parsed.data.identifiers[key]) !== normalizeIdentifier(input[key]))
      throw new SummaryProviderError(
        "fidelity_validation",
        `Summary ${key} does not match the canonical article`,
        false,
      );
  }
  const sourceNumbers = new Set(numbers(`${input.title}\n${input.abstract}`));
  const claims = numbers(
    [parsed.data.mainResults, parsed.data.populationOrSample, ...parsed.data.keyPoints]
      .filter(Boolean)
      .join("\n"),
  );
  if (claims.some((number) => !sourceNumbers.has(number)))
    throw new SummaryProviderError(
      "fidelity_validation",
      "Structured summary contains unsupported numeric claims",
      false,
    );
  const rendered = JSON.stringify(parsed.data);
  if (/\b(?:full[ -]?text|texto integral|artigo completo)\b/i.test(rendered))
    throw new SummaryProviderError(
      "fidelity_validation",
      "Summary claims unsupported full-text access",
      false,
    );
  const outputDois = rendered.match(/10\.\d{4,9}\/[-._;()/:a-z0-9]+/gi) ?? [];
  if (outputDois.some((doi) => normalizeIdentifier(doi) !== normalizeIdentifier(input.doi)))
    throw new SummaryProviderError("fidelity_validation", "Summary contains an unknown DOI", false);
  return parsed.data;
}

export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown summary generation error";
  return raw
    .replace(
      /(?:Authorization\s*[:=]\s*(?:Bearer\s+)?\S+|sk-[A-Za-z0-9_-]+|Bearer\s+\S+|api[_-]?key\s*[:=]\s*\S+)/gi,
      "[REDACTED]",
    )
    .slice(0, 500);
}
