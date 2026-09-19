import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { TOPIC_RULE_VERSION, storedTopicRuleSchema } from "./topic-rule-contract";
import { reconcileAutomaticTopics } from "./topic-persistence.server";
import { loadActiveTopicRules, parseActiveTopicRules } from "./topic-rules.server";
import type { TopicMatch } from "./topics";

const validRule = { version: TOPIC_RULE_VERSION, preferredTerms: ["heart failure"] };
const topic = (values: Record<string, unknown> = {}) => ({
  id: "32000000-0000-4000-8000-000000000001",
  specialty_id: "31000000-0000-4000-8000-000000000001",
  is_active: true,
  classification_rules: validRule,
  ...values,
});

test("applied atomic migration stays immutable and hardening is a later replacement", async () => {
  const original = await readFile(
    "supabase/migrations/202609240001_atomic_topic_reconciliation.sql",
    "utf8",
  );
  const hardening = await readFile(
    "supabase/migrations/202609250001_harden_topic_reconciliation_validation.sql",
    "utf8",
  );
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    "f87dcf008f257f8770ee2c1d280008a1e80d8699770c36263c5a9397ab40303b",
  );
  assert.match(hardening, /create or replace function public\.reconcile_automatic_article_topics/);
  assert.match(hardening, /grant execute .* to service_role/);
});

test("strict rule contract accepts valid evidence and rejects malformed rules", () => {
  assert.deepEqual(storedTopicRuleSchema.parse(validRule), validRule);
  for (const invalid of [
    null,
    {},
    { preferredTerms: ["heart failure"] },
    { ...validRule, version: "" },
    { ...validRule, version: "another-version" },
    { ...validRule, preferredTerms: "heart failure" },
    { ...validRule, preferredTerms: [1] },
    { ...validRule, preferredTerms: ["   "] },
    { version: TOPIC_RULE_VERSION, requiredTerms: ["heart"] },
    { ...validRule, unknown: true },
    { ...validRule, topicId: "untrusted" },
    { ...validRule, ambiguousTerms: ["HF"] },
    { ...validRule, exclusionTerms: ["heart failure"] },
  ])
    assert.equal(storedTopicRuleSchema.safeParse(invalid).success, false);
});

test("catalog rows are authoritative and inactive entities fail closed", () => {
  const specialty = "31000000-0000-4000-8000-000000000001";
  const rows = [
    topic(),
    topic({ id: "null-rule", classification_rules: null }),
    topic({ id: "inactive-topic", is_active: false }),
    topic({ id: "inactive-specialty", specialty_id: "inactive" }),
    topic({ id: "transverse", specialty_id: null }),
  ];
  const rules = parseActiveTopicRules(rows, new Set([specialty]));
  assert.deepEqual(
    rules.map(({ topicId, specialtyId }) => [topicId, specialtyId]),
    [
      ["32000000-0000-4000-8000-000000000001", specialty],
      ["transverse", null],
    ],
  );
  assert.equal(rules[0].version, TOPIC_RULE_VERSION);
});

test("one invalid active catalog rule rejects the complete snapshot", () => {
  assert.throws(() =>
    parseActiveTopicRules(
      [topic(), topic({ id: "bad", classification_rules: { ...validRule, extra: true } })],
      new Set(["31000000-0000-4000-8000-000000000001"]),
    ),
  );
});

test("loader uses the allowlisted read RPC and returns classifier-ready rules", async () => {
  const calls: string[] = [];
  const client = {
    async rpc(name: string) {
      calls.push(name);
      return {
        data: [
          {
            topic_id: topic().id,
            topic_slug: "insuficiencia-cardiaca",
            topic_name: "Insuficiência cardíaca",
            topic_is_active: true,
            specialty_id: null,
            specialty_slug: null,
            specialty_name: null,
            specialty_is_active: null,
            classification_rules: validRule,
          },
        ],
        error: null,
      };
    },
  };
  const rules = await loadActiveTopicRules(client as never);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].topicId, topic().id);
  assert.equal(rules[0].specialtyId, null);
  assert.deepEqual(calls, ["read_scientific_topic_rule_snapshot"]);
});

test("reconciler rejects inconsistent versions and duplicate topics before the RPC", async () => {
  let called = false;
  const client = { rpc: async () => ((called = true), { error: null }) };
  const match = automaticMatch("32000000-0000-4000-8000-000000000001", "old");
  await assert.rejects(
    reconcileAutomaticTopics(client as never, ARTICLE_ID, TOPIC_RULE_VERSION, [match]),
    /expected rule version/,
  );
  await assert.rejects(
    reconcileAutomaticTopics(client as never, ARTICLE_ID, "old", [match, match]),
    /unique topic IDs/,
  );
  assert.equal(called, false);
});

const ARTICLE_ID = "41000000-0000-4000-8000-000000000001";
const TOPIC_A = "42000000-0000-4000-8000-000000000001";
const TOPIC_B = "42000000-0000-4000-8000-000000000002";
const TOPIC_C = "42000000-0000-4000-8000-000000000003";
const automaticMatch = (topicId: string, ruleVersion: string = TOPIC_RULE_VERSION): TopicMatch => ({
  topicId,
  specialtyId: null,
  confidence: 0.8,
  method: "deterministic_rules",
  ruleVersion,
  evidence: [{ field: "title", term: "heart failure" }],
});

