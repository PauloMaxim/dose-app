import "./server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUserClient } from "../db/supabase.server";
import { scientificArticleIdSchema, toScientificArticleDetail } from "./article-detail";

export async function queryScientificArticleDetail(client: SupabaseClient, articleId: string) {
  const id = scientificArticleIdSchema.parse(articleId);
  const { data, error } = await client
    .from("articles")
    .select(
      "id,title,authors,journal,publisher,published_at,doi,pmid,pmcid,abstract,publication_types,study_type,classification_version,original_url,pubmed_url,pmc_url,doi_url,article_sources!inner(provider,external_id,source_url),article_topics(topic_id,topics(id,name,specialty_id,specialties(id,name)))",
    )
    .eq("id", id)
    .in("article_sources.provider", ["pubmed", "europe_pmc", "crossref"])
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o artigo científico.");
  return data ? toScientificArticleDetail(data) : null;
}

/** Uses the caller's validated Supabase session and therefore preserves RLS. */
export function readScientificArticleDetailForAuthenticatedUser(
  articleId: string,
  context: { accessToken: string },
) {
  return queryScientificArticleDetail(getSupabaseUserClient(context.accessToken), articleId);
}
