import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TOPIC_V1 } from "../../lib/scientific-catalog";
import { emptyArticle } from "./parse-utils";
import {
  dryRunArticleTopicReclassification,
  dryRunTopicReclassificationBatch,
  validateTopicRuleSnapshot,
  type CurrentTopicAssociation,
  type TopicDryRunArticle,
} from "./topic-reclassification-dry-run.server";
import { TOPIC_RULES_V1_CLASSIFIER_FIXTURE, TOPIC_RULES_V1_CORPUS } from "./topic-rules.v1.fixture";
import { classifyArticleTopics } from "./topics";
import type { ScientificArticle } from "./types";

const topicId = (slug: string) => TOPIC_V1.find((topic) => topic[1] === slug)![0];
const scientificArticle = (
  id: string,
  values: Partial<ScientificArticle> & Pick<ScientificArticle, "title">,
): ScientificArticle => ({ ...emptyArticle("pubmed", values.title, id), ...values });
const input = (
  articleId: string,
  values: Partial<ScientificArticle> & Pick<ScientificArticle, "title">,
  currentTopics: CurrentTopicAssociation[] = [],
): TopicDryRunArticle => ({
  articleId,
  article: scientificArticle(articleId, values),
  currentTopics,
});
const association = (
  slug: string,
  associationType: "automatic" | "editorial",
  values: Partial<CurrentTopicAssociation> = {},
): CurrentTopicAssociation => ({
  topicId: topicId(slug),
  associationType,
  confidence: associationType === "automatic" ? 0.8 : null,
  method: associationType === "automatic" ? "deterministic_rules" : null,
  evidence: associationType === "automatic" ? [{ field: "title", term: "old" }] : [],
  ruleVersion: associationType === "automatic" ? "old-version" : null,
  ...values,
});
const plan = (item: TopicDryRunArticle) =>
  dryRunArticleTopicReclassification(
    item,
    validateTopicRuleSnapshot(TOPIC_RULES_V1_CLASSIFIER_FIXTURE),
  );

test("new match is proposed as an addition with evidence and confidence", () => {
  const result = plan(input("new", { title: "Heart failure" }));
  assert.equal(result.desiredAutomaticTopics.length, 1);
  assert.equal(result.automaticTopicsToAdd[0].topicId, topicId("insuficiencia-cardiaca"));
  assert.equal(result.classificationEvidence[0].confidence, 0.8);
  assert.deepEqual(result.classificationEvidence[0].evidence, [
    { field: "title", term: "heart failure" },
  ]);
});

test("old automatic survivor updates while an obsolete old automatic is removed", () => {
  const result = plan(
    input("old", { title: "Heart failure" }, [
      association("insuficiencia-cardiaca", "automatic"),
      association("diabetes", "automatic"),
    ]),
  );
  assert.deepEqual(result.automaticTopicsToUpdate[0].reasons, [
    "rule_version_changed",
    "evidence_changed",
  ]);
  assert.equal(result.automaticTopicsToRemove[0].current.topicId, topicId("diabetes"));
});

test("identical current automatic match remains unchanged", () => {
  const article = scientificArticle("same", { title: "Heart failure" });
  const desired = classifyArticleTopics(article, TOPIC_RULES_V1_CLASSIFIER_FIXTURE)[0];
  const result = plan(
    input("same", article, [
      {
        topicId: desired.topicId,
        associationType: "automatic",
        confidence: desired.confidence,
        method: desired.method,
        evidence: desired.evidence,
        ruleVersion: desired.ruleVersion,
      },
    ]),
  );
  assert.equal(result.unchangedAutomaticTopics.length, 1);
  assert.equal(result.automaticTopicsToUpdate.length, 0);
});

test("empty desired set removes automatics and preserves editorials", () => {
  const result = plan(
    input("empty", { title: "Unrelated basic science" }, [
      association("diabetes", "automatic"),
      association("hepatologia", "editorial"),
    ]),
  );
  assert.deepEqual(result.desiredAutomaticTopics, []);
  assert.equal(result.automaticTopicsToRemove.length, 1);
  assert.equal(result.editorialTopicsPreserved.length, 1);
  assert.deepEqual(result.warnings, [{ code: "no_topic_match" }]);
});

test("editorial match covers desired topic without add, update, removal, or conversion", () => {
  const result = plan(
    input("editorial", { title: "Heart failure and type 2 diabetes" }, [
      association("insuficiencia-cardiaca", "editorial"),
      association("diabetes", "automatic"),
    ]),
  );
  assert.equal(result.desiredAutomaticTopics.length, 2);
  assert.equal(result.automaticTopicsToAdd.length, 0);
  assert.equal(result.automaticTopicsToUpdate.length, 1);
  assert.equal(result.automaticTopicsToRemove.length, 0);
  assert.equal(result.editorialTopicsPreserved[0].topicId, topicId("insuficiencia-cardiaca"));
  assert.deepEqual(result.warnings, [
    {
      code: "desired_topic_covered_by_editorial",
      topicId: topicId("insuficiencia-cardiaca"),
    },
  ]);
});

test("missing abstract, keyword-only, and MeSH-only articles remain classifiable", () => {
  assert.equal(
    plan(input("title", { title: "Heart failure", abstract: null })).automaticTopicsToAdd.length,
    1,
  );
  assert.equal(
    plan(input("keyword", { title: "Generic", keywords: ["Heart failure"] }))
      .classificationEvidence[0].evidence[0].field,
    "keyword",
  );
  assert.equal(
    plan(input("mesh", { title: "Generic", meshTerms: ["Heart Failure"] }))
      .classificationEvidence[0].evidence[0].field,
    "mesh",
  );
});

