import { createHash } from "node:crypto";
import type { ScientificArticle } from "../types";
import type { SummaryInput } from "./provider.server";

export const MIN_SUMMARY_ABSTRACT_CHARACTERS = 120;
export type SummaryIneligibilityReason =
  "missing_abstract" | "abstract_too_short" | "input_too_large";
export interface SummaryEligibility {
  eligible: boolean;
  reason: SummaryIneligibilityReason | null;
}
export interface SummaryArticle extends ScientificArticle {
  id: string;
  studyType?: string | null;
  evidenceLevel?: string | null;
  /** Compatibility-only hint. The trusted decision is always recomputed from source material. */
  summaryEligible?: boolean;
}

export function evaluateSummaryEligibility(
  article: Pick<ScientificArticle, "abstract">,
  maxInputCharacters = 30_000,
): SummaryEligibility {
  const length = article.abstract?.trim().length ?? 0;
  if (!length) return { eligible: false, reason: "missing_abstract" };
  if (length < MIN_SUMMARY_ABSTRACT_CHARACTERS)
    return { eligible: false, reason: "abstract_too_short" };
  if (length > maxInputCharacters) return { eligible: false, reason: "input_too_large" };
  return { eligible: true, reason: null };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function buildSummaryInput(
  article: SummaryArticle,
  maxInputCharacters = 30_000,
): SummaryInput | null {
  if (!evaluateSummaryEligibility(article, maxInputCharacters).eligible) return null;
  return {
    articleId: article.id,
    title: article.title,
    abstract: article.abstract!.trim(),
    authors: article.authors
      .map((a) => a.collectiveName ?? [a.given, a.family].filter(Boolean).join(" "))
      .filter(Boolean),
    journal: article.journal,
    publishedAt: article.publishedAt,
    publicationTypes: article.publicationTypes,
    doi: article.doi,
    pmid: article.pmid,
    pmcid: article.pmcid,
    keywords: article.keywords,
    meshTerms: article.meshTerms,
    studyType: article.studyType ?? null,
    evidenceLevel: article.evidenceLevel ?? null,
    sourceScope: "abstract_and_metadata",
  };
}
export const deterministicHash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function summaryIdentity(
  articleId: string,
  input: SummaryInput,
  promptVersion: string,
  schemaVersion: string,
  provider: string,
  model: string,
) {
  const inputHash = deterministicHash(input);
  return {
    inputHash,
    identityKey: deterministicHash({
      articleId,
      inputHash,
      promptVersion,
      schemaVersion,
      provider,
      model,
    }),
  };
}
