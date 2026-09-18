import "./server-only";
import type { ScientificArticle, ScientificAuthor, ScientificSource } from "./types";

export const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
export const array = <T>(value: T | T[] | null | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
export const stripTags = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
export const tags = (xml: string, name: string) =>
  [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "gi"))].map((m) =>
    decodeXml(stripTags(m[1])),
  );
export const tag = (xml: string, name: string) => tags(xml, name)[0] ?? null;
export const attr = (xml: string, element: string, attribute: string, expected?: string) => {
  for (const match of xml.matchAll(
    new RegExp(`<${element}(\\s[^>]*)?>([\\s\\S]*?)<\\/${element}>`, "gi"),
  )) {
    const value = (match[1] ?? "").match(new RegExp(`${attribute}=["']([^"']+)["']`, "i"))?.[1];
    if (!expected || value?.toLowerCase() === expected.toLowerCase())
      return decodeXml(stripTags(match[2]));
  }
  return null;
};

export function emptyArticle(
  source: ScientificSource,
  title: string,
  externalId: string,
): ScientificArticle {
  return {
    title,
    abstract: null,
    authors: [],
    journal: null,
    publisher: null,
    publishedAt: null,
    doi: null,
    pmid: null,
    pmcid: null,
    language: null,
    publicationTypes: [],
    volume: null,
    issue: null,
    pages: null,
    originalUrl: null,
    pubmedUrl: null,
    pmcUrl: null,
    doiUrl: null,
    keywords: [],
    meshTerms: [],
    discoveredBy: source,
    provenance: [{ source, externalId, sourceUrl: null, discoveredBy: source }],
    ingestedAt: null,
    updatedAt: null,
  };
}

export function author(
  given: unknown,
  family: unknown,
  collectiveName: unknown = null,
  orcid: unknown = null,
): ScientificAuthor {
  return {
    given: text(given),
    family: text(family),
    collectiveName: text(collectiveName),
    orcid: text(orcid)?.replace(/^https?:\/\/orcid\.org\//, "") ?? null,
  };
}
