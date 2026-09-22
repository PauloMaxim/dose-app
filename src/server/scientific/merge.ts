import "./server-only";
import { articleIdentity, normalizeDoi } from "./identity";
import type { ScientificArticle, ScientificAuthor } from "./types";

const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const richer = (a: string | null, b: string | null) =>
  !a ? b : !b ? a : b.length > a.length ? b : a;
const authorsScore = (authors: ScientificAuthor[]) =>
  authors.filter((a) => a.family || a.collectiveName).length;

/** Existing non-null values win, except richer abstract/authors; identifiers and provenance are unioned. */
export function mergeArticles(
  existing: ScientificArticle,
  incoming: ScientificArticle,
): ScientificArticle {
  const merged = { ...existing };
  for (const key of [
    "journal",
    "publisher",
    "publishedAt",
    "language",
    "volume",
    "issue",
    "pages",
    "originalUrl",
    "pubmedUrl",
    "pmcUrl",
  ] as const) {
    merged[key] ??= incoming[key];
  }
  merged.title = richer(existing.title, incoming.title) ?? existing.title;
  merged.abstract = richer(existing.abstract, incoming.abstract);
  merged.authors =
    authorsScore(incoming.authors) > authorsScore(existing.authors)
      ? incoming.authors
      : existing.authors;
  merged.doi = normalizeDoi(existing.doi) ?? normalizeDoi(incoming.doi);
  merged.pmid = existing.pmid ?? incoming.pmid;
  merged.pmcid = existing.pmcid ?? incoming.pmcid;
  merged.doiUrl = merged.doi ? `https://doi.org/${merged.doi}` : null;
  merged.publicationTypes = uniq([...existing.publicationTypes, ...incoming.publicationTypes]);
  merged.keywords = uniq([...existing.keywords, ...incoming.keywords]);
  merged.meshTerms = uniq([...existing.meshTerms, ...incoming.meshTerms]);
  merged.provenance = [
    ...new Map(
      [...existing.provenance, ...incoming.provenance].map((p) => [
        `${p.source}:${p.externalId}`,
        p,
      ]),
    ).values(),
  ];
  merged.updatedAt = incoming.updatedAt ?? existing.updatedAt;
  return merged;
}

function preserveIdentifier(
  name: "DOI" | "PMID" | "PMCID",
  existing: string | null,
  incoming: string | null,
): string | null {
  if (existing && incoming && existing !== incoming) {
    throw new Error(`Conflicting ${name} while promoting legacy scientific metadata`);
  }
  return incoming ?? existing;
}

/**
 * Promotes the first real scientific record without treating legacy/editorial
 * metadata as a fallback. Identifiers remain independent identity evidence.
 */
export function promoteLegacyArticle(
  existing: ScientificArticle,
  incoming: ScientificArticle,
): ScientificArticle {
  const existingDoi = normalizeDoi(existing.doi);
  const incomingDoi = normalizeDoi(incoming.doi);
  const doi = preserveIdentifier("DOI", existingDoi, incomingDoi);
  const pmid = preserveIdentifier("PMID", existing.pmid, incoming.pmid);
  const pmcid = preserveIdentifier(
    "PMCID",
    existing.pmcid?.toUpperCase() ?? null,
    incoming.pmcid?.toUpperCase() ?? null,
  );

  return {
    ...incoming,
    doi,
    pmid,
    pmcid,
  };
}

export function deduplicateArticles(input: ScientificArticle[]): ScientificArticle[] {
  const result = new Map<string, ScientificArticle>();
  // Multiple passes reconcile an identifier learned from a later source.
  for (const article of input) {
    const identity = articleIdentity(article);
    const keys = [
      normalizeDoi(article.doi) && `doi:${normalizeDoi(article.doi)}`,
      article.pmid && `pmid:${article.pmid}`,
      article.pmcid && `pmcid:${article.pmcid.toUpperCase()}`,
    ].filter(Boolean) as string[];
    const hit = [...result.entries()].find(
      ([key, value]) =>
        key === identity ||
        keys.includes(key) ||
        (normalizeDoi(value.doi) && normalizeDoi(value.doi) === normalizeDoi(article.doi)) ||
        (value.pmid && value.pmid === article.pmid) ||
        (value.pmcid && value.pmcid.toUpperCase() === article.pmcid?.toUpperCase()),
    );
    if (hit) {
      const merged = mergeArticles(hit[1], article);
      result.delete(hit[0]);
      result.set(keys[0] ?? hit[0], merged);
    } else {
      result.set(identity, article);
    }
  }
  return [...result.values()];
}
