import "./server-only";
import type { ScientificArticle } from "./types";

export function normalizeDoi(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim();
  return /^10\.\d{4,9}\/\S+$/i.test(normalized) ? normalized : null;
}

function normalizedTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Conservative fallback: exact normalized title + exact date + first author's family name. */
export function bibliographicFallback(article: ScientificArticle): string | null {
  const family = article.authors[0]?.family?.normalize("NFKC").toLowerCase().trim();
  if (!family || !article.publishedAt || normalizedTitle(article.title).length < 20) return null;
  return `${normalizedTitle(article.title)}|${article.publishedAt}|${family}`;
}

export function articleIdentity(article: ScientificArticle): string {
  const doi = normalizeDoi(article.doi);
  if (doi) return `doi:${doi}`;
  if (article.pmid?.match(/^\d+$/)) return `pmid:${article.pmid}`;
  if (article.pmcid?.match(/^PMC\d+$/i)) return `pmcid:${article.pmcid.toUpperCase()}`;
  const fallback = bibliographicFallback(article);
  return fallback
    ? `bibliographic:${fallback}`
    : `unresolved:${article.discoveredBy}:${article.provenance[0]?.externalId ?? article.title}`;
}
