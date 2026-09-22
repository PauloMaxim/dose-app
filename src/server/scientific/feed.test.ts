import assert from "node:assert/strict";
import test from "node:test";
import { classifyScientificArticle } from "./classification";
import { buildScientificFeed, type FeedArticle } from "./feed";
import { scientificCatalogRows } from "./feed-service.server";
import { classifyArticleTopics, type TopicRule } from "./topics";
import { emptyArticle } from "./parse-utils";
const rule: TopicRule = {
  topicId: "hf",
  specialtyId: "cardio",
  version: "1",
  preferredTerms: ["heart failure"],
  synonyms: ["cardiac failure"],
  meshTerms: ["Heart Failure"],
  requiredTerms: ["failure"],
  exclusionTerms: ["fiction"],
  ambiguousTerms: ["failure"],
  publicationTypes: ["Cardiology"],
  journals: ["Heart"],
};
const article = (id: string, v: any = {}): FeedArticle => ({
  ...emptyArticle("pubmed", "Heart failure treatment study", id),
  id,
  abstract: "heart failure outcomes",
  publishedAt: "2026-08-01",
  language: "eng",
  authors: [],
  publicationTypes: ["Randomized Controlled Trial"],
  keywords: [],
  meshTerms: [],
  journal: null,
  ...v,
  topics: [],
});
for (const [name, values, field] of [
  ["title", { title: "Heart failure trial" }, "title"],
  ["abstract", { title: "Other", abstract: "heart failure therapy" }, "abstract"],
  ["keyword", { title: "Other", abstract: "failure", keywords: ["heart failure"] }, "keyword"],
  ["MeSH", { title: "Other", abstract: "failure", meshTerms: ["Heart Failure"] }, "mesh"],
  ["synonym", { title: "Cardiac failure trial" }, "title"],
] as const)
  test(`${name} match`, () =>
    assert.ok(
      classifyArticleTopics(article("x", values), [rule])[0].evidence.some(
        (e) => e.field === field,
      ),
    ));
test("required, exclusion and isolated ambiguous terms", () => {
  assert.equal(
    classifyArticleTopics(article("a", { title: "Heart study", abstract: "" }), [rule]).length,
    0,
  );
  assert.equal(
    classifyArticleTopics(article("b", { title: "Heart failure fiction" }), [rule]).length,
    0,
  );
  assert.equal(
    classifyArticleTopics(article("c", { title: "Failure only", abstract: "" }), [rule]).length,
    0,
  );
});
test("multiple topics and derived specialty", () => {
  const second = { ...rule, topicId: "renal", specialtyId: "nephro" };
  const out = classifyArticleTopics(article("x"), [rule, second]);
  assert.deepEqual(out.map((x) => x.specialtyId).sort(), ["cardio", "nephro"]);
});
test("study classification remains deterministic", () =>
  assert.equal(classifyScientificArticle(article("x")).studyType, "randomized_trial"));
