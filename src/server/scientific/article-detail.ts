import { z } from "zod";
import type { StudyType } from "./classification";

export const scientificArticleIdSchema = z.string().uuid();
export const scientificProvenanceSchema = z.enum(["pubmed", "europe_pmc", "crossref"]);

export interface ScientificArticleDetail {
  id: string;
  title: string;
  authors: string[];
  journal: string | null;
  publisher: string | null;
  publishedAt: string | null;
  doi: string | null;
  pmid: string | null;
  pmcid: string | null;
  abstract: string | null;
  publicationTypes: string[];
  studyType: StudyType | null;
  classificationVersion: string | null;
  provenance: Array<{
    provider: z.infer<typeof scientificProvenanceSchema>;
    externalId: string;
    sourceUrl: string | null;
  }>;
  sourceLinks: Array<{
    kind: "pubmed" | "pmc" | "doi" | "original";
    label: string;
    url: string;
  }>;
  topics: Array<{ id: string; name: string }>;
  specialties: Array<{ id: string; name: string }>;
}

type DetailRow = {
  id: unknown;
  title: unknown;
  authors?: unknown;
  journal?: unknown;
  publisher?: unknown;
  published_at?: unknown;
  doi?: unknown;
  pmid?: unknown;
  pmcid?: unknown;
  abstract?: unknown;
  publication_types?: unknown;
  study_type?: unknown;
  classification_version?: unknown;
  original_url?: unknown;
  pubmed_url?: unknown;
  pmc_url?: unknown;
  doi_url?: unknown;
  article_sources?: unknown;
  article_topics?: unknown;
};

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: "\u00a0",
  quot: '"',
};

/** Decodes text at the persisted-data presentation boundary without interpreting markup. */
export function normalizeScientificText(value: string) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith("#")) {
      const hexadecimal = token[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      try {
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
      } catch {
        return entity;
      }
    }
    return namedEntities[token.toLowerCase()] ?? entity;
  });
}

const nullableString = (value: unknown) =>
  typeof value === "string" && value.trim() ? normalizeScientificText(value.trim()) : null;

function authorName(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const author = value as Record<string, unknown>;
  return (
    nullableString(author.collectiveName) ??
    [nullableString(author.given), nullableString(author.family)].filter(Boolean).join(" ") ??
    null
  );
}

function safeLink(
  kind: ScientificArticleDetail["sourceLinks"][number]["kind"],
  label: string,
  value: unknown,
) {
  const candidate = nullableString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? { kind, label, url: candidate }
      : null;
  } catch {
    return null;
  }
}

/** Maps only persisted scientific metadata. It never reads legacy content or summary pipelines. */
export function toScientificArticleDetail(row: DetailRow): ScientificArticleDetail | null {
  const id = scientificArticleIdSchema.safeParse(row.id);
  const title = nullableString(row.title);
  if (!id.success || !title) return null;

  const provenance = (Array.isArray(row.article_sources) ? row.article_sources : []).flatMap(
    (value) => {
      if (!value || typeof value !== "object") return [];
      const source = value as Record<string, unknown>;
      const provider = scientificProvenanceSchema.safeParse(source.provider);
      const externalId = nullableString(source.external_id);
      if (!provider.success || !externalId) return [];
      return [
        { provider: provider.data, externalId, sourceUrl: nullableString(source.source_url) },
      ];
    },
  );
  if (provenance.length === 0) return null;

  const topicRows = (Array.isArray(row.article_topics) ? row.article_topics : []).flatMap(
    (value) => {
      if (!value || typeof value !== "object") return [];
      const relation = (value as Record<string, unknown>).topics;
      if (!relation || typeof relation !== "object") return [];
      const topic = relation as Record<string, unknown>;
      const topicId = nullableString(topic.id);
      const topicName = nullableString(topic.name);
      const specialty = topic.specialties;
      let specialtyValue: { id: string; name: string } | null = null;
      if (specialty && typeof specialty === "object") {
        const item = specialty as Record<string, unknown>;
        const specialtyId = nullableString(item.id);
        const specialtyName = nullableString(item.name);
        if (specialtyId && specialtyName) specialtyValue = { id: specialtyId, name: specialtyName };
      }
      return topicId && topicName
        ? [{ topic: { id: topicId, name: topicName }, specialty: specialtyValue }]
        : [];
    },
  );
  const unique = <T extends { id: string }>(items: T[]) =>
    items.filter(
      (item, index) => items.findIndex((candidate) => candidate.id === item.id) === index,
    );
  const sourceLinks = [
    safeLink("pubmed", "PubMed", row.pubmed_url),
    safeLink("pmc", "PubMed Central", row.pmc_url),
    safeLink("doi", "DOI", row.doi_url),
    safeLink("original", "Fonte original", row.original_url),
    ...provenance.map((source) => safeLink("original", "Fonte original", source.sourceUrl)),
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));

  return {
    id: id.data,
    title,
    authors: (Array.isArray(row.authors) ? row.authors : [])
      .map(authorName)
      .filter((x): x is string => Boolean(x)),
    journal: nullableString(row.journal),
    publisher: nullableString(row.publisher),
    publishedAt: nullableString(row.published_at),
    doi: nullableString(row.doi),
    pmid: nullableString(row.pmid),
    pmcid: nullableString(row.pmcid),
    abstract: nullableString(row.abstract),
    publicationTypes: (Array.isArray(row.publication_types) ? row.publication_types : []).filter(
      (x): x is string => typeof x === "string",
    ),
    studyType: nullableString(row.study_type) as StudyType | null,
    classificationVersion: nullableString(row.classification_version),
    provenance,
    sourceLinks: sourceLinks.filter(
      (link, index) => sourceLinks.findIndex((candidate) => candidate.url === link.url) === index,
    ),
    topics: unique(topicRows.map((item) => item.topic)),
    specialties: unique(
      topicRows.map((item) => item.specialty).filter((x): x is NonNullable<typeof x> => Boolean(x)),
    ),
  };
}
