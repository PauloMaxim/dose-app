import assert from "node:assert/strict";
import test from "node:test";
import { buildSummaryInput, summaryIdentity } from "./domain";
import { FakeScientificSummaryProvider, validFakeSummary } from "./fake.server";
import { OpenAIResponsesProvider } from "./openai.server";
import { InMemorySummaryRepository, ScientificSummaryPipeline } from "./pipeline.server";
import { validateSummary, sanitizeError } from "./validation";
import { loadSummaryConfig } from "./config.server";
import type { SummaryArticle } from "./domain";

const abstract =
  "In a randomized study of 100 adults, the intervention was compared with placebo. Improvement was 20% versus 10%. Authors report uncertainty and recommend additional research.";
const article = (changes: Partial<SummaryArticle> = {}): SummaryArticle => ({
  id: "article-1",
  title: "A trial",
  abstract,
  authors: [{ given: "Ana", family: "Silva", collectiveName: null, orcid: null }],
  journal: "Journal",
  publisher: null,
  publishedAt: "2026-01-01",
  doi: "10.1/test",
  pmid: "1",
  pmcid: null,
  language: "en",
  publicationTypes: ["Trial"],
  volume: null,
  issue: null,
  pages: null,
  originalUrl: "https://example.test/article",
  pubmedUrl: null,
  pmcUrl: null,
  doiUrl: null,
  keywords: ["health"],
  meshTerms: [],
  discoveredBy: "pubmed",
  provenance: [],
  ingestedAt: null,
  updatedAt: null,
  summaryEligible: true,
  studyType: "randomized_trial",
  evidenceLevel: "moderate",
  ...changes,
});
const config = {
  enabled: true,
  provider: "fake",
  model: "fake-v1",
  maxInputCharacters: 30_000,
  maxOutputTokens: 2_000,
  maxAttempts: 3,
};

