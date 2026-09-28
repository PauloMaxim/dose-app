import "../server-only";
import { z } from "zod";
import { ScientificHttpError } from "../http";
import { normalizeDoi } from "../identity";
import { mergeArticles } from "../merge";
import { normalizePmcid, normalizePmid } from "../persistence-boundary";
import type { ScientificAdapter, ScientificArticle, ScientificSource } from "../types";
import { contextualNeedId } from "./contextual-authorization";
import { contextualNeedSchema, type ContextualNeed } from "./contextual-need";

export const CONTEXTUAL_BIBLIOGRAPHIC_DISCOVERY_REQUEST_VERSION =
  "contextual-bibliographic-discovery-request.v1" as const;
export const BIBLIOGRAPHIC_CANDIDATE_VERSION = "bibliographic-candidate.v1" as const;
export const MAX_CONTEXTUAL_DISCOVERY_RESULTS = 20;
export const CONTEXTUAL_DISCOVERY_SOURCES = ["pubmed", "europe_pmc", "crossref"] as const;

const id = z.string().trim().min(1).max(500);
const sourceSchema = z.enum(CONTEXTUAL_DISCOVERY_SOURCES);
const httpLocatorSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol));

export const contextualBibliographicDiscoveryRequestSchema = z
  .object({
    schemaVersion: z.literal(CONTEXTUAL_BIBLIOGRAPHIC_DISCOVERY_REQUEST_VERSION),
    id,
    contextualNeedId: id,
    intent: z.literal("bibliographic_discovery"),
    query: z.string().trim().min(1).max(2_000),
    sources: z.array(sourceSchema).min(1).max(CONTEXTUAL_DISCOVERY_SOURCES.length),
    limit: z.number().int().min(1).max(MAX_CONTEXTUAL_DISCOVERY_RESULTS),
    review: z
      .object({
        reviewerId: id,
        reviewedAt: z.iso.datetime({ offset: true }),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((request, context) => {
    if (new Set(request.sources).size !== request.sources.length)
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Discovery sources must be unique",
      });
  });

export type ContextualBibliographicDiscoveryRequest = z.infer<
  typeof contextualBibliographicDiscoveryRequestSchema
>;

const identifierSchema = z
  .object({
    scheme: z.enum(["doi", "pmid", "pmcid"]),
    value: id,
  })
  .strict();

export const bibliographicCandidateSchema = z
  .object({
    schemaVersion: z.literal(BIBLIOGRAPHIC_CANDIDATE_VERSION),
    canonicalIdentifier: identifierSchema,
    identifiers: z
      .object({
        doi: z.string().nullable(),
        pmid: z.string().nullable(),
        pmcid: z.string().nullable(),
      })
      .strict(),
    title: z.string().min(1),
    returnedBy: z.array(sourceSchema).min(1),
    locators: z.array(httpLocatorSchema),
    publicationMetadata: z
      .object({
        authors: z.array(
          z
            .object({
              given: z.string().nullable(),
              family: z.string().nullable(),
              collectiveName: z.string().nullable(),
              orcid: z.string().nullable(),
            })
            .strict(),
        ),
        journal: z.string().nullable(),
        publisher: z.string().nullable(),
        publishedAt: z.string().nullable(),
        language: z.string().nullable(),
        publicationTypes: z.array(z.string()),
        volume: z.string().nullable(),
        issue: z.string().nullable(),
        pages: z.string().nullable(),
      })
      .strict(),
    discoveryProvenance: z
      .object({
        requestId: id,
        contextualNeedId: id,
        query: z.string().min(1),
        sourceRecords: z.array(
          z
            .object({
              source: sourceSchema,
              externalId: id,
              sourceUrl: httpLocatorSchema.nullable(),
              discoveredBy: sourceSchema,
              isOpenAccess: z.boolean().optional(),
              license: z.string().nullable().optional(),
            })
            .strict(),
        ),
        adapterReturns: z.array(
          z
            .object({
              adapter: sourceSchema,
              identifiers: z
                .object({
                  doi: z.string().nullable(),
                  pmid: z.string().nullable(),
                  pmcid: z.string().nullable(),
                })
                .strict(),
            })
            .strict(),
        ),
      })
      .strict(),
    contextualNeed: contextualNeedSchema,
  })
  .strict();

export type BibliographicCandidate = z.infer<typeof bibliographicCandidateSchema>;

export const contextualBibliographicDiscoveryFailureSchema = z
  .object({
    source: sourceSchema,
    kind: z.enum(["timeout", "rate_limited", "adapter_error"]),
    httpStatus: z.number().int().optional(),
  })
  .strict();

export interface ContextualBibliographicDiscoveryResult {
  candidates: BibliographicCandidate[];
  failures: z.infer<typeof contextualBibliographicDiscoveryFailureSchema>[];
  discardedWithoutBibliographicIdentity: number;
}

export type ContextualDiscoveryAdapters = Partial<Record<ScientificSource, ScientificAdapter>>;

interface ReturnedArticle {
  adapter: ScientificSource;
  article: ScientificArticle;
}

export interface BibliographicIdentifierConflict {
  scheme: "doi" | "pmid" | "pmcid";
  values: string[];
}

/**
 * Discovery rejects the complete consolidation when identifier-linked records disagree. The
 * canonical, sorted conflict list is safe for audit and no candidate is silently selected.
 */
export class BibliographicIdentityConflictError extends Error {
  readonly conflicts: BibliographicIdentifierConflict[];

  constructor(conflicts: BibliographicIdentifierConflict[]) {
    super(
      `Conflicting bibliographic identifiers: ${conflicts
        .map(({ scheme, values }) => `${scheme}=${values.join("|")}`)
        .join(", ")}`,
    );
    this.name = "BibliographicIdentityConflictError";
    this.conflicts = structuredClone(conflicts);
  }
}

function canonicalIdentifiers(article: ScientificArticle) {
  return {
    doi: normalizeDoi(article.doi),
    pmid: normalizePmid(article.pmid),
    pmcid: normalizePmcid(article.pmcid),
  };
}

function canonicalIdentifier(article: ScientificArticle) {
  const identifiers = canonicalIdentifiers(article);
  if (identifiers.doi) return { scheme: "doi" as const, value: identifiers.doi };
  if (identifiers.pmid) return { scheme: "pmid" as const, value: identifiers.pmid };
  if (identifiers.pmcid) return { scheme: "pmcid" as const, value: identifiers.pmcid };
  return null;
}

function identifierKeys(article: ScientificArticle) {
  const identifiers = canonicalIdentifiers(article);
  return (["doi", "pmid", "pmcid"] as const).flatMap((scheme) =>
    identifiers[scheme] ? [`${scheme}:${identifiers[scheme]}`] : [],
  );
}

function canonicalRecordKey(record: ReturnedArticle) {
  const article = record.article;
  const provenance = [...article.provenance]
    .map((entry) => ({ ...entry }))
    .sort((a, b) =>
      JSON.stringify([
        a.source,
        a.externalId,
        a.sourceUrl,
        a.discoveredBy,
        a.isOpenAccess ?? null,
        a.license ?? null,
      ]).localeCompare(
        JSON.stringify([
          b.source,
          b.externalId,
          b.sourceUrl,
          b.discoveredBy,
          b.isOpenAccess ?? null,
          b.license ?? null,
        ]),
        "en",
      ),
    );
  return JSON.stringify([
    identifierKeys(article),
    record.adapter,
    article.title,
    article.abstract,
    article.authors,
    article.journal,
    article.publisher,
    article.publishedAt,
    article.language,
    article.publicationTypes,
    article.volume,
    article.issue,
    article.pages,
    article.originalUrl,
    article.pubmedUrl,
    article.pmcUrl,
    article.doiUrl,
    article.keywords,
    article.meshTerms,
    provenance,
  ]);
}

function conflictsFor(records: readonly ReturnedArticle[]) {
  const conflicts: BibliographicIdentifierConflict[] = [];
  for (const scheme of ["doi", "pmid", "pmcid"] as const) {
    const values = [
      ...new Set(
        records.map(({ article }) => canonicalIdentifiers(article)[scheme]).filter(Boolean),
      ),
    ].sort() as string[];
    if (values.length > 1) conflicts.push({ scheme, values });
  }
  return conflicts;
}

function consolidateArticles(records: readonly ReturnedArticle[]) {
  const ordered = [...records].sort((a, b) =>
    canonicalRecordKey(a).localeCompare(canonicalRecordKey(b), "en"),
  );
  const parents = ordered.map((_, index) => index);
  const find = (index: number): number =>
    parents[index] === index ? index : (parents[index] = find(parents[index]));
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  for (let left = 0; left < ordered.length; left++) {
    const leftKeys = new Set(identifierKeys(ordered[left].article));
    for (let right = left + 1; right < ordered.length; right++)
      if (identifierKeys(ordered[right].article).some((key) => leftKeys.has(key)))
        union(left, right);
  }

  const groups = new Map<number, ReturnedArticle[]>();
  ordered.forEach((record, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), record]);
  });

  return [...groups.values()].map((group) => {
    const conflicts = conflictsFor(group);
    if (conflicts.length) throw new BibliographicIdentityConflictError(conflicts);
    return {
      article: group
        .slice(1)
        .reduce((merged, record) => mergeArticles(merged, record.article), group[0].article),
      returns: group,
    };
  });
}

