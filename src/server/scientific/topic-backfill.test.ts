import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { TOPIC_V1 } from "../../lib/scientific-catalog";
import { emptyArticle } from "./parse-utils";
import {
  executeTopicBackfillBatch,
  MAX_TOPIC_BACKFILL_BATCH_SIZE,
  TOPIC_BACKFILL_APPLY_CONFIRMATION,
  type TopicBackfillRequest,
} from "./topic-backfill.server";
import type {
  CurrentTopicAssociation,
  TopicDryRunArticle,
} from "./topic-reclassification-dry-run.server";
import { TOPIC_RULE_VERSION } from "./topic-rule-contract";
import {
  TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
  TOPIC_RULES_V1_FIXTURE,
} from "./topic-rules.v1.fixture";

const topicId = (slug: string) => TOPIC_V1.find((topic) => topic[1] === slug)![0];
const association = (
  slug: string,
  associationType: "automatic" | "editorial",
): CurrentTopicAssociation => ({
  topicId: topicId(slug),
  associationType,
  confidence: associationType === "automatic" ? 0.6 : null,
  method: associationType === "automatic" ? "deterministic_rules" : null,
  evidence: associationType === "automatic" ? [{ field: "abstract", term: "old" }] : [],
  ruleVersion: associationType === "automatic" ? "old-version" : null,
});
const article = (
  articleId: string,
  title: string,
  currentTopics: CurrentTopicAssociation[] = [],
): TopicDryRunArticle => ({
  articleId,
  article: emptyArticle("pubmed", title, articleId),
  currentTopics,
});
const applyRequest: TopicBackfillRequest = {
  mode: "apply",
  expectedRuleVersion: TOPIC_RULE_VERSION,
  explicitConfirmation: TOPIC_BACKFILL_APPLY_CONFIRMATION,
};
const clock = () => new Date("2026-09-19T12:00:00.000Z");

function statefulClient(articles: TopicDryRunArticle[], rejectArticleId?: string) {
  const calls: Array<Record<string, any>> = [];
  return {
    calls,
    client: {
      async rpc(name: string, payload: Record<string, any>) {
        calls.push({ name, payload });
        if (payload.p_article_id === rejectArticleId)
          return { error: new Error("sensitive remote error") };
        const target = articles.find((item) => item.articleId === payload.p_article_id)!;
        const editorial = target.currentTopics.filter(
          (item) => item.associationType === "editorial",
        );
        const editorialIds = new Set(editorial.map((item) => item.topicId));
        const automatic = payload.p_matches
          .filter((match: any) => !editorialIds.has(match.topic_id))
          .map((match: any): CurrentTopicAssociation => ({
            topicId: match.topic_id,
            associationType: "automatic",
            confidence: match.confidence,
            method: match.method,
            evidence: match.evidence,
            ruleVersion: match.rule_version,
          }));
        const currentTopics = target.currentTopics as CurrentTopicAssociation[];
        currentTopics.splice(0, currentTopics.length, ...editorial, ...automatic);
        return { error: null };
      },
    },
  };
}

test("activation migration is semantically identical to the approved fixture", async () => {
  const sql = await readFile(
    "supabase/migrations/202609260001_activate_topic_rules_v1.sql",
    "utf8",
  );
  const encoded = sql.match(/\$topic_rules\$\s*([\s\S]*?)\s*\$topic_rules\$/)?.[1];
  assert.ok(encoded);
  const targets = JSON.parse(encoded!);
  assert.equal(targets.length, 12);
  assert.equal(new Set(targets.map((target: any) => target.id)).size, 12);
  assert.deepEqual(
    targets.map((target: any) => ({
      id: target.id,
      slug: target.slug,
      specialty_id: target.specialty_id,
      rules: target.rules,
    })),
    TOPIC_V1.map(([id, slug, , specialtyId]) => ({
      id,
      slug,
      specialty_id: specialtyId,
      rules: TOPIC_RULES_V1_FIXTURE[slug],
    })),
  );
  assert.match(sql, /jsonb_array_length\(expected\) <> 12/);
  assert.match(sql, /matched_count <> 12/);
  assert.match(sql, /updated_count <> 12/);
  assert.doesNotMatch(
    sql,
    /article_topics|reconcile_automatic_article_topics|insert into|delete from|alter table|grant |revoke /i,
  );
});