test("eligible article creates allowlisted input without private data", () => {
  const input = buildSummaryInput(article())!;
  assert.equal(input.abstract, abstract);
  assert.equal(input.articleId, "article-1");
  assert.equal("email" in input, false);
});
test("ineligible and insufficient abstracts create no input", () => {
  assert.equal(buildSummaryInput(article({ summaryEligible: false })), null);
  assert.equal(buildSummaryInput(article({ abstract: "short" })), null);
});
test("identity changes for content, prompt, schema, provider, and model", () => {
  const i = buildSummaryInput(article())!;
  const base = summaryIdentity("article-1", i, "p1", "s1", "fake", "m1");
  assert.equal(
    base.identityKey,
    summaryIdentity("article-1", i, "p1", "s1", "fake", "m1").identityKey,
  );
  const alternatives: [typeof i, string, string, string, string][] = [
    [buildSummaryInput(article({ abstract: `${abstract} Changed.` }))!, "p1", "s1", "fake", "m1"],
    [i, "p2", "s1", "fake", "m1"],
    [i, "p1", "s2", "fake", "m1"],
    [i, "p1", "s1", "other", "m1"],
    [i, "p1", "s1", "fake", "m2"],
  ];
  for (const args of alternatives)
    assert.notEqual(base.identityKey, summaryIdentity("article-1", ...args).identityKey);
});
test("valid structured nullable fields, arrays, and source scope pass", () => {
  const input = buildSummaryInput(article())!;
  const value = validateSummary(validFakeSummary(input), input);
  assert.equal(value.objective, null);
  assert.deepEqual(value.keyNumbers, []);
  assert.deepEqual(value.technicalTerms, []);
  assert.equal(value.sourceScope, "abstract_and_metadata");
});
test("invalid output and unsupported numeric claims are rejected", () => {
  const input = buildSummaryInput(article())!;
  assert.throws(() => validateSummary({}, input));
  const value = validFakeSummary(input);
  value.keyNumbers = [{ label: "sample", value: "999", context: null }];
  assert.throws(() => validateSummary(value, input), /unsupported/);
});
test("disabled or ineligible pipeline never calls provider", async () => {
  const fake = new FakeScientificSummaryProvider();
  const disabled = new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, {
    ...config,
    enabled: false,
  });
  assert.deepEqual(await disabled.generate(article()), { status: "disabled" });
  const enabled = new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, config);
  assert.deepEqual(await enabled.generate(article({ summaryEligible: false })), {
    status: "ineligible",
  });
  assert.equal(fake.calls, 0);
});
test("completed input is cached and token usage/cost are recorded", async () => {
  const fake = new FakeScientificSummaryProvider();
  const pipeline = new ScientificSummaryPipeline(
    new InMemorySummaryRepository(),
    fake,
    config,
    (u) => u.totalTokens * 2,
  );
  const a = await pipeline.generate(article());
  const b = await pipeline.generate(article());
  assert.equal(fake.calls, 1);
  assert.deepEqual(a, b);
  assert.equal("usage" in a && a.usage?.cachedTokens, 10);
  assert.equal("estimatedCostMicros" in a && a.estimatedCostMicros, 300);
  assert.equal("articleId" in a && a.articleId, "article-1");
});
test("content changes invalidate cache", async () => {
  const fake = new FakeScientificSummaryProvider();
  const pipeline = new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, config);
  await pipeline.generate(article());
  await pipeline.generate(article({ abstract: `${abstract} More context.` }));
  assert.equal(fake.calls, 2);
});
test("100 concurrent consumers produce one provider execution", async () => {
  const fake = new FakeScientificSummaryProvider("success", 10);
  const pipeline = new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, config);
  const results = await Promise.all(
    Array.from({ length: 100 }, () => pipeline.generate(article())),
  );
  assert.equal(fake.calls, 1);
  assert.equal(
    new Set(
      results.filter((r) => "identityKey" in r).map((r) => "identityKey" in r && r.identityKey),
    ).size,
    1,
  );
});
for (const mode of ["timeout", "rate_limit", "transient"] as const)
  test(`${mode} is retryable and retry count is limited`, async () => {
    const fake = new FakeScientificSummaryProvider(mode);
    const pipeline = new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, {
      ...config,
      maxAttempts: 2,
    });
    assert.equal((await pipeline.generate(article())).status, "failed_retryable");
    assert.equal((await pipeline.generate(article())).status, "failed_permanent");
    await pipeline.generate(article());
    assert.equal(fake.calls, 2);
  });
test("invalid provider output is permanent and never published", async () => {
  const result = await new ScientificSummaryPipeline(
    new InMemorySummaryRepository(),
    new FakeScientificSummaryProvider("invalid"),
    config,
  ).generate(article());
  assert.equal(result.status, "failed_permanent");
  assert.equal("summary" in result && result.summary, null);
});
test("errors are sanitized and bounded", () => {
  const clean = sanitizeError(new Error("Bearer secret-token sk-abcdefghijklmnop api_key=hidden"));
  assert.equal(clean.includes("secret-token"), false);
  assert.ok(clean.length <= 500);
});
test("configuration defaults closed without an OpenAI key", () => {
  const c = loadSummaryConfig({} as NodeJS.ProcessEnv);
  assert.equal(c.enabled, false);
  assert.equal(c.provider, "fake");
});
test("OpenAI adapter prepares Responses strict schema via injected mock only", async () => {
  let request: Record<string, unknown> = {};
  const input = buildSummaryInput(article())!;
  const provider = new OpenAIResponsesProvider({
    create: async (value) => {
      request = value;
      return {
        output_text: JSON.stringify(validFakeSummary(input)),
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      };
    },
  });
  const result = await provider.generateScientificSummary(input, {
    model: "test-model",
    maxOutputTokens: 500,
    promptVersion: "p",
    schemaVersion: "s",
  });
  assert.equal(request.model, "test-model");
  assert.equal((request.text as any).format.strict, true);
  assert.equal(result.usage?.totalTokens, 3);
});