let db: PGlite;
before(async () => {
  db = new PGlite();
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
    "202609240001_atomic_topic_reconciliation.sql",
    "202609250001_harden_topic_reconciliation_validation.sql",
  ]) {
    let migration = await readFile(`supabase/migrations/${file}`, "utf8");
    migration = migration
      .replace("create extension if not exists pgcrypto with schema extensions;", "")
      .replaceAll("extensions.gen_random_uuid()", "gen_random_uuid()");
    await db.exec(migration);
  }
  await db.exec(`
    grant select, insert, update, delete on public.articles, public.article_topics to service_role;
    insert into public.specialties (id,slug,name) values
      ('43000000-0000-4000-8000-000000000001','test','Test');
    insert into public.topics (id,slug,name) values
      ('${TOPIC_A}','a','A'), ('${TOPIC_B}','b','B'), ('${TOPIC_C}','c','C');
    insert into public.articles (id,title) values ('${ARTICLE_ID}','Atomic test');
  `);
});
after(async () => db?.close());

async function callRpc(matches: TopicMatch[], version = TOPIC_RULE_VERSION) {
  return db.query("select public.reconcile_automatic_article_topics($1, $2, $3::jsonb)", [
    ARTICLE_ID,
    version,
    JSON.stringify(
      matches.map((match) => ({
        topic_id: match.topicId,
        confidence: match.confidence,
        method: match.method,
        evidence: match.evidence,
        rule_version: match.ruleVersion,
      })),
    ),
  ]);
}

async function associations() {
  return (
    await db.query(
      "select topic_id,association_type,confidence::float,rule_version from public.article_topics where article_id=$1 order by topic_id",
      [ARTICLE_ID],
    )
  ).rows;
}

test("atomic RPC preserves editorial, removes stale versions, updates survivors, and is idempotent", async () => {
  await db.exec(`
    insert into public.article_topics(article_id,topic_id,association_type,confidence,method,evidence,rule_version) values
      ('${ARTICLE_ID}','${TOPIC_A}','editorial',null,null,'[]',null),
      ('${ARTICLE_ID}','${TOPIC_B}','automatic',0.6,'deterministic_rules','[{"field":"abstract","term":"old"}]','old'),
      ('${ARTICLE_ID}','${TOPIC_C}','automatic',0.7,'deterministic_rules','[{"field":"abstract","term":"old"}]','old');
  `);
  await callRpc([automaticMatch(TOPIC_A), automaticMatch(TOPIC_B)]);
  const once = await associations();
  assert.deepEqual(once, [
    { topic_id: TOPIC_A, association_type: "editorial", confidence: null, rule_version: null },
    {
      topic_id: TOPIC_B,
      association_type: "automatic",
      confidence: 0.8,
      rule_version: TOPIC_RULE_VERSION,
    },
  ]);
  await callRpc([automaticMatch(TOPIC_A), automaticMatch(TOPIC_B)]);
  assert.deepEqual(await associations(), once);

  await callRpc([]);
  assert.deepEqual(await associations(), [once[0]]);
});

test("invalid replacement rolls back deletion and inconsistent versions are rejected", async () => {
  await callRpc([automaticMatch(TOPIC_B)]);
  const beforeFailure = await associations();
  await assert.rejects(
    callRpc([automaticMatch(TOPIC_C), automaticMatch("ffffffff-ffff-4fff-8fff-ffffffffffff")]),
  );
  assert.deepEqual(await associations(), beforeFailure);
  await assert.rejects(callRpc([automaticMatch(TOPIC_C, "old")]), /invalid automatic topic match/);
  assert.deepEqual(await associations(), beforeFailure);
});

test("malformed RPC payloads fail closed before any automatic association changes", async () => {
  const beforeFailure = await associations();
  for (const [matches, error] of [
    [{}, /matches must be a JSON array/],
    [["not-an-object"], /invalid automatic topic match/],
    [
      [
        {
          topic_id: TOPIC_C,
          confidence: 0.8,
          method: "deterministic_rules",
          evidence: "not-an-array",
          rule_version: TOPIC_RULE_VERSION,
        },
      ],
      /invalid automatic topic match/,
    ],
    [
      [
        {
          topic_id: "not-a-uuid",
          confidence: 0.8,
          method: "deterministic_rules",
          evidence: [{ field: "title", term: "heart failure" }],
          rule_version: TOPIC_RULE_VERSION,
        },
      ],
      /invalid topic id/,
    ],
  ] as const) {
    await assert.rejects(
      db.query("select public.reconcile_automatic_article_topics($1, $2, $3::jsonb)", [
        ARTICLE_ID,
        TOPIC_RULE_VERSION,
        JSON.stringify(matches),
      ]),
      error,
    );
    assert.deepEqual(await associations(), beforeFailure);
  }
});

test("atomic RPC is not executable by authenticated or anonymous roles", async () => {
  for (const role of ["authenticated", "anon"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(callRpc([]), /permission denied/i);
    } finally {
      await db.exec("reset role");
    }
  }
});
