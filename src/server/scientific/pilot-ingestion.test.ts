import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ScientificHttpError } from "./http";
import { emptyArticle } from "./parse-utils";
import {
  handleScientificPilotRequest,
  type PilotDependencies,
  type PilotOperationStore,
  type PilotReport,
} from "./pilot-ingestion.server";
import type { ScientificArticle } from "./types";

const TOKEN = "dedicated-pilot-token-at-least-32-characters";
const KEY = "pilot_operation_0001";
const body = { operationKey: KEY, limit: 10, dateFrom: "2026-01-01", dateTo: "2026-09-30" };

function article(id: string, doi?: string): ScientificArticle {
  const value = emptyArticle("pubmed", `Scientific article ${id}`, id);
  value.pmid = id;
  value.doi = doi ?? null;
  value.abstract = "Allowed API-supplied abstract";
  return value;
}

function memoryStore(): PilotOperationStore {
  const records = new Map<
    string,
    { requestHash: string; status: "running" | "completed" | "failed"; report: PilotReport | null }
  >();
  return {
    async claim(operationKey, requestHash) {
      const existing = records.get(operationKey);
      if (existing) return { claimed: false, existing };
      records.set(operationKey, { requestHash, status: "running", report: null });
      return { claimed: true };
    },
    async finish(operationKey, status, report) {
      const existing = records.get(operationKey)!;
      records.set(operationKey, { ...existing, status, report });
    },
  };
}

function dependencies(values: Partial<PilotDependencies> = {}): PilotDependencies {
  return {
    expectedToken: TOKEN,
    query: "heart failure randomized trial",
    operations: memoryStore(),
    discover: async () => [article("123")],
    persist: async (articles) => ({
      found: articles.length,
      new: articles.length,
      updated: 0,
      reconciled: 0,
      failed: 0,
      errors: [],
    }),
    now: (() => {
      let value = 100;
      return () => (value += 25);
    })(),
    ...values,
  };
}

const request = (values: Record<string, unknown> = {}) => ({
  method: "POST",
  authorization: `Bearer ${TOKEN}`,
  body,
  ...values,
});

test("pilot endpoint fails closed for method, authorization, and malformed payloads", async () => {
  const deps = dependencies();
  assert.equal((await handleScientificPilotRequest(request({ method: "GET" }), deps)).status, 405);
  assert.equal(
    (await handleScientificPilotRequest(request({ authorization: null }), deps)).status,
    401,
  );
  assert.equal(
    (await handleScientificPilotRequest(request({ authorization: "Bearer wrong" }), deps)).status,
    401,
  );
  for (const invalid of [
    null,
    {},
    { ...body, operationKey: "short" },
    { ...body, operationKey: undefined },
    { ...body, limit: 21 },
    { ...body, dateFrom: "invalid" },
    { ...body, dateFrom: "2027-01-01", dateTo: "2026-01-01" },
    { ...body, dateFrom: "2024-01-01", dateTo: "2026-01-01" },
    { ...body, unexpected: true },
  ])
    assert.equal(
      (await handleScientificPilotRequest(request({ body: invalid }), deps)).status,
      400,
    );
  assert.equal(
    (
      await handleScientificPilotRequest(
        request({ body: { ...body, unexpected: "x".repeat(3_000) } }),
        deps,
      )
    ).status,
    413,
  );
  assert.equal(
    (await handleScientificPilotRequest(request(), dependencies({ query: " " }))).status,
    503,
  );
});

test("same operation replays safely and conflicting or concurrent requests do not execute", async () => {
  const store = memoryStore();
  let discoveries = 0;
  const deps = dependencies({
    operations: store,
    discover: async () => ((discoveries += 1), [article("123")]),
  });
  const first = await handleScientificPilotRequest(request(), deps);
  const replay = await handleScientificPilotRequest(request(), deps);
  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(discoveries, 1);
  assert.equal(
    (await handleScientificPilotRequest(request({ body: { ...body, limit: 9 } }), deps)).body.error,
    "operation_key_conflict",
  );

  let release!: () => void;
  const blocked = new Promise<void>((resolve) => (release = resolve));
  const concurrentDeps = dependencies({
    operations: memoryStore(),
    discover: async () => (await blocked, [article("456")]),
  });
  const running = handleScientificPilotRequest(request(), concurrentDeps);
  await Promise.resolve();
  const concurrent = await handleScientificPilotRequest(request(), concurrentDeps);
  assert.equal(concurrent.status, 409);
  release();
  assert.equal((await running).status, 200);
});