function classifyFailure(source: ScientificSource, error: unknown) {
  const abort =
    error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError";
  const kind =
    abort || (error instanceof Error && /timeout/i.test(error.message))
      ? "timeout"
      : error instanceof ScientificHttpError && error.status === 429
        ? "rate_limited"
        : "adapter_error";
  return contextualBibliographicDiscoveryFailureSchema.parse({
    source,
    kind,
    ...(error instanceof ScientificHttpError && error.status !== undefined
      ? { httpStatus: error.status }
      : {}),
  });
}

function candidateFrom(
  article: ScientificArticle,
  returns: readonly ReturnedArticle[],
  need: ContextualNeed,
  request: ContextualBibliographicDiscoveryRequest,
) {
  const canonical = canonicalIdentifier(article);
  if (!canonical) return null;
  const identifiers = canonicalIdentifiers(article);
  const sourceRecords = returns
    .flatMap(({ article: returnedArticle }) => returnedArticle.provenance)
    .map((entry) => structuredClone(entry))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
  const adapterReturns = returns
    .map(({ adapter, article: returnedArticle }) => ({
      adapter,
      identifiers: canonicalIdentifiers(returnedArticle),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
  const returnedBy = [...new Set(adapterReturns.map(({ adapter }) => adapter))].sort();
  const locators = [
    ...new Set(
      [
        ...sourceRecords.map(({ sourceUrl }) => sourceUrl),
        article.originalUrl,
        article.pubmedUrl,
        article.pmcUrl,
        article.doiUrl,
      ].filter((value): value is string => Boolean(value)),
    ),
  ].sort();

  return bibliographicCandidateSchema.parse({
    schemaVersion: BIBLIOGRAPHIC_CANDIDATE_VERSION,
    canonicalIdentifier: canonical,
    identifiers,
    title: article.title,
    returnedBy,
    locators,
    publicationMetadata: {
      authors: article.authors,
      journal: article.journal,
      publisher: article.publisher,
      publishedAt: article.publishedAt,
      language: article.language,
      publicationTypes: article.publicationTypes,
      volume: article.volume,
      issue: article.issue,
      pages: article.pages,
    },
    discoveryProvenance: {
      requestId: request.id,
      contextualNeedId: request.contextualNeedId,
      query: request.query,
      sourceRecords,
      adapterReturns,
    },
    contextualNeed: need,
  });
}

/**
 * Server-only discovery boundary. Review fields are declarative audit metadata, not authentication
 * or editorial authorization. The result contains bibliographic candidates only and never persists.
 */
export async function discoverContextualBibliographicCandidates(
  contextualNeedInput: ContextualNeed,
  requestInput: ContextualBibliographicDiscoveryRequest,
  adapters: ContextualDiscoveryAdapters,
): Promise<ContextualBibliographicDiscoveryResult> {
  const need = contextualNeedSchema.parse(contextualNeedInput);
  const request = contextualBibliographicDiscoveryRequestSchema.parse(requestInput);
  const exactNeedId = contextualNeedId(need);
  if (request.contextualNeedId !== exactNeedId)
    throw new Error("Discovery request does not match the exact contextual need identity");

  const selectedSources = [...request.sources].sort();
  for (const source of selectedSources)
    if (!adapters[source] || adapters[source]?.source !== source)
      throw new Error(`Missing or mismatched adapter for selected source: ${source}`);

  const settled = await Promise.allSettled(
    selectedSources.map(async (source) => {
      const adapter = adapters[source];
      if (!adapter) throw new Error(`Missing adapter for selected source: ${source}`);
      return {
        source,
        articles: await adapter.discover({
          query: request.query,
          sources: [source],
          limit: request.limit,
          offset: 0,
        }),
      };
    }),
  );
  const failures = settled.flatMap((result, index) =>
    result.status === "rejected" ? [classifyFailure(selectedSources[index], result.reason)] : [],
  );
  const returnedArticles = settled.flatMap((result) =>
    result.status === "fulfilled"
      ? result.value.articles.map((article) => ({ adapter: result.value.source, article }))
      : [],
  );
  const identifiable = returnedArticles.filter(({ article }) => canonicalIdentifier(article));
  const candidates = consolidateArticles(identifiable)
    .map(({ article, returns }) => candidateFrom(article, returns, need, request))
    .filter((candidate): candidate is BibliographicCandidate => candidate !== null)
    .sort((a, b) =>
      `${a.canonicalIdentifier.scheme}:${a.canonicalIdentifier.value}`.localeCompare(
        `${b.canonicalIdentifier.scheme}:${b.canonicalIdentifier.value}`,
        "en",
      ),
    )
    .slice(0, request.limit);

  return {
    candidates,
    failures,
    discardedWithoutBibliographicIdentity: returnedArticles.length - identifiable.length,
  };
}
