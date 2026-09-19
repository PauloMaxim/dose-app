import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  scientificReclassificationBatchSchema,
  topicRuleSnapshotSchema,
} from "./scientific-read-api.server";
import { TOPIC_RULE_VERSION } from "./topic-rule-contract";

const migrationPath = "supabase/migrations/202609270001_scientific_dry_run_read_api.sql";
const ARTICLE_A = "41000000-0000-4000-8000-000000000001";
const ARTICLE_B = "41000000-0000-4000-8000-000000000002";

async function foundationDatabase() {
  const db = new PGlite();
  await db.waitReady;
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
    "202609260001_activate_topic_rules_v1.sql",
    "202609270001_scientific_dry_run_read_api.sql",
  ]) {
    let sql = await readFile(`supabase/migrations/${file}`, "utf8");
    sql = sql
      .replace("create extension if not exists pgcrypto with schema extensions;", "")
      .replaceAll("extensions.gen_random_uuid()", "gen_random_uuid()");
    await db.exec(sql);
  }
  return db;
}

test("read RPC migration is allowlisted, read-only, deterministic, and service-role only", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /security definer/gi);
  assert.equal(sql.match(/set search_path = ''/g)?.length, 2);
  assert.doesNotMatch(sql, /\bexecute\s+format\b|\bformat\s*\(|\binsert\b|\bupdate\b|\bdelete\b|\btruncate\b/i);
  assert.doesNotMatch(sql, /reconcile_automatic_article_topics|grant\s+select/i);
  assert.match(sql, /revoke all .* from public/gi);
  assert.match(sql, /revoke execute .* from anon, authenticated/gi);
  assert.equal(sql.match(/grant execute .* to service_role/g)?.length, 2);
  for (const privateField of [
    "profile",
    "email",
    "user_id",
    "interest",
    "note",
    "saved_articles",
    "reading_progress",
    "subscription",
    "payment",
    "entitlement",
  ])
    assert.doesNotMatch(sql, new RegExp(privateField, "i"));
});

test("runtime schemas reject malformed rules, private/unknown fields, and unordered payloads", () => {
  const topic = {
    topic_id: "32000000-0000-4000-8000-000000000001",
    topic_slug: "insuficiencia-cardiaca",
    topic_name: "Insuficiência cardíaca",
    topic_is_active: true,
    specialty_id: null,
    specialty_slug: null,
    specialty_name: null,
    specialty_is_active: null,
    classification_rules: { version: TOPIC_RULE_VERSION, preferredTerms: ["heart failure"] },
  };
  assert.equal(topicRuleSnapshotSchema.parse([topic]).length, 1);
  assert.throws(() => topicRuleSnapshotSchema.parse([{ ...topic, email: "private@example.test" }]));
  assert.throws(() =>
    topicRuleSnapshotSchema.parse([{ ...topic, classification_rules: { version: TOPIC_RULE_VERSION } }]),
  );

  const article = {
    article_id: ARTICLE_A,
    title: "Heart failure",
    abstract: null,
    keywords: [],
    mesh_terms: [],
    publication_types: [],
    journal: null,
    associations: [],
  };
  assert.deepEqual(scientificReclassificationBatchSchema.parse([article])[0].associations, []);
  assert.throws(() => scientificReclassificationBatchSchema.parse([{ ...article, user_id: ARTICLE_B }]));
  assert.throws(() =>
    scientificReclassificationBatchSchema.parse([
      { ...article, article_id: ARTICLE_B },
      article,
    ]),
  );
});

test("database RPCs enforce permissions, cursor and limits, and ordered association aggregation", async () => {
  const db = await foundationDatabase();
  try {
    const privileges = await db.query<{ role: string; snapshot: boolean; batch: boolean }>(`
      select role,
        has_function_privilege(role, 'public.read_scientific_topic_rule_snapshot()', 'execute') snapshot,
        has_function_privilege(role, 'public.read_scientific_reclassification_batch(uuid,integer)', 'execute') batch
      from unnest(array['anon','authenticated','service_role']) role order by role
    `);
    assert.deepEqual(privileges.rows, [
      { role: "anon", snapshot: false, batch: false },
      { role: "authenticated", snapshot: false, batch: false },
      { role: "service_role", snapshot: true, batch: true },
    ]);

    await db.exec(`
      insert into public.articles (id, title) values
        ('${ARTICLE_A}', 'First article'), ('${ARTICLE_B}', 'Second article');
      insert into public.article_topics
        (article_id, topic_id, association_type, confidence, method, evidence, rule_version)
      values
        ('${ARTICLE_B}', '32000000-0000-4000-8000-000000000002', 'automatic', 0.7,
          'deterministic_rules', '[{"field":"title","term":"obesity"}]', '${TOPIC_RULE_VERSION}'),
        ('${ARTICLE_B}', '32000000-0000-4000-8000-000000000001', 'editorial', null,
          'editorial', '[]', null);
    `);

    await db.exec("set role service_role");
    const snapshot = await db.query("select * from public.read_scientific_topic_rule_snapshot()");
    assert.equal(snapshot.rows.length, 12);
    assert.deepEqual(
      snapshot.rows.map((row: any) => row.topic_id),
      [...snapshot.rows.map((row: any) => row.topic_id)].sort(),
    );
    await assert.rejects(
      db.query("select * from public.read_scientific_reclassification_batch(null, 0)"),
      /limit must be between/,
    );
    await assert.rejects(
      db.query("select * from public.read_scientific_reclassification_batch(null, 101)"),
      /limit must be between/,
    );
    const first = await db.query<{ article_id: string; associations: Array<{ topic_id: string }> }>(
      "select * from public.read_scientific_reclassification_batch(null, 1)",
    );
    assert.equal(first.rows[0].article_id, ARTICLE_A);
    assert.deepEqual(first.rows[0].associations, []);
    const second = await db.query<{ article_id: string; associations: Array<{ topic_id: string }> }>(
      `select * from public.read_scientific_reclassification_batch('${ARTICLE_A}', 50)`,
    );
    assert.equal(second.rows[0].article_id, ARTICLE_B);
    assert.deepEqual(
      second.rows[0].associations.map((association: any) => association.topic_id),
      [
        "32000000-0000-4000-8000-000000000001",
        "32000000-0000-4000-8000-000000000002",
      ],
    );
  } finally {
    await db.exec("reset role").catch(() => undefined);
    await db.close();
  }
});

test("production read loaders use only read RPCs and dry-run planner has no write dependency", async () => {
  const [rules, backfill, dryRun] = await Promise.all([
    readFile("src/server/scientific/topic-rules.server.ts", "utf8"),
    readFile("src/server/scientific/topic-backfill.server.ts", "utf8"),
    readFile("src/server/scientific/topic-reclassification-dry-run.server.ts", "utf8"),
  ]);
  assert.match(rules, /read_scientific_topic_rule_snapshot/);
  assert.match(backfill, /read_scientific_reclassification_batch/);
  for (const source of [rules, backfill]) {
    assert.doesNotMatch(source, /\.from\(|\.select\(|topic-rules\.v1\.fixture/);
  }
  assert.doesNotMatch(dryRun, /reconcileAutomaticTopics|reconcile_automatic_article_topics|\.rpc\(/);
});
