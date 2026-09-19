import "./server-only";
import { TOPIC_V1 } from "../../lib/scientific-catalog";
import { TOPIC_RULE_VERSION, storedTopicRuleSchema } from "./topic-rule-contract";
import {
  classifyArticleTopics,
  type TopicEvidence,
  type TopicMatch,
  type TopicRule,
} from "./topics";
import type { ScientificArticle } from "./types";

export const TOPIC_RECLASSIFICATION_PLAN_VERSION = "3b.3d-v1" as const;

export interface CurrentTopicAssociation {
  topicId: string;
  associationType: "automatic" | "editorial";
  confidence: number | null;
  method: string | null;
  evidence: TopicEvidence[];
  ruleVersion: string | null;
}

export interface TopicUpdate {
  current: CurrentTopicAssociation;
  desired: TopicMatch;
  reasons: Array<
    "rule_version_changed" | "confidence_changed" | "method_changed" | "evidence_changed"
  >;
}

export interface TopicRemoval {
  current: CurrentTopicAssociation;
  reason: "no_longer_desired";
}

export interface ClassificationEvidence {
  topicId: string;
  confidence: number;
  evidence: TopicEvidence[];
}

export interface TopicReclassificationPlan {
  planVersion: typeof TOPIC_RECLASSIFICATION_PLAN_VERSION;
  articleId: string;
  ruleVersion: typeof TOPIC_RULE_VERSION;
  currentAutomaticTopics: CurrentTopicAssociation[];
  currentEditorialTopics: CurrentTopicAssociation[];
  desiredAutomaticTopics: TopicMatch[];
  automaticTopicsToAdd: TopicMatch[];
  automaticTopicsToUpdate: TopicUpdate[];
  automaticTopicsToRemove: TopicRemoval[];
  unchangedAutomaticTopics: TopicMatch[];
  editorialTopicsPreserved: CurrentTopicAssociation[];
  classificationEvidence: ClassificationEvidence[];
  warnings: Array<
    { code: "no_topic_match" } | { code: "desired_topic_covered_by_editorial"; topicId: string }
  >;
}

export interface TopicDryRunArticle {
  articleId: string;
  article: ScientificArticle;
  currentTopics: readonly CurrentTopicAssociation[];
}

export interface TopicReclassificationMetrics {
  articlesEvaluated: number;
  articlesWithMatches: number;
  articlesWithoutMatches: number;
  totalDesiredAutomaticTopics: number;
  additions: number;
  updates: number;
  removals: number;
  unchanged: number;
  editorialAssociationsPreserved: number;
  multiTopicArticles: number;
  matchesByTopic: Record<string, number>;
  confidenceDistribution: Record<string, number>;
  ruleVersion: typeof TOPIC_RULE_VERSION;
}

export interface TopicReclassificationBatchPlan {
  planVersion: typeof TOPIC_RECLASSIFICATION_PLAN_VERSION;
  ruleVersion: typeof TOPIC_RULE_VERSION;
  articles: TopicReclassificationPlan[];
  metrics: TopicReclassificationMetrics;
}

const byTopicId = <T extends { topicId: string }>(a: T, b: T) => a.topicId.localeCompare(b.topicId);
const sameEvidence = (left: readonly TopicEvidence[], right: readonly TopicEvidence[]) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Validates one complete, version-consistent snapshot against the canonical V1 catalog. */
export function validateTopicRuleSnapshot(rules: readonly TopicRule[]): TopicRule[] {
  const canonical = new Map<string, string | null>(
    TOPIC_V1.map(([id, , , specialtyId]) => [id, specialtyId]),
  );
  if (rules.length !== canonical.size)
    throw new TypeError("rules must cover the canonical V1 topics");
  if (new Set(rules.map((rule) => rule.topicId)).size !== rules.length)
    throw new TypeError("rules must contain unique topic IDs");

  const validated = rules.map((rule) => {
    const expectedSpecialty = canonical.get(rule.topicId);
    if (expectedSpecialty === undefined)
      throw new TypeError("rule topic is not in the canonical V1 catalog");
    if (rule.specialtyId !== expectedSpecialty)
      throw new TypeError("rule specialty does not match the canonical V1 catalog");
    const { topicId, specialtyId, ...stored } = rule;
    const parsed = storedTopicRuleSchema.parse(stored);
    if (parsed.version !== TOPIC_RULE_VERSION) throw new TypeError("rule version is inconsistent");
    return { ...parsed, topicId, specialtyId };
  });
  return validated.sort(byTopicId);
}

function validateCurrentTopics(current: readonly CurrentTopicAssociation[]) {
  if (new Set(current.map((topic) => topic.topicId)).size !== current.length)
    throw new TypeError("current associations must contain unique topic IDs");
  for (const topic of current) {
    if (!topic.topicId.trim()) throw new TypeError("current association topic ID is required");
    if (topic.associationType === "automatic") {
      if (
        topic.confidence === null ||
        !Number.isFinite(topic.confidence) ||
        topic.confidence < 0 ||
        topic.confidence > 1 ||
        !topic.method ||
        !topic.ruleVersion
      )
        throw new TypeError("automatic association metadata is invalid");
    }
  }
}

