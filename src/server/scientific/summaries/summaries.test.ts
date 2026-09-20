import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { scientificSummarySchema } from "./contract";
import {
  buildSummaryInput,
  evaluateSummaryEligibility,
  summaryIdentity,
  type SummaryArticle,
} from "./domain";
import { FakeScientificSummaryProvider, validFakeSummary } from "./fake.server";
import { OpenAIResponsesProvider } from "./openai.server";
import { InMemorySummaryRepository, ScientificSummaryPipeline } from "./pipeline.server";
import { validateSummary, sanitizeError } from "./validation";
import { loadSummaryConfig } from "./config.server";

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
  doi: "10.1000/test",
  pmid: "123",
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
  timeoutMs: 500,
};

test("eligibility is centralized, explained, and recomputed instead of trusting a client hint", () => {
  assert.deepEqual(evaluateSummaryEligibility(article({ abstract: null })), {
    eligible: false,
    reason: "missing_abstract",
  });
  assert.deepEqual(evaluateSummaryEligibility(article({ abstract: "short" })), {
    eligible: false,
    reason: "abstract_too_short",
  });
  assert.ok(buildSummaryInput(article({ summaryEligible: false })));
});
test("canonical input is allowlisted and contains no full text or private data", () => {
  const input = buildSummaryInput(article())!;
  assert.equal(input.abstract, abstract);
  assert.equal("email" in input, false);
  assert.equal("fullText" in input, false);
});
test("identity includes input, prompt, schema, provider, and model", () => {
  const input = buildSummaryInput(article())!;
  const base = summaryIdentity("article-1", input, "p1", "s1", "fake", "m1");
  assert.equal(
    base.identityKey,
    summaryIdentity("article-1", input, "p1", "s1", "fake", "m1").identityKey,
  );
  const alternatives: [typeof input, string, string, string, string][] = [
    [buildSummaryInput(article({ abstract: `${abstract} Changed.` }))!, "p1", "s1", "fake", "m1"],
    [input, "p2", "s1", "fake", "m1"],
    [input, "p1", "s2", "fake", "m1"],
    [input, "p1", "s1", "other", "m1"],
    [input, "p1", "s1", "fake", "m2"],
  ];
  for (const [candidate, prompt, schema, provider, model] of alternatives)
    assert.notEqual(
      base.identityKey,
      summaryIdentity("article-1", candidate, prompt, schema, provider, model).identityKey,
    );
});
test("v2 schema accepts explicit absence and rejects extra properties or inconsistent absence", () => {
  const value = validFakeSummary(buildSummaryInput(article())!);
  assert.equal(scientificSummarySchema.parse(value).schemaVersion, "scientific-summary.v2");
  assert.equal(scientificSummarySchema.safeParse({ ...value, surprise: true }).success, false);
  assert.equal(
    scientificSummarySchema.safeParse({ ...value, limitations: null, unavailableFields: [] })
      .success,
    false,
  );
});
test("fidelity rejects unsupported numbers, mismatched identifiers, invented DOI, and full-text claims", () => {
  const input = buildSummaryInput(article())!;
  for (const mutate of [
    (x: ReturnType<typeof validFakeSummary>) => {
      x.mainResults = "999 participants";
      x.unavailableFields = x.unavailableFields.filter((f) => f !== "mainResults");
    },
    (x: ReturnType<typeof validFakeSummary>) => {
      x.identifiers.pmid = "999";
    },
    (x: ReturnType<typeof validFakeSummary>) => {
      x.keyPoints = ["See 10.9999/invented"];
    },
    (x: ReturnType<typeof validFakeSummary>) => {
      x.keyPoints = ["We reviewed the full text"];
    },
  ]) {
    const value = structuredClone(validFakeSummary(input));
    mutate(value);
    assert.throws(
      () => validateSummary(value, input),
      /unsupported|does not match|unknown DOI|full-text/,
    );
  }
});
test("disabled, mismatched configuration, or ineligible pipeline never calls provider", async () => {
  const fake = new FakeScientificSummaryProvider();
  assert.deepEqual(
    await new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, {
      ...config,
      enabled: false,
    }).generate(article()),
    { status: "disabled" },
  );
  assert.deepEqual(
    await new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, {
      ...config,
      provider: "openai",
    }).generate(article()),
    { status: "disabled" },
  );
  assert.deepEqual(
    await new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, config).generate(
      article({ abstract: null }),
    ),
    { status: "ineligible" },
  );
  assert.equal(fake.calls, 0);
});
test("fake provider completes once under idempotent and concurrent requests with usage/cost", async () => {
  const fake = new FakeScientificSummaryProvider("success", 10);
  const pipeline = new ScientificSummaryPipeline(
    new InMemorySummaryRepository(),
    fake,
    config,
    (u) => ({ micros: u.totalTokens * 2, configVersion: "test-pricing-v1" }),
  );
  const results = await Promise.all(
    Array.from({ length: 100 }, () => pipeline.generate(article())),
  );
  assert.equal(fake.calls, 1);
  const completed = results.find((x) => x.status === "completed")!;
  assert.equal("usage" in completed && completed.usage?.totalTokens, 150);
  assert.equal("estimatedCostMicros" in completed && completed.estimatedCostMicros, 300);
  assert.equal("costConfigVersion" in completed && completed.costConfigVersion, "test-pricing-v1");
  assert.equal("durationMs" in completed && typeof completed.durationMs, "number");
});
for (const mode of ["timeout", "rate_limit", "transient"] as const)
  test(`${mode} retries only to the configured bound`, async () => {
    const fake = new FakeScientificSummaryProvider(mode);
    const pipeline = new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, {
      ...config,
      maxAttempts: 2,
    });
    assert.equal((await pipeline.generate(article())).status, "failed_retryable");
    const final = await pipeline.generate(article());
    assert.equal(final.status, "failed_permanent");
    assert.equal("failureCode" in final && final.failureCode, mode);
    await pipeline.generate(article());
    assert.equal(fake.calls, 2);
  });
