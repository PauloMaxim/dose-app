import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { TopicBackfillReport } from "./topic-backfill.server";
import {
  createTopicDryRunDependencies,
  handleTopicDryRunRequest,
  type TopicDryRunDependencies,
} from "./topic-backfill-dry-run.server";
import { TOPIC_RULE_VERSION } from "./topic-rule-contract";

const TOKEN = "a-secure-scientific-token-that-is-long-enough";
const ARTICLE_ID = "4ba24232-1d9c-405c-bf4e-42cedc6073f5";
const emptyReport: TopicBackfillReport = {
  mode: "dry_run",
  ruleVersion: TOPIC_RULE_VERSION,
  startedAt: "2026-09-23T00:00:00.000Z",
  completedAt: "2026-09-23T00:00:00.000Z",
  nextCursor: ARTICLE_ID,
  results: [],
  metrics: {
    articlesPlanned: 0,
    articlesApplied: 0,
    articlesFailed: 0,
    additions: 0,
    updates: 0,
    removals: 0,
    unchanged: 0,
    editorialPreserved: 0,
    multiTopicArticles: 0,
    matchesByTopic: {},
    confidenceDistribution: {},
    ruleVersion: TOPIC_RULE_VERSION,
  },
};

const request = (body: unknown, authorization: string | null = `Bearer ${TOKEN}`) => ({
  method: "POST",
  authorization,
  body,
});

function dependencies(
  run: TopicDryRunDependencies["run"] = async () => emptyReport,
): TopicDryRunDependencies {
  return { expectedToken: TOKEN, run };
}

test("authentication is mandatory and the runner is not reached when unauthorized", async () => {
  let called = false;
  const response = await handleTopicDryRunRequest(
    request({ batchSize: 1 }, null),
    dependencies(async () => {
      called = true;
      return emptyReport;
    }),
  );
  assert.deepEqual(response, { status: 401, body: { ok: false, error: "unauthorized" } });
  assert.equal(called, false);
});

test("invalid requests, apply mode, unknown fields, and the existing batch limit are rejected", async () => {
  for (const body of [
    {},
    { batchSize: 0 },
    { batchSize: 101 },
    { batchSize: 1.5 },
    { batchSize: 1, mode: "apply" },
    { batchSize: 1, afterArticleId: "not-a-uuid" },
    { batchSize: 1, unexpected: true },
  ]) {
    const response = await handleTopicDryRunRequest(request(body), dependencies());
    assert.deepEqual(response, { status: 400, body: { ok: false, error: "invalid_request" } });
  }
});

test("the endpoint always forces dry_run and preserves the backfill report", async () => {
  let received: unknown;
  const plan = {
    planVersion: "3b.3d-v1" as const,
    articleId: ARTICLE_ID,
    ruleVersion: TOPIC_RULE_VERSION,
    currentAutomaticTopics: [],
    currentEditorialTopics: [],
    desiredAutomaticTopics: [],
    automaticTopicsToAdd: [],
    automaticTopicsToUpdate: [],
    automaticTopicsToRemove: [],
    unchangedAutomaticTopics: [],
    editorialTopicsPreserved: [],
    classificationEvidence: [],
    warnings: [{ code: "no_topic_match" as const }],
  };
  const report: TopicBackfillReport = {
    ...emptyReport,
    results: [{ articleId: ARTICLE_ID, status: "planned", plan }],
  };
  const response = await handleTopicDryRunRequest(
    request({ batchSize: 7, afterArticleId: ARTICLE_ID }),
    dependencies(async (options) => {
      received = options;
      return report;
    }),
  );
  assert.deepEqual(received, {
    mode: "dry_run",
    batchSize: 7,
    afterArticleId: ARTICLE_ID,
  });
  assert.deepEqual(response, { status: 200, body: { ok: true, report } });
  assert.equal(response.body.ok && response.body.report.results[0].plan, plan);
});

test("production dependency performs only rule and article reads before a failed dry-run", async () => {
  const calls: Array<{ name: string; payload: unknown }> = [];
  const client = {
    async rpc(name: string, payload: unknown) {
      calls.push({ name, payload });
      if (name === "read_scientific_topic_rule_snapshot") return { data: [], error: null };
      if (name === "read_scientific_reclassification_batch") return { data: [], error: null };
      throw new Error(`unexpected RPC: ${name}`);
    },
  };
  const response = await handleTopicDryRunRequest(
    request({ batchSize: 1 }),
    createTopicDryRunDependencies(client as never, TOKEN),
  );
  assert.equal(response.status, 500);
  assert.deepEqual(
    calls.map(({ name }) => name).sort(),
    ["read_scientific_reclassification_batch", "read_scientific_topic_rule_snapshot"].sort(),
  );
  assert.ok(calls.every(({ name }) => name !== "reconcile_automatic_article_topics"));
  assert.ok(calls.every(({ name }) => name.startsWith("read_")));
  assert.equal(JSON.stringify(calls).includes("article_topics"), false);
});

test("route and service remain server-only with no apply or write path", async () => {
  const [route, service] = await Promise.all([
    readFile("server/api/scientific-topic-dry-run.post.ts", "utf8"),
    readFile("src/server/scientific/topic-backfill-dry-run.server.ts", "utf8"),
  ]);
  assert.match(route, /defineEventHandler/);
  assert.match(route, /authorization/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|src\/components|src\/routes/);
  assert.match(service, /^import "\.\/server-only";/);
  assert.match(service, /runTopicBackfillBatch\(client, request\)/);
  assert.doesNotMatch(service, /reconcileAutomaticTopics|reconcile_automatic_article_topics/);
  assert.doesNotMatch(service, /\.from\(|\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(service, /mode:\s*"apply"/);
});
