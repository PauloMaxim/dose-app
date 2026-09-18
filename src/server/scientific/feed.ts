import {
  classifyScientificArticle,
  type ArticleClassification,
  type EvidenceLevel,
} from "./classification";
import type { TopicMatch } from "./topics";
import type { ScientificArticle } from "./types";

export interface FeedArticle extends ScientificArticle {
  id: string;
  topics: TopicMatch[];
}
export interface FeedPreferences {
  specialtyIds: readonly string[];
  topicIds: readonly string[];
}
export interface FeedHistory {
  readArticleIds?: readonly string[];
  savedArticleIds?: readonly string[];
}
export interface FeedOptions {
  asOf: string | Date;
  pageSize?: number;
  cursor?: string;
  mode?: "recent" | "classics";
  recentDays?: number;
  languages?: string[];
}
export interface RankedFeedItem {
  article: FeedArticle;
  classification: ArticleClassification;
  score: number;
  rank: number;
  feedEligible: true;
  summaryEligible: boolean;
  matchedTopics: TopicMatch[];
  reasons: {
    relevance: number;
    evidence: number;
    recency: number;
    completeness: number;
    saved: number;
  };
}
export interface ScientificFeed {
  generatedAt: string;
  ruleVersion: "3b.2";
  mode: "recent" | "classics";
  items: RankedFeedItem[];
  nextCursor: string | null;
}
const evidencePoints: Record<EvidenceLevel, number> = {
  high: 2500,
  moderate: 1700,
  low: 900,
  very_low: 200,
};
const DAY = 86_400_000;
const cursorFor = (x: { score: number; article: FeedArticle }) =>
  encodeURIComponent(JSON.stringify([x.score, x.article.publishedAt, x.article.id]));

export function buildScientificFeed(
  articles: readonly FeedArticle[],
  preferences: FeedPreferences,
  history: FeedHistory,
  options: FeedOptions,
): ScientificFeed {
  const date = typeof options.asOf === "string" ? new Date(options.asOf) : options.asOf,
    now = date.getTime();
  if (!Number.isFinite(now)) throw new TypeError("asOf must be a valid date");
  const mode = options.mode ?? "recent",
    boundary = options.recentDays ?? 365,
    read = new Set(history.readArticleIds ?? []),
    saved = new Set(history.savedArticleIds ?? []);
  const topicIds = new Set(preferences.topicIds),
    specialtyIds = new Set(preferences.specialtyIds);
  const ranked = articles
    .flatMap((article) => {
      if (
        !article.publishedAt ||
        read.has(article.id) ||
        article.publicationTypes.some((x) => /retracted publication/i.test(x))
      )
        return [];
      const published = Date.parse(`${article.publishedAt}T00:00:00.000Z`),
        days = Math.floor((now - published) / DAY);
      if (
        !Number.isFinite(published) ||
        days < 0 ||
        (mode === "recent" ? days > boundary : days <= boundary)
      )
        return [];
      const matchedTopics = article.topics.filter(
        (t) => topicIds.has(t.topicId) || (t.specialtyId && specialtyIds.has(t.specialtyId)),
      );
      if (!matchedTopics.length) return [];
      const classification = classifyScientificArticle(article); // never trust caller-provided classification
      const relevance =
        Math.round(Math.max(...matchedTopics.map((t) => t.confidence)) * 4000) +
        (matchedTopics.some((t) => t.specialtyId && specialtyIds.has(t.specialtyId)) ? 1500 : 0);
      const reasons = {
        relevance,
        evidence: evidencePoints[classification.evidenceLevel],
        recency: Math.max(0, 2000 - Math.floor(days / 30) * 100),
        completeness:
          Math.min(500, Math.floor((article.abstract?.trim().length ?? 0) / 100) * 50) +
          (article.doi || article.pmid || article.pmcid ? 250 : 0),
        saved: saved.has(article.id) ? 250 : 0,
      };
      return [
        {
          article,
          classification,
          matchedTopics,
          reasons,
          score: Object.values(reasons).reduce((a, b) => a + b, 0),
          feedEligible: true as const,
          summaryEligible: (article.abstract?.trim().length ?? 0) >= 100,
          rank: 0,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.article.publishedAt ?? "").localeCompare(a.article.publishedAt ?? "") ||
        a.article.id.localeCompare(b.article.id),
    );
  const after = options.cursor ? ranked.findIndex((x) => cursorFor(x) === options.cursor) + 1 : 0;
  const start = after > 0 ? after : 0,
    size = Math.max(1, Math.min(options.pageSize ?? 10, 100));
  const items = ranked.slice(start, start + size).map((x, i) => ({ ...x, rank: start + i + 1 }));
  return {
    generatedAt: date.toISOString(),
    ruleVersion: "3b.2",
    mode,
    items,
    nextCursor: start + size < ranked.length && items.length ? cursorFor(items.at(-1)!) : null,
  };
}