test("activation migration fails closed before updating a mismatched catalog", async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(`
      create schema extensions; create schema auth;
      create role anon; create role authenticated; create role service_role bypassrls;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    for (const file of [
      "202609170001_foundation.sql",
      "202609200001_scientific_ingestion.sql",
      "202609210001_scientific_feed.sql",
      "202609230001_canonical_scientific_catalog.sql",
    ]) {
      let migration = await readFile(`supabase/migrations/${file}`, "utf8");
      migration = migration
        .replace("create extension if not exists pgcrypto with schema extensions;", "")
        .replaceAll("extensions.gen_random_uuid()", "gen_random_uuid()");
      await db.exec(migration);
    }
    await db.query("update public.topics set is_active=false where id=$1", [TOPIC_V1[0][0]]);
    const activation = await readFile(
      "supabase/migrations/202609260001_activate_topic_rules_v1.sql",
      "utf8",
    );
    await assert.rejects(db.exec(activation), /canonical topic catalog does not match/);
    assert.equal(
      (await db.query("select * from public.topics where classification_rules is not null")).rows
        .length,
      0,
    );
    await db.query("update public.topics set is_active=true where id=$1", [TOPIC_V1[0][0]]);
    await db.exec(activation);
    assert.equal(
      (await db.query("select * from public.topics where classification_rules is not null")).rows
        .length,
      12,
    );
  } finally {
    await db.close();
  }
});

test("dry-run is the default and never calls RPC", async () => {
  const articles = [article("a", "Heart failure")];
  const state = statefulClient(articles);
  const report = await executeTopicBackfillBatch(
    state.client as never,
    articles,
    TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
    {},
    clock,
  );
  assert.equal(report.mode, "dry_run");
  assert.equal(report.results[0].status, "planned");
  assert.equal(report.metrics.articlesApplied, 0);
  assert.equal(state.calls.length, 0);
});

test("apply requires the exact confirmation and rule version before any RPC", async () => {
  const articles = [article("a", "Heart failure")];
  const state = statefulClient(articles);
  for (const request of [
    { mode: "apply" },
    {
      mode: "apply",
      explicitConfirmation: TOPIC_BACKFILL_APPLY_CONFIRMATION,
      expectedRuleVersion: "wrong-version",
    },
  ])
    await assert.rejects(
      executeTopicBackfillBatch(
        state.client as never,
        articles,
        TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
        request as never,
        clock,
      ),
      /explicit topic backfill confirmation/,
    );
  assert.equal(state.calls.length, 0);
});

test("apply is idempotent, upgrades old versions, removes stale automatic, and preserves editorial", async () => {
  const articles = [
    article("a", "Heart failure", [
      association("insuficiencia-cardiaca", "automatic"),
      association("diabetes", "automatic"),
      association("hepatologia", "editorial"),
    ]),
  ];
  const state = statefulClient(articles);
  const first = await executeTopicBackfillBatch(
    state.client as never,
    articles,
    TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
    applyRequest,
    clock,
  );
  assert.equal(first.metrics.updates, 1);
  assert.equal(first.metrics.removals, 1);
  assert.equal(first.metrics.editorialPreserved, 1);
  assert.deepEqual(
    articles[0].currentTopics
      .map((item) => [item.topicId, item.associationType, item.ruleVersion])
      .sort(),
    [
      [topicId("hepatologia"), "editorial", null],
      [topicId("insuficiencia-cardiaca"), "automatic", TOPIC_RULE_VERSION],
    ].sort(),
  );
  const second = await executeTopicBackfillBatch(
    state.client as never,
    articles,
    TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
    applyRequest,
    clock,
  );
  assert.equal(second.metrics.unchanged, 1);
  assert.equal(second.metrics.updates, 0);
  assert.equal(second.metrics.removals, 0);
  assert.equal(articles[0].currentTopics.length, 2);
  assert.equal(state.calls.length, 2);
  assert.ok(state.calls.every((call) => call.name === "reconcile_automatic_article_topics"));
});

test("desired empty removes automatic and preserves editorial through the RPC payload", async () => {
  const articles = [
    article("a", "Unrelated science", [
      association("diabetes", "automatic"),
      association("hepatologia", "editorial"),
    ]),
  ];
  const state = statefulClient(articles);
  const report = await executeTopicBackfillBatch(
    state.client as never,
    articles,
    TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
    applyRequest,
    clock,
  );
  assert.equal(report.metrics.removals, 1);
  assert.equal(report.metrics.editorialPreserved, 1);
  assert.deepEqual(state.calls[0].payload.p_matches, []);
  assert.deepEqual(articles[0].currentTopics, [association("hepatologia", "editorial")]);
});

test("batch is bounded, deterministic, rejects duplicates, and reports partial RPC failure", async () => {
  const articles = [
    article("c", "Type 2 diabetes"),
    article("a", "Heart failure"),
    article("b", "Obesity"),
  ];
  const state = statefulClient(articles, "b");
  await assert.rejects(
    executeTopicBackfillBatch(
      state.client as never,
      [articles[0], articles[0]],
      TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
      {},
      clock,
    ),
    /unique article IDs/,
  );
  await assert.rejects(
    executeTopicBackfillBatch(
      state.client as never,
      articles,
      TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
      { batchSize: MAX_TOPIC_BACKFILL_BATCH_SIZE + 1 },
      clock,
    ),
    /batchSize/,
  );
  const report = await executeTopicBackfillBatch(
    state.client as never,
    articles,
    TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
    applyRequest,
    clock,
  );
  assert.deepEqual(
    report.results.map((item) => [item.articleId, item.status]),
    [
      ["a", "applied"],
      ["b", "failed"],
      ["c", "not_attempted"],
    ],
  );
  assert.equal(report.results[1].errorCode, "topic_reconciliation_failed");
  assert.equal(JSON.stringify(report).includes("sensitive remote error"), false);
  assert.equal(report.metrics.articlesPlanned, 3);
  assert.equal(report.metrics.articlesApplied, 1);
  assert.equal(report.metrics.articlesFailed, 1);
  assert.equal(report.nextCursor, "a");
  assert.equal(state.calls.length, 2);
});

test("backfill service is server-only, database rules stay authoritative, and article writes use only RPC", async () => {
  const source = await readFile("src/server/scientific/topic-backfill.server.ts", "utf8");
  assert.match(source, /^import "\.\/server-only";/);
  assert.match(source, /loadActiveTopicRules\(client\)/);
  assert.match(source, /read_scientific_reclassification_batch/);
  assert.match(source, /reconcileAutomaticTopics\(/);
  assert.doesNotMatch(source, /topic-rules\.v1\.fixture|userId|service_role/i);
  assert.doesNotMatch(source, /\.from\(|\.select\(|\binsert\s+into\b|\bdelete\s+from\b/i);
});