test("snapshot validation rejects duplicates, mixed versions, invalid rules, and noncanonical IDs", () => {
  const rules = TOPIC_RULES_V1_CLASSIFIER_FIXTURE;
  assert.throws(
    () => validateTopicRuleSnapshot([...rules.slice(0, -1), rules[0]]),
    /unique topic IDs/,
  );
  assert.throws(() =>
    validateTopicRuleSnapshot(
      rules.map((rule, index) => (index ? rule : { ...rule, version: "old" })),
    ),
  );
  assert.throws(() =>
    validateTopicRuleSnapshot(
      rules.map((rule, index) => (index ? rule : { ...rule, preferredTerms: [""] })),
    ),
  );
  assert.throws(
    () =>
      validateTopicRuleSnapshot(
        rules.map((rule, index) => (index ? rule : { ...rule, topicId: "unknown" })),
      ),
    /not in the canonical/,
  );
});

test("batch rejects duplicate articles and produces stable order and exact aggregate metrics", () => {
  const articles = [
    input("b", { title: "Heart failure and atrial fibrillation" }),
    input("a", { title: "Unrelated science" }, [association("diabetes", "automatic")]),
    input("c", { title: "Type 2 diabetes" }, [
      association("diabetes", "editorial"),
      association("hepatologia", "automatic"),
    ]),
  ];
  assert.throws(
    () =>
      dryRunTopicReclassificationBatch(
        [articles[0], articles[0]],
        TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
      ),
    /unique article IDs/,
  );
  const first = dryRunTopicReclassificationBatch(articles, TOPIC_RULES_V1_CLASSIFIER_FIXTURE);
  const second = dryRunTopicReclassificationBatch(
    [...articles].reverse(),
    TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
  );
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.articles.map((item) => item.articleId),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    {
      articlesEvaluated: first.metrics.articlesEvaluated,
      articlesWithMatches: first.metrics.articlesWithMatches,
      articlesWithoutMatches: first.metrics.articlesWithoutMatches,
      totalDesiredAutomaticTopics: first.metrics.totalDesiredAutomaticTopics,
      additions: first.metrics.additions,
      updates: first.metrics.updates,
      removals: first.metrics.removals,
      unchanged: first.metrics.unchanged,
      editorialAssociationsPreserved: first.metrics.editorialAssociationsPreserved,
      multiTopicArticles: first.metrics.multiTopicArticles,
      confidenceDistribution: first.metrics.confidenceDistribution,
    },
    {
      articlesEvaluated: 3,
      articlesWithMatches: 2,
      articlesWithoutMatches: 1,
      totalDesiredAutomaticTopics: 3,
      additions: 2,
      updates: 0,
      removals: 2,
      unchanged: 0,
      editorialAssociationsPreserved: 1,
      multiTopicArticles: 1,
      confidenceDistribution: { "0.80": 3 },
    },
  );
  assert.equal(first.metrics.matchesByTopic[topicId("insuficiencia-cardiaca")], 1);
  assert.equal(first.metrics.matchesByTopic[topicId("fibrilacao-atrial")], 1);
  assert.equal(first.metrics.matchesByTopic[topicId("diabetes")], 1);
});

test("dry-run reproduces all 96 Gate 2 classifications without divergence", () => {
  const batch = dryRunTopicReclassificationBatch(
    TOPIC_RULES_V1_CORPUS.map((scenario) => input(scenario.id, scenario.article)),
    TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
  );
  const expectedById = new Map(
    TOPIC_RULES_V1_CORPUS.map((scenario) => [
      scenario.id,
      [...scenario.expectedSlugs].map(topicId).sort(),
    ]),
  );
  for (const articlePlan of batch.articles)
    assert.deepEqual(
      articlePlan.desiredAutomaticTopics.map((match) => match.topicId).sort(),
      expectedById.get(articlePlan.articleId),
      articlePlan.articleId,
    );
  assert.deepEqual(
    {
      articlesEvaluated: batch.metrics.articlesEvaluated,
      articlesWithMatches: batch.metrics.articlesWithMatches,
      articlesWithoutMatches: batch.metrics.articlesWithoutMatches,
      totalDesiredAutomaticTopics: batch.metrics.totalDesiredAutomaticTopics,
      additions: batch.metrics.additions,
      updates: batch.metrics.updates,
      removals: batch.metrics.removals,
      unchanged: batch.metrics.unchanged,
      editorialAssociationsPreserved: batch.metrics.editorialAssociationsPreserved,
      multiTopicArticles: batch.metrics.multiTopicArticles,
      confidenceDistribution: batch.metrics.confidenceDistribution,
    },
    {
      articlesEvaluated: 96,
      articlesWithMatches: 72,
      articlesWithoutMatches: 24,
      totalDesiredAutomaticTopics: 84,
      additions: 84,
      updates: 0,
      removals: 0,
      unchanged: 0,
      editorialAssociationsPreserved: 0,
      multiTopicArticles: 12,
      confidenceDistribution: { "0.65": 12, "0.80": 72 },
    },
  );
});

test("dry-run module has no database client, RPC, SQL write, or fixture dependency", async () => {
  const source = await readFile(
    "src/server/scientific/topic-reclassification-dry-run.server.ts",
    "utf8",
  );
  assert.match(source, /^import "\.\/server-only";/);
  assert.doesNotMatch(source, /topic-rules\.v1\.fixture/);
  assert.doesNotMatch(
    source,
    /\.rpc\s*\(|\.from\s*\(|\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b/i,
  );
  assert.doesNotMatch(source, /reconcile_automatic_article_topics/);
  assert.doesNotMatch(source, /SupabaseClient|service.role|userId/i);
});
