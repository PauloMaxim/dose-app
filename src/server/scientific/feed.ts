import {
  classifyScientificArticle,
  type ArticleClassification,
  type EvidenceLevel,
} from "./classification";
import type { TopicMatch } from "./topics";
import type { ScientificArticle } from "./types";
import { evaluateSummaryEligibility } from "./summaries/domain";

export interface FeedArticle extends Omit<ScientificArticle, "discoveredBy" | "provenance"> {
  id: string;
  topics: FeedTopicMatch[];
}
export interface FeedTopicMatch extends Omit<TopicMatch, "method"> {
  associationType?: "automatic" | "editorial";
  method: string;
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
  scoreTotal: number;
  scoreComponents: RankingScoreComponents;
  rankingVersion: typeof SCIENTIFIC_FEED_RANKING_VERSION;
  rank: number;
  feedEligible: true;
  summaryEligible: boolean;
  matchedTopics: FeedTopicMatch[];
  /** @deprecated Use scoreComponents. Kept as a compatibility alias for current consumers. */
  reasons: RankingScoreComponents;
  userState: { saved: boolean; read: false };
}
export interface RankingScoreComponents {
  topicMatch: number;
  evidenceLevel: number;
  recency: number;
  metadataCompleteness: number;
  savedPreference: number;
}
export interface ScientificFeed {
  generatedAt: string;
  ruleVersion: "3b.2";
  rankingVersion: typeof SCIENTIFIC_FEED_RANKING_VERSION;
  mode: "recent" | "classics";
  items: RankedFeedItem[];
  nextCursor: string | null;
}
export const SCIENTIFIC_FEED_RANKING_VERSION = "feed-ranking-v1" as const;
const evidencePoints: Record<EvidenceLevel, number> = {
  high: 2500,
  moderate: 1700,
  low: 900,
  very_low: 200,
};
const DAY = 86_400_000;
interface FeedCursor {
  v: typeof SCIENTIFIC_FEED_RANKING_VERSION;
  mode: "recent" | "classics";
  asOf: string;
  key: [score: number, publishedAt: string, articleId: string];
}
const cursorFor = (
  x: { score: number; article: FeedArticle },
  mode: FeedCursor["mode"],
  asOf: string,
) =>
  Buffer.from(
    JSON.stringify({
      v: SCIENTIFIC_FEED_RANKING_VERSION,
      mode,
      asOf,
      key: [x.score, x.article.publishedAt!, x.article.id],
    } satisfies FeedCursor),
  ).toString("base64url");

function parseCursor(value: string, mode: FeedCursor["mode"], asOf: string): FeedCursor {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as FeedCursor;
    if (
      decoded.v !== SCIENTIFIC_FEED_RANKING_VERSION ||
      decoded.mode !== mode ||
      decoded.asOf !== asOf ||
      !Array.isArray(decoded.key) ||
      decoded.key.length !== 3 ||
      typeof decoded.key[0] !== "number" ||
      typeof decoded.key[1] !== "string" ||
      typeof decoded.key[2] !== "string"
    )
      throw new Error("incompatible cursor");
    return decoded;
  } catch {
    throw new TypeError("Invalid or incompatible scientific feed cursor");
  }
}

export function buildScientificFeed(
  articles: readonly FeedArticle[],
  preferences: FeedPreferences,
  history: FeedHistory,
  options: FeedOptions,
): ScientificFeed {
  const date = typeof options.asOf === "string" ? new Date(options.asOf) : options.asOf,
    now = date.getTime();
  if (!Number.isFinite(now)) throw new TypeError("asOf must be a valid date");
  const asOf = date.toISOString(),
    mode = options.mode ?? "recent",
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
      const scoreComponents: RankingScoreComponents = {
        topicMatch: relevance,
        evidenceLevel: evidencePoints[classification.evidenceLevel],
        recency: Math.max(0, 2000 - Math.floor(days / 30) * 100),
        metadataCompleteness:
          Math.min(500, Math.floor((article.abstract?.trim().length ?? 0) / 100) * 50) +
          (article.doi || article.pmid || article.pmcid ? 250 : 0),
        savedPreference: saved.has(article.id) ? 250 : 0,
      };
      const scoreTotal = Object.values(scoreComponents).reduce((a, b) => a + b, 0);
      return [
        {
          article,
          classification,
          matchedTopics,
          reasons: scoreComponents,
          scoreComponents,
          score: scoreTotal,
          scoreTotal,
          rankingVersion: SCIENTIFIC_FEED_RANKING_VERSION,
          userState: { saved: saved.has(article.id), read: false as const },
          feedEligible: true as const,
          summaryEligible: evaluateSummaryEligibility(article).eligible,
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
  let start = 0;
  if (options.cursor) {
    const cursor = parseCursor(options.cursor, mode, asOf);
    const index = ranked.findIndex(
      (x) =>
        x.score === cursor.key[0] &&
        x.article.publishedAt === cursor.key[1] &&
        x.article.id === cursor.key[2],
    );
    if (index < 0) throw new TypeError("Invalid or stale scientific feed cursor");
    start = index + 1;
  }
  const size = Math.max(1, Math.min(options.pageSize ?? 10, 100));
  const items = ranked.slice(start, start + size).map((x, i) => ({ ...x, rank: start + i + 1 }));
  return {
    generatedAt: asOf,
    ruleVersion: "3b.2",
    rankingVersion: SCIENTIFIC_FEED_RANKING_VERSION,
    mode,
    items,
    nextCursor:
      start + size < ranked.length && items.length ? cursorFor(items.at(-1)!, mode, asOf) : null,
  };
}
