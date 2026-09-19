import "./server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { scientificReclassificationBatchSchema } from "./scientific-read-api.server";
import { TOPIC_RULE_VERSION } from "./topic-rule-contract";
import { reconcileAutomaticTopics } from "./topic-persistence.server";
import {
  dryRunTopicReclassificationBatch,
  type CurrentTopicAssociation,
  type TopicDryRunArticle,
  type TopicReclassificationBatchPlan,
  type TopicReclassificationPlan,
} from "./topic-reclassification-dry-run.server";
import { loadActiveTopicRules } from "./topic-rules.server";
import type { ScientificArticle } from "./types";

export const TOPIC_BACKFILL_APPLY_CONFIRMATION = "APPLY_CANONICAL_TOPIC_RULES_V1_BACKFILL" as const;
export const MAX_TOPIC_BACKFILL_BATCH_SIZE = 100;

export type TopicBackfillRequest =
  | { mode?: "dry_run"; batchSize?: number; afterArticleId?: string }
  | {
      mode: "apply";
      batchSize?: number;
      afterArticleId?: string;
      expectedRuleVersion: typeof TOPIC_RULE_VERSION;
      explicitConfirmation: typeof TOPIC_BACKFILL_APPLY_CONFIRMATION;
    };

export interface TopicBackfillArticleResult {
  articleId: string;
  status: "planned" | "applied" | "failed" | "not_attempted";
  plan: TopicReclassificationPlan;
  errorCode?: "topic_reconciliation_failed";
}

export interface TopicBackfillReport {
  mode: "dry_run" | "apply";
  ruleVersion: typeof TOPIC_RULE_VERSION;
  startedAt: string;
  completedAt: string;
  nextCursor: string | null;
  results: TopicBackfillArticleResult[];
  metrics: {
    articlesPlanned: number;
    articlesApplied: number;
    articlesFailed: number;
    additions: number;
    updates: number;
    removals: number;
    unchanged: number;
    editorialPreserved: number;
    multiTopicArticles: number;
    matchesByTopic: Record<string, number>;
    confidenceDistribution: Record<string, number>;
    ruleVersion: typeof TOPIC_RULE_VERSION;
  };
}

const batchSize = (value?: number) => {
  const size = value ?? 50;
  if (!Number.isInteger(size) || size < 1 || size > MAX_TOPIC_BACKFILL_BATCH_SIZE)
    throw new TypeError(`batchSize must be between 1 and ${MAX_TOPIC_BACKFILL_BATCH_SIZE}`);
  return size;
};

function databaseArticle(
  row: z.infer<typeof scientificReclassificationBatchSchema>[number],
): ScientificArticle {
  return {
    title: row.title,
    abstract: row.abstract,
    authors: [],
    journal: row.journal,
    publisher: null,
    publishedAt: null,
    doi: null,
    pmid: null,
    pmcid: null,
    language: null,
    publicationTypes: row.publication_types ?? [],
    volume: null,
    issue: null,
    pages: null,
    originalUrl: null,
    pubmedUrl: null,
    pmcUrl: null,
    doiUrl: null,
    keywords: row.keywords ?? [],
    meshTerms: row.mesh_terms ?? [],
    discoveredBy: "pubmed",
    provenance: [],
    ingestedAt: null,
    updatedAt: null,
  };
}

/** Read-only, cursor-based loader for a future real-data dry-run. */
export async function loadTopicBackfillArticles(
  client: SupabaseClient,
  options: { batchSize?: number; afterArticleId?: string } = {},
): Promise<TopicDryRunArticle[]> {
  const result = await client.rpc("read_scientific_reclassification_batch", {
    p_after_article_id: options.afterArticleId ?? null,
    p_limit: batchSize(options.batchSize),
  });
  if (result.error) throw new Error("Não foi possível carregar o batch de reclassificação.");
  const rows = scientificReclassificationBatchSchema.parse(result.data);
  return rows.map((row) => ({
    articleId: row.article_id,
    article: databaseArticle(row),
    currentTopics: row.associations.map((topic): CurrentTopicAssociation => ({
      topicId: topic.topic_id,
      associationType: topic.association_type,
      confidence: topic.confidence === null ? null : Number(topic.confidence),
      method: topic.method,
      evidence: topic.evidence ?? [],
      ruleVersion: topic.rule_version,
    })),
  }));
}

