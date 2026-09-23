import "./server-only";
import { evidenceLevels, studyTypes, type ArticleClassification } from "./classification";
import type { ScientificArticle } from "./types";

export const UNTITLED_SCIENTIFIC_RECORD = "Untitled scientific record";

export const normalizePmid = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[0-9]+$/.test(normalized) ? normalized : null;
};

export const normalizePmcid = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^PMC[0-9]+$/.test(normalized) ? normalized : null;
};

/** Final runtime boundary between provider metadata and public.articles. */
export function normalizeArticleForPersistence(article: ScientificArticle): ScientificArticle {
  const title = typeof article.title === "string" ? article.title.trim() : "";
  return {
    ...article,
    title: title || UNTITLED_SCIENTIFIC_RECORD,
    authors: Array.isArray(article.authors) ? article.authors : [],
    pmid: normalizePmid(article.pmid),
    pmcid: normalizePmcid(article.pmcid),
  };
}

export function assertPersistibleClassification(
  classification: ArticleClassification,
): ArticleClassification {
  if (!(studyTypes as readonly string[]).includes(classification.studyType)) {
    throw new Error("Invalid scientific persistence field: study_type");
  }
  if (!(evidenceLevels as readonly string[]).includes(classification.evidenceLevel)) {
    throw new Error("Invalid scientific persistence field: evidence_level");
  }
  return classification;
}