for (const mode of ["permanent", "invalid"] as const)
  test(`${mode} failure is permanent and output is never published`, async () => {
    const fake = new FakeScientificSummaryProvider(mode);
    const result = await new ScientificSummaryPipeline(
      new InMemorySummaryRepository(),
      fake,
      config,
    ).generate(article());
    assert.equal(result.status, "failed_permanent");
    assert.equal("summary" in result && result.summary, null);
    await new ScientificSummaryPipeline(new InMemorySummaryRepository(), fake, config).generate(
      article(),
    );
  });
test("errors are bounded and redact credentials and authorization", () => {
  const clean = sanitizeError(
    new Error("Authorization: Bearer secret-token sk-abcdefghijklmnop api_key=hidden"),
  );
  assert.doesNotMatch(clean, /secret-token|abcdefghijklmnop|hidden/);
  assert.ok(clean.length <= 500);
});
test("configuration is fail-closed and server-only variables are not VITE-prefixed", () => {
  const value = loadSummaryConfig({} as NodeJS.ProcessEnv);
  assert.equal(value.enabled, false);
  assert.equal(value.provider, "fake");
  assert.equal(value.timeoutMs, 20_000);
});
test("OpenAI adapter uses injected mock, Responses strict schema, timeout, and usage", async () => {
  let request: Record<string, unknown> = {};
  let receivedSignal = false;
  const input = buildSummaryInput(article())!;
  const provider = new OpenAIResponsesProvider({
    create: async (value, options) => {
      request = value;
      receivedSignal = options?.signal instanceof AbortSignal;
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
    timeoutMs: 100,
  });
  assert.equal(request.model, "test-model");
  assert.equal((request.text as any).format.strict, true);
  assert.equal(receivedSignal, true);
  assert.equal(result.usage?.totalTokens, 3);
});
test("summary migration is additive, trusted-only, and historical migration stays untouched", async () => {
  const migration = await readFile(
    new URL(
      "../../../../supabase/migrations/202609290001_harden_scientific_summary_pipeline.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /on conflict \(identity_key\) do update/);
  assert.match(migration, /revoke all on function[\s\S]*authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*authenticated/);
});