function selectedMetrics(
  plan: TopicReclassificationBatchPlan,
  included: ReadonlySet<string>,
): Pick<
  TopicBackfillReport["metrics"],
  "additions" | "updates" | "removals" | "unchanged" | "editorialPreserved" | "multiTopicArticles"
> {
  const plans = plan.articles.filter((item) => included.has(item.articleId));
  const sum = (select: (item: TopicReclassificationPlan) => number) =>
    plans.reduce((total, item) => total + select(item), 0);
  return {
    additions: sum((item) => item.automaticTopicsToAdd.length),
    updates: sum((item) => item.automaticTopicsToUpdate.length),
    removals: sum((item) => item.automaticTopicsToRemove.length),
    unchanged: sum((item) => item.unchangedAutomaticTopics.length),
    editorialPreserved: sum((item) => item.editorialTopicsPreserved.length),
    multiTopicArticles: plans.filter((item) => item.desiredAutomaticTopics.length > 1).length,
  };
}

const reportMetrics = (
  plan: TopicReclassificationBatchPlan,
  results: readonly TopicBackfillArticleResult[],
): TopicBackfillReport["metrics"] => {
  const included = new Set(
    results
      .filter((result) => result.status === "planned" || result.status === "applied")
      .map((result) => result.articleId),
  );
  return {
    articlesPlanned: plan.articles.length,
    articlesApplied: results.filter((result) => result.status === "applied").length,
    articlesFailed: results.filter((result) => result.status === "failed").length,
    ...selectedMetrics(plan, included),
    matchesByTopic: plan.metrics.matchesByTopic,
    confidenceDistribution: plan.metrics.confidenceDistribution,
    ruleVersion: TOPIC_RULE_VERSION,
  };
};

/** Internal execution seam: always plans first; apply is sequential and stops after the first RPC error. */
export async function executeTopicBackfillBatch(
  client: SupabaseClient,
  articles: readonly TopicDryRunArticle[],
  rules: Parameters<typeof dryRunTopicReclassificationBatch>[1],
  request: TopicBackfillRequest = {},
  now: () => Date = () => new Date(),
): Promise<TopicBackfillReport> {
  const startedAt = now().toISOString();
  batchSize(request.batchSize);
  const plan = dryRunTopicReclassificationBatch(articles, rules);
  const mode = request.mode ?? "dry_run";
  if (request.mode === "apply") {
    if (
      request.explicitConfirmation !== TOPIC_BACKFILL_APPLY_CONFIRMATION ||
      request.expectedRuleVersion !== TOPIC_RULE_VERSION
    )
      throw new TypeError("explicit topic backfill confirmation and rule version are required");
  }

  const results: TopicBackfillArticleResult[] = [];
  if (mode === "dry_run") {
    results.push(
      ...plan.articles.map((articlePlan) => ({
        articleId: articlePlan.articleId,
        status: "planned" as const,
        plan: articlePlan,
      })),
    );
  } else {
    let failed = false;
    for (const articlePlan of plan.articles) {
      if (failed) {
        results.push({
          articleId: articlePlan.articleId,
          status: "not_attempted",
          plan: articlePlan,
        });
        continue;
      }
      try {
        await reconcileAutomaticTopics(
          client,
          articlePlan.articleId,
          TOPIC_RULE_VERSION,
          articlePlan.desiredAutomaticTopics,
        );
        results.push({ articleId: articlePlan.articleId, status: "applied", plan: articlePlan });
      } catch {
        failed = true;
        results.push({
          articleId: articlePlan.articleId,
          status: "failed",
          plan: articlePlan,
          errorCode: "topic_reconciliation_failed",
        });
      }
    }
  }
  const completedAt = now().toISOString();
  const completed = results.filter(
    (result) => result.status === "planned" || result.status === "applied",
  );
  return {
    mode,
    ruleVersion: TOPIC_RULE_VERSION,
    startedAt,
    completedAt,
    nextCursor: completed.at(-1)?.articleId ?? null,
    results,
    metrics: reportMetrics(plan, results),
  };
}

/** Production entry point. The caller must provide an already-authorized service-role client. */
export async function runTopicBackfillBatch(
  client: SupabaseClient,
  request: TopicBackfillRequest = {},
  now: () => Date = () => new Date(),
): Promise<TopicBackfillReport> {
  const [rules, articles] = await Promise.all([
    loadActiveTopicRules(client),
    loadTopicBackfillArticles(client, request),
  ]);
  return executeTopicBackfillBatch(client, articles, rules, request, now);
}