test("pilot deduplicates before persistence and reports partial persistence without content", async () => {
  let persisted = 0;
  let persistenceOperationKey: string | undefined;
  const deps = dependencies({
    discover: async () => [article("123", "10.1000/same"), article("456", "10.1000/same")],
    persist: async (articles, operationKey) => {
      persisted = articles.length;
      persistenceOperationKey = operationKey;
      return {
        found: 1,
        new: 0,
        updated: 0,
        reconciled: 0,
        failed: 1,
        errors: ["sensitive database detail"],
      };
    },
  });
  const response = await handleScientificPilotRequest(request(), deps);
  assert.equal(response.status, 200);
  assert.equal(persisted, 1);
  assert.equal(persistenceOperationKey, KEY);
  assert.deepEqual(response.body.report?.errors, ["persistence_error"]);
  assert.equal(response.body.report?.discovered, 2);
  assert.equal(response.body.report?.deduplicated, 1);
  assert.equal(response.body.report?.skipped, 1);
  const encoded = JSON.stringify(response);
  assert.doesNotMatch(
    encoded,
    /Allowed API-supplied abstract|sensitive database detail|dedicated-pilot-token/,
  );
  assert.doesNotMatch(encoded, /full.?text/i);
});

test("timeouts, 429, and 5xx are sanitized and never attempt persistence", async () => {
  for (const error of [
    Object.assign(new Error("secret timeout detail"), { name: "AbortError" }),
    new ScientificHttpError("secret rate response", 429),
    new ScientificHttpError("secret upstream response", 503),
  ]) {
    let persisted = false;
    const response = await handleScientificPilotRequest(
      request({
        body: {
          ...body,
          operationKey: `${KEY}_${error.name}_${String((error as ScientificHttpError).status ?? 0)}`,
        },
      }),
      dependencies({
        discover: async () => Promise.reject(error),
        persist: async () => (
          (persisted = true),
          { found: 0, new: 0, updated: 0, reconciled: 0, failed: 0, errors: [] }
        ),
      }),
    );
    assert.equal(response.status, 502);
    assert.equal(persisted, false);
    assert.doesNotMatch(JSON.stringify(response), /secret/);
  }
});

test("endpoint and migration remain server-only, bounded, and decoupled from classification", async () => {
  const [route, service, migration] = await Promise.all([
    readFile("server/api/scientific-pilot.post.ts", "utf8"),
    readFile("src/server/scientific/pilot-ingestion.server.ts", "utf8"),
    readFile("supabase/migrations/202609280001_scientific_ingestion_operations.sql", "utf8"),
  ]);
  assert.match(route, /defineEventHandler/);
  assert.match(route, /authorization/);
  assert.doesNotMatch(route, /src\/components|src\/routes|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(service, /^import "\.\/server-only";/);
  assert.match(service, /SCIENTIFIC_PILOT_MAX_LIMIT = 20/);
  assert.match(service, /timeoutMs: 8_000, retries: 1/);
  assert.doesNotMatch(
    service,
    /classifyArticleTopics|reconcileAutomaticTopics|topic-rules\.v1\.fixture|full.?text/i,
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant .* to anon|grant .* to authenticated/i);
});

test("scientific persistence grants only the table operations used by ingestion", async () => {
  const migration = await readFile(
    "supabase/migrations/202610020001_scientific_service_role_grants.sql",
    "utf8",
  );

  assert.match(
    migration,
    /grant select, insert, update on table public\.articles to service_role;/i,
  );
  assert.match(
    migration,
    /grant select, insert, update on table public\.article_sources to service_role;/i,
  );
  assert.doesNotMatch(migration, /\b(delete|truncate|references|trigger)\b/i);
  assert.doesNotMatch(migration, /\b(anon|authenticated)\b/i);
  assert.doesNotMatch(migration, /\b(disable|policy|security\s+definer)\b/i);
  assert.doesNotMatch(
    migration,
    /\b(article_topics|article_summaries|scientific_ingestion_operations)\b/i,
  );
});
