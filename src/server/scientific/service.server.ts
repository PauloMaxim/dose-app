import "./server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CrossrefAdapter } from "./adapters/crossref.server";
import { EuropePmcAdapter } from "./adapters/europe-pmc.server";
import { PubMedAdapter } from "./adapters/pubmed.server";
import { deduplicateArticles } from "./merge";
import { persistScientificArticle } from "./persistence.server";
import type {
  DiscoveryOptions,
  ScientificAdapter,
  ScientificArticle,
  ScientificSource,
} from "./types";

const defaults: Record<ScientificSource, () => ScientificAdapter> = {
  pubmed: () => new PubMedAdapter(),
  europe_pmc: () => new EuropePmcAdapter(),
  crossref: () => new CrossrefAdapter(),
};
export interface IngestionStats {
  found: number;
  new: number;
  updated: number;
  reconciled: number;
  failed: number;
  errors: string[];
}

export async function discoverScientificArticles(
  options: DiscoveryOptions,
  adapters?: Partial<Record<ScientificSource, ScientificAdapter>>,
): Promise<ScientificArticle[]> {
  const sources: ScientificSource[] = options.sources?.length ? options.sources : ["pubmed"];
  const settled = await Promise.allSettled(
    sources.map((source) => (adapters?.[source] ?? defaults[source]()).discover(options)),
  );
  const articles = settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  if (!articles.length) {
    const failure = settled.find((r) => r.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
  return deduplicateArticles(articles);
}

export async function ingestScientificArticle(client: SupabaseClient, article: ScientificArticle) {
  return persistScientificArticle(client, article);
}

export async function ingestScientificBatch(
  client: SupabaseClient,
  articles: ScientificArticle[],
): Promise<IngestionStats> {
  const unique = deduplicateArticles(articles);
  const stats: IngestionStats = {
    found: articles.length,
    new: 0,
    updated: 0,
    reconciled: articles.length - unique.length,
    failed: 0,
    errors: [],
  };
  for (const article of unique) {
    try {
      const outcome = await persistScientificArticle(client, article);
      stats[outcome]++;
    } catch (error) {
      stats.failed++;
      stats.errors.push(
        error instanceof Error
          ? error.message.replace(/(api[_-]?key|token|authorization)=?[^\s&]*/gi, "$1=[redacted]")
          : "Unknown persistence error",
      );
    }
  }
  return stats;
}

export async function discoverAndIngestScientificArticles(
  client: SupabaseClient,
  options: DiscoveryOptions,
): Promise<IngestionStats> {
  return ingestScientificBatch(client, await discoverScientificArticles(options));
}
