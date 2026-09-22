import "./server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyScientificArticle } from "./classification";
import { bibliographicFallback, normalizeDoi } from "./identity";
import { mergeArticles, promoteLegacyArticle } from "./merge";
import type { ScientificArticle, ScientificSource } from "./types";

export type PersistenceOutcome = "new" | "updated" | "reconciled";

const scientificSources: ReadonlySet<string> = new Set<ScientificSource>([
  "pubmed",
  "europe_pmc",
  "crossref",
]);

function databaseArticle(article: ScientificArticle) {
  const classification = classifyScientificArticle(article);
  return {
    title: article.title,
    abstract: article.abstract,
    authors: article.authors,
    journal: article.journal,
    publisher: article.publisher,
    published_at: article.publishedAt,
    doi: normalizeDoi(article.doi),
    pmid: article.pmid,
    pmcid: article.pmcid?.toUpperCase() ?? null,
    language: article.language,
    publication_types: article.publicationTypes,
    volume: article.volume,
    issue: article.issue,
    pages: article.pages,
    original_url: article.originalUrl,
    pubmed_url: article.pubmedUrl,
    pmc_url: article.pmcUrl,
    doi_url: article.doiUrl,
    keywords: article.keywords,
    mesh_terms: article.meshTerms,
    bibliographic_key: bibliographicFallback(article),
    ingested_at: article.ingestedAt ?? new Date().toISOString(),
    study_type: classification.studyType,
    evidence_level: classification.evidenceLevel,
    classification_version: classification.ruleVersion,
  };
}

function fromDatabase(row: Record<string, any>, incoming: ScientificArticle): ScientificArticle {
  return {
    ...incoming,
    title: row.title,
    abstract: row.abstract,
    authors: row.authors ?? [],
    journal: row.journal,
    publisher: row.publisher,
    publishedAt: row.published_at,
    doi: row.doi,
    pmid: row.pmid,
    pmcid: row.pmcid,
    language: row.language,
    publicationTypes: row.publication_types ?? [],
    volume: row.volume,
    issue: row.issue,
    pages: row.pages,
    originalUrl: row.original_url,
    pubmedUrl: row.pubmed_url,
    pmcUrl: row.pmc_url,
    doiUrl: row.doi_url,
    keywords: row.keywords ?? [],
    meshTerms: row.mesh_terms ?? [],
    ingestedAt: row.ingested_at,
    updatedAt: row.updated_at,
  };
}

/** Requires the privileged server client; no browser endpoint is exported. */
export async function persistScientificArticle(
  client: SupabaseClient,
  article: ScientificArticle,
): Promise<PersistenceOutcome> {
  const doi = normalizeDoi(article.doi);
  const fallback = bibliographicFallback(article);
  const alternatives = [
    doi && `doi_normalized.eq.${doi}`,
    article.pmid && `pmid.eq.${article.pmid}`,
    article.pmcid && `pmcid.eq.${article.pmcid.toUpperCase()}`,
    fallback && `bibliographic_key.eq.${fallback}`,
  ]
    .filter(Boolean)
    .join(",");
  let existing: Record<string, any> | null = null;
  let matchedSource = false;
  for (const provenance of article.provenance) {
    const source = await client
      .from("article_sources")
      .select("article_id")
      .eq("provider", provenance.source)
      .eq("external_id", provenance.externalId)
      .maybeSingle();
    if (source.error) throw source.error;
    if (source.data?.article_id) {
      const found = await client
        .from("articles")
        .select("*")
        .eq("id", source.data.article_id)
        .single();
      if (found.error) throw found.error;
      existing = found.data;
      matchedSource = true;
      break;
    }
  }
  if (!existing && alternatives) {
    const result = await client
      .from("articles")
      .select("*")
      .or(alternatives)
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    existing = result.data;
  }
  let articleId: string;
  let outcome: PersistenceOutcome;
  if (existing) {
    const sources = await client
      .from("article_sources")
      .select("provider")
      .eq("article_id", existing.id);
    if (sources.error) throw sources.error;
    const alreadyScientific = (sources.data ?? []).some(({ provider }) =>
      scientificSources.has(provider),
    );
    const persisted = fromDatabase(existing, article);
    const merged = alreadyScientific
      ? mergeArticles(persisted, article)
      : promoteLegacyArticle(persisted, article);
    const result = await client
      .from("articles")
      .update(databaseArticle(merged))
      .eq("id", existing.id)
      .select("id")
      .single();
    if (result.error) throw result.error;
    articleId = result.data.id;
    outcome = matchedSource ? "updated" : "reconciled";
  } else {
    const result = await client
      .from("articles")
      .insert(databaseArticle(article))
      .select("id")
      .single();
    if (result.error) throw result.error;
    articleId = result.data.id;
    outcome = "new";
  }
  for (const provenance of article.provenance) {
    const result = await client.from("article_sources").upsert(
      {
        article_id: articleId,
        provider: provenance.source,
        external_id: provenance.externalId,
        source_url: provenance.sourceUrl,
        metadata: {
          discovered_by: provenance.discoveredBy,
          is_open_access: provenance.isOpenAccess ?? null,
          license: provenance.license ?? null,
        },
      },
      { onConflict: "provider,external_id" },
    );
    if (result.error) throw result.error;
  }
  return outcome;
}
