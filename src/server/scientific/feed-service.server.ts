import "./server-only";
import { getSupabaseUserClient } from "../db/supabase.server";
import { buildScientificFeed, type FeedArticle } from "./feed";
import type { ScientificFeedInput } from "./feed-service";

/** Production boundary: identity and all trusted ranking inputs come from the authenticated session. */
export async function readScientificFeedForAuthenticatedUser(
  input: ScientificFeedInput,
  context: { accessToken: string; userId: string },
) {
  const client = getSupabaseUserClient(context.accessToken);
  const [interests, saved, progress, catalog, specialties, topics] = await Promise.all([
    client.from("user_interests").select("specialty_id,topic_id").eq("user_id", context.userId),
    client.from("saved_articles").select("article_id").eq("user_id", context.userId),
    client
      .from("reading_progress")
      .select("article_id,completed_at")
      .eq("user_id", context.userId)
      .not("completed_at", "is", null),
    client
      .from("articles")
      .select(
        "id,title,abstract,authors,journal,publisher,published_at,doi,pmid,pmcid,language,publication_types,volume,issue,pages,original_url,pubmed_url,pmc_url,doi_url,keywords,mesh_terms,ingested_at,updated_at,article_topics!inner(topic_id,confidence,association_type,method,evidence,rule_version,topics!inner(specialty_id,is_active))",
      ),
    client.from("specialties").select("id").eq("is_active", true),
    client.from("topics").select("id,specialty_id").eq("is_active", true),
  ]);
  for (const result of [interests, saved, progress, catalog, specialties, topics])
    if (result.error) throw new Error("Não foi possível construir o feed científico.");
  const rows = (interests.data ?? []) as any[];
  const activeSpecialties = new Set((specialties.data ?? []).map((x) => x.id));
  const activeTopics = new Set((topics.data ?? []).map((x) => x.id));
  const preferences = {
    specialtyIds: rows
      .filter((x) => x.specialty_id && activeSpecialties.has(x.specialty_id))
      .map((x) => x.specialty_id),
    topicIds: rows.filter((x) => x.topic_id && activeTopics.has(x.topic_id)).map((x) => x.topic_id),
  };
  const articles = (catalog.data ?? []).map((row: any): FeedArticle => ({
    id: row.id,
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
    keywords: row.keywords ?? [],
    meshTerms: row.mesh_terms ?? [],
    ingestedAt: row.ingested_at,
    updatedAt: row.updated_at,
    originalUrl: row.original_url,
    pubmedUrl: row.pubmed_url,
    pmcUrl: row.pmc_url,
    doiUrl: row.doi_url,
    topics: row.article_topics
      .filter((x: any) => x.topics?.is_active)
      .map((x: any) => ({
        topicId: x.topic_id,
        specialtyId: x.topics.specialty_id,
        confidence: Number(x.confidence ?? 1),
        associationType: x.association_type,
        method: x.method ?? "editorial",
        ruleVersion: x.rule_version ?? "editorial",
        evidence: x.evidence ?? [],
      })),
  }));
  return buildScientificFeed(
    articles,
    preferences,
    {
      savedArticleIds: (saved.data ?? []).map((x) => x.article_id),
      readArticleIds: (progress.data ?? []).map((x) => x.article_id),
    },
    input,
  );
}