function buildArticleTopicReclassificationPlan(
  input: TopicDryRunArticle,
  validatedRules: readonly TopicRule[],
): TopicReclassificationPlan {
  if (!input.articleId.trim()) throw new TypeError("article ID is required");
  validateCurrentTopics(input.currentTopics);
  const desired = classifyArticleTopics(input.article, validatedRules).sort(byTopicId);
  const automatic = input.currentTopics
    .filter((topic) => topic.associationType === "automatic")
    .sort(byTopicId);
  const editorial = input.currentTopics
    .filter((topic) => topic.associationType === "editorial")
    .sort(byTopicId);
  const automaticByTopic = new Map(automatic.map((topic) => [topic.topicId, topic]));
  const editorialByTopic = new Map(editorial.map((topic) => [topic.topicId, topic]));
  const desiredByTopic = new Map(desired.map((topic) => [topic.topicId, topic]));
  const automaticTopicsToAdd: TopicMatch[] = [];
  const automaticTopicsToUpdate: TopicUpdate[] = [];
  const unchangedAutomaticTopics: TopicMatch[] = [];
  const warnings: TopicReclassificationPlan["warnings"] = [];

  for (const match of desired) {
    if (editorialByTopic.has(match.topicId)) {
      warnings.push({ code: "desired_topic_covered_by_editorial", topicId: match.topicId });
      continue;
    }
    const current = automaticByTopic.get(match.topicId);
    if (!current) {
      automaticTopicsToAdd.push(match);
      continue;
    }
    const reasons: TopicUpdate["reasons"] = [];
    if (current.ruleVersion !== match.ruleVersion) reasons.push("rule_version_changed");
    if (current.confidence !== match.confidence) reasons.push("confidence_changed");
    if (current.method !== match.method) reasons.push("method_changed");
    if (!sameEvidence(current.evidence, match.evidence)) reasons.push("evidence_changed");
    if (reasons.length) automaticTopicsToUpdate.push({ current, desired: match, reasons });
    else unchangedAutomaticTopics.push(match);
  }

  const automaticTopicsToRemove = automatic
    .filter((topic) => !desiredByTopic.has(topic.topicId))
    .map((current) => ({ current, reason: "no_longer_desired" as const }));
  if (!desired.length) warnings.push({ code: "no_topic_match" });
  return {
    planVersion: TOPIC_RECLASSIFICATION_PLAN_VERSION,
    articleId: input.articleId,
    ruleVersion: TOPIC_RULE_VERSION,
    currentAutomaticTopics: automatic,
    currentEditorialTopics: editorial,
    desiredAutomaticTopics: desired,
    automaticTopicsToAdd,
    automaticTopicsToUpdate,
    automaticTopicsToRemove,
    unchangedAutomaticTopics,
    editorialTopicsPreserved: editorial,
    classificationEvidence: desired.map(({ topicId, confidence, evidence }) => ({
      topicId,
      confidence,
      evidence,
    })),
    warnings,
  };
}

/** Computes a read-only plan for one article. It has no database client or persistence path. */
export function dryRunArticleTopicReclassification(
  input: TopicDryRunArticle,
  rules: readonly TopicRule[],
): TopicReclassificationPlan {
  return buildArticleTopicReclassificationPlan(input, validateTopicRuleSnapshot(rules));
}

/** Produces stable per-article plans and aggregate metrics without performing I/O. */
export function dryRunTopicReclassificationBatch(
  input: readonly TopicDryRunArticle[],
  rules: readonly TopicRule[],
): TopicReclassificationBatchPlan {
  if (new Set(input.map((item) => item.articleId)).size !== input.length)
    throw new TypeError("dry-run batch must contain unique article IDs");
  const snapshot = validateTopicRuleSnapshot(rules);
  const articles = [...input]
    .sort((a, b) => a.articleId.localeCompare(b.articleId))
    .map((item) => buildArticleTopicReclassificationPlan(item, snapshot));
  const matchesByTopic = Object.fromEntries(
    [...snapshot].sort(byTopicId).map((rule) => [rule.topicId, 0]),
  );
  const confidenceDistribution: Record<string, number> = {};
  for (const plan of articles)
    for (const match of plan.desiredAutomaticTopics) {
      matchesByTopic[match.topicId]++;
      const bucket = match.confidence.toFixed(2);
      confidenceDistribution[bucket] = (confidenceDistribution[bucket] ?? 0) + 1;
    }
  const count = (select: (plan: TopicReclassificationPlan) => number) =>
    articles.reduce((total, plan) => total + select(plan), 0);
  return {
    planVersion: TOPIC_RECLASSIFICATION_PLAN_VERSION,
    ruleVersion: TOPIC_RULE_VERSION,
    articles,
    metrics: {
      articlesEvaluated: articles.length,
      articlesWithMatches: articles.filter((plan) => plan.desiredAutomaticTopics.length > 0).length,
      articlesWithoutMatches: articles.filter((plan) => !plan.desiredAutomaticTopics.length).length,
      totalDesiredAutomaticTopics: count((plan) => plan.desiredAutomaticTopics.length),
      additions: count((plan) => plan.automaticTopicsToAdd.length),
      updates: count((plan) => plan.automaticTopicsToUpdate.length),
      removals: count((plan) => plan.automaticTopicsToRemove.length),
      unchanged: count((plan) => plan.unchangedAutomaticTopics.length),
      editorialAssociationsPreserved: count((plan) => plan.editorialTopicsPreserved.length),
      multiTopicArticles: articles.filter((plan) => plan.desiredAutomaticTopics.length > 1).length,
      matchesByTopic,
      confidenceDistribution: Object.fromEntries(
        Object.entries(confidenceDistribution).sort(([left], [right]) => left.localeCompare(right)),
      ),
      ruleVersion: TOPIC_RULE_VERSION,
    },
  };
}
