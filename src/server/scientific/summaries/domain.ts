import { createHash } from "node:crypto";
import type { ScientificArticle } from "../types";
import type { SummaryInput } from "./provider.server";

export interface SummaryArticle extends ScientificArticle {
  id: string;
  studyType?: string | null;
  evidenceLevel?: string | null;
  summaryEligible: boolean;
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
  const abstract = article.abstract?.trim();
  if (
    !article.summaryEligible ||
    !abstract ||
    abstract.length < 120 ||
    abstract.length > maxInputCharacters
  )
    return null;
  return {
    articleId: article.id,
    title: article.title,
    abstract,
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