const classified = (
  id: string,
  specialty = "cardio",
  days = "2026-08-01",
  abstract: string | null = "text",
): FeedArticle => {
  const a = article(id, {
    publishedAt: days,
    abstract,
    title: "A sufficiently long scientific article title that remains useful without an abstract",
  });
  return {
    ...a,
    topics: [
      {
        topicId: specialty === "cardio" ? "hf" : "cancer",
        specialtyId: specialty,
        confidence: 0.8,
        method: "deterministic_rules",
        ruleVersion: "1",
        evidence: [{ field: "title", term: "heart failure" }],
      },
    ],
  };
};
test("different interests create different candidate sets and incompatible stays out", () => {
  const xs = [classified("a"), classified("b", "oncology")];
  assert.deepEqual(
    buildScientificFeed(
      xs,
      { specialtyIds: ["cardio"], topicIds: [] },
      {},
      { asOf: "2026-09-18" },
    ).items.map((x) => x.article.id),
    ["a"],
  );
  assert.deepEqual(
    buildScientificFeed(
      xs,
      { specialtyIds: ["oncology"], topicIds: [] },
      {},
      { asOf: "2026-09-18" },
    ).items.map((x) => x.article.id),
    ["b"],
  );
});
test("missing abstract is feed eligible but separately not summary eligible", () => {
  const x = buildScientificFeed(
    [classified("a", "cardio", "2026-08-01", null)],
    { specialtyIds: ["cardio"], topicIds: [] },
    {},
    { asOf: "2026-09-18" },
  ).items[0];
  assert.equal(x.feedEligible, true);
  assert.equal(x.summaryEligible, false);
});
test("scientific feed boundary excludes dose_catalog-only rows without demo fallback", () => {
  const catalog = [{ id: "demo" }, { id: "real" }, { id: "mixed" }];
  const eligible = scientificCatalogRows(catalog, [
    { article_id: "demo", provider: "dose_catalog" },
    { article_id: "real", provider: "pubmed" },
    { article_id: "mixed", provider: "dose_catalog" },
    { article_id: "mixed", provider: "crossref" },
  ]);

  assert.deepEqual(
    eligible.map((article) => article.id),
    ["real", "mixed"],
  );
  assert.equal(
    eligible.some((article) => article.id === "demo"),
    false,
  );
  assert.deepEqual(scientificCatalogRows(catalog, []), []);

  const feed = buildScientificFeed(
    eligible.map((article) => classified(article.id)),
    { specialtyIds: ["cardio"], topicIds: [] },
    {},
    { asOf: "2026-09-18" },
  );
  assert.deepEqual(
    feed.items.map((item) => item.article.id),
    ["mixed", "real"],
  );
});
test("recent and classics are separate", () => {
  const xs = [classified("new"), classified("old", "cardio", "2020-01-01")],
    p = { specialtyIds: ["cardio"], topicIds: [] };
  assert.deepEqual(
    buildScientificFeed(xs, p, {}, { asOf: "2026-09-18", mode: "recent" }).items.map(
      (x) => x.article.id,
    ),
    ["new"],
  );
  assert.deepEqual(
    buildScientificFeed(xs, p, {}, { asOf: "2026-09-18", mode: "classics" }).items.map(
      (x) => x.article.id,
    ),
    ["old"],
  );
});
test("explanation, stable tie break and all 19 paginate without duplicates", () => {
  const xs = Array.from({ length: 19 }, (_, i) => classified(String(i).padStart(2, "0"))),
    p = { specialtyIds: ["cardio"], topicIds: [] };
  let cursor: string | undefined;
  const ids: string[] = [];
  do {
    const page = buildScientificFeed(xs, p, {}, { asOf: "2026-09-18", pageSize: 4, cursor });
    ids.push(...page.items.map((x) => x.article.id));
    assert.ok(
      page.items.every(
        (x) =>
          x.matchedTopics[0].confidence === 0.8 &&
          x.scoreComponents.topicMatch > 0 &&
          x.scoreTotal ===
            Object.values(x.scoreComponents).reduce((sum, value) => sum + value, 0) &&
          x.rankingVersion === page.rankingVersion,
      ),
    );
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(ids.length, 19);
  assert.equal(new Set(ids).size, 19);
  assert.deepEqual(ids, [...ids].sort());
});
test("cursor is opaque, snapshot-bound, mode-bound, and fails closed", () => {
  const xs = [classified("a"), classified("b")];
  const preferences = { specialtyIds: ["cardio"], topicIds: [] };
  const first = buildScientificFeed(
    xs,
    preferences,
    {},
    {
      asOf: "2026-09-18",
      pageSize: 1,
      mode: "recent",
    },
  );
  assert.ok(first.nextCursor);
  assert.doesNotMatch(first.nextCursor!, /\{|\[|"articleId"/);
  assert.throws(() =>
    buildScientificFeed(
      xs,
      preferences,
      {},
      {
        asOf: "2026-09-18",
        cursor: "not-a-valid-cursor",
      },
    ),
  );
  assert.throws(() =>
    buildScientificFeed(
      xs,
      preferences,
      {},
      {
        asOf: "2026-09-18",
        cursor: first.nextCursor!,
        mode: "classics",
      },
    ),
  );
  assert.throws(() =>
    buildScientificFeed(
      xs,
      preferences,
      {},
      {
        asOf: "2026-09-19",
        cursor: first.nextCursor!,
        mode: "recent",
      },
    ),
  );
});
test("trusted classification is recomputed", () => {
  const x: any = classified("x");
  x.classification = {
    studyType: "editorial",
    evidenceLevel: "very_low",
    ruleVersion: "3b.1",
    matchedTerm: null,
  };
  assert.equal(
    buildScientificFeed([x], { specialtyIds: ["cardio"], topicIds: [] }, {}, { asOf: "2026-09-18" })
      .items[0].classification.studyType,
    "randomized_trial",
  );
});
test("automatic and editorial contracts are distinguishable without AI", () => {
  const m = classifyArticleTopics(article("x"), [rule])[0];
  assert.equal(m.method, "deterministic_rules");
  assert.ok(!JSON.stringify(m).match(/embedding|llm|generative/i));
});

test("schema and reconciler preserve editorial and make automatic associations idempotent", async () => {
  const { readFile } = await import("node:fs/promises");
  const migration = await readFile("supabase/migrations/202609210001_scientific_feed.sql", "utf8");
  const atomicMigration = await readFile(
    "supabase/migrations/202609250001_harden_topic_reconciliation_validation.sql",
    "utf8",
  );
  const reconciler = await readFile("src/server/scientific/topic-persistence.server.ts", "utf8");
  assert.match(migration, /association_type.*editorial.*automatic/s);
  assert.match(migration, /method text/);
  assert.match(migration, /evidence jsonb/);
  assert.match(migration, /rule_version text/);
  assert.match(reconciler, /reconcile_automatic_article_topics/);
  assert.match(atomicMigration, /association_type = 'automatic'/);
  assert.match(atomicMigration, /where article_topics\.association_type = 'automatic'/);
  assert.match(atomicMigration, /for update/);
});

test("production feed is session-bound and contains no AI integration", async () => {
  const { readFile } = await import("node:fs/promises");
  const boundary = await readFile("src/server/scientific/feed-service.ts", "utf8");
  const service = await readFile("src/server/scientific/feed-service.server.ts", "utf8");
  assert.match(boundary, /authMiddleware/);
  assert.match(boundary, /readScientificFeedForAuthenticatedUser\(data, context\)/);
  assert.match(service, /context\.userId/);
  assert.doesNotMatch(`${boundary}\n${service}`, /userId.*input/);
  const implementation = await readFile("src/server/scientific/topics.ts", "utf8");
  assert.doesNotMatch(implementation, /openai|anthropic|embedding|vector/i);
});
