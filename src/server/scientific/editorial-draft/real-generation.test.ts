import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { scientificEditorialDraftJsonSchema } from "./contracts";
import {
  DEFAULT_SCIENTIFIC_EDITORIAL_MAX_OUTPUT_TOKENS,
  DEFAULT_SCIENTIFIC_EDITORIAL_MODEL,
  loadScientificEditorialConfig,
} from "./config.server";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";
import {
  OpenAIScientificEditorialProvider,
  ScientificEditorialProviderError,
  type OpenAIEditorialTransport,
} from "./openai.server";
import {
  runRealEditorialGeneration,
  SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID,
} from "./real-generation.server";
import { SCIENTIFIC_EDITORIAL_PROMPT_VERSION, SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT } from "./prompt";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "../knowledge-representation/pmid-42717033.fixture";

const input = {
  sourceSet: pmid42717033SourceSet,
  evidenceSet: pmid42717033EvidenceSet,
  factSet: pmid42717033FactSet,
  interpretationArtifact: pmid42717033Interpretation,
  contextualMaterial: [],
};
const providerRequest = {
  promptVersion: SCIENTIFIC_EDITORIAL_PROMPT_VERSION,
  systemPrompt: SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
  input,
};
const config = {
  apiKey: "test-only-not-a-secret",
  model: "test-model",
  timeoutMs: 50,
  maxInputCharacters: 120_000,
  maxOutputTokens: 25_000,
};

test("editorial config defaults to gpt-6-sol without invoking a provider", () => {
  const loaded = loadScientificEditorialConfig({ OPENAI_API_KEY: "test-only" });
  assert.equal(DEFAULT_SCIENTIFIC_EDITORIAL_MODEL, "gpt-6-sol");
  assert.equal(DEFAULT_SCIENTIFIC_EDITORIAL_MAX_OUTPUT_TOKENS, 25_000);
  assert.equal(loaded.model, "gpt-6-sol");
  assert.equal(loaded.maxOutputTokens, 25_000);
});

test("SCIENTIFIC_EDITORIAL_MODEL overrides the default without invoking a provider", () => {
  const loaded = loadScientificEditorialConfig({
    OPENAI_API_KEY: "test-only",
    SCIENTIFIC_EDITORIAL_MODEL: "approved-test-model",
  });
  assert.equal(loaded.model, "approved-test-model");
});

test("missing API key fails closed before transport invocation", async () => {
  let calls = 0;
  const result = await runRealEditorialGeneration(
    { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
    {
      env: {},
      transport: {
        async create() {
          calls += 1;
          throw new Error("must not run");
        },
      },
      generationId: () => "generation-test",
    },
  );
  assert.equal(calls, 0);
  assert.equal(result.validationStatus, "not_run");
  assert.equal(result.error?.code, "configuration");
});

test("OpenAI adapter requests strict schema and parses structured output", async () => {
  let captured: Record<string, unknown> | undefined;
  const provider = new OpenAIScientificEditorialProvider(
    {
      async create(request) {
        captured = request;
        return { output_text: JSON.stringify(pmid42717033ExperimentalDraft) };
      },
    },
    config,
  );
  const output = await provider.generate(providerRequest);
  assert.deepEqual(output, pmid42717033ExperimentalDraft);
  assert.deepEqual((captured?.text as { format: { strict: boolean; schema: unknown } }).format, {
    type: "json_schema",
    name: "scientific_editorial_draft",
    strict: true,
    schema: scientificEditorialDraftJsonSchema,
  });
  assert.equal(captured?.store, false);
  assert.deepEqual(captured?.reasoning, { mode: "standard", effort: "medium" });
  assert.equal(captured?.max_output_tokens, 25_000);
  const blockSchema = (
    scientificEditorialDraftJsonSchema as {
      properties: {
        blocks: { items: { required: string[]; properties: Record<string, unknown> } };
      };
    }
  ).properties.blocks.items;
  assert.ok(blockSchema.required.includes("title"));
  assert.deepEqual(blockSchema.properties.title, {
    anyOf: [{ type: "string", minLength: 1, maxLength: 10_000 }, { type: "null" }],
  });
});

test("provider timeout aborts once and never retries", async () => {
  let calls = 0;
  const transport: OpenAIEditorialTransport = {
    async create(_request, { signal }) {
      calls += 1;
      return await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    },
  };
  const provider = new OpenAIScientificEditorialProvider(transport, { ...config, timeoutMs: 5 });
  await assert.rejects(
    provider.generate(providerRequest),
    (error: unknown) =>
      error instanceof ScientificEditorialProviderError && error.code === "timeout",
  );
  assert.equal(calls, 1);
});

test("provider errors are structured and are not retried", async () => {
  let calls = 0;
  const provider = new OpenAIScientificEditorialProvider(
    {
      async create() {
        calls += 1;
        throw new Error("private upstream detail");
      },
    },
    config,
  );
  await assert.rejects(
    provider.generate(providerRequest),
    (error: unknown) =>
      error instanceof ScientificEditorialProviderError &&
      error.code === "provider_error" &&
      !error.message.includes("private upstream detail"),
  );
  assert.equal(calls, 1);
});

test("one mocked generation captures safe usage and validates before returning the draft", async () => {
  let calls = 0;
  const result = await runRealEditorialGeneration(
    { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
    {
      env: { OPENAI_API_KEY: "test-only", SCIENTIFIC_EDITORIAL_MODEL: "test-model" },
      transport: {
        async create() {
          calls += 1;
          return {
            id: "response-test",
            model: "test-model-2026-09-01",
            service_tier: "default",
            status: "completed",
            output_text: JSON.stringify(pmid42717033ExperimentalDraft),
            usage: {
              input_tokens: 100,
              input_tokens_details: { cached_tokens: 40, cache_write_tokens: 10 },
              output_tokens: 200,
              output_tokens_details: { reasoning_tokens: 75 },
              total_tokens: 300,
            },
          };
        },
      },
      generationId: () => "generation-test",
      now: (() => {
        let value = 1_000;
        return () => (value += 25);
      })(),
    },
  );
  assert.equal(calls, 1);
  assert.equal(result.validationStatus, "accepted");
  assert.equal(result.model, "test-model");
  assert.equal(result.responseModel, "test-model-2026-09-01");
  assert.equal(result.serviceTier, "default");
  assert.equal(result.responseId, "response-test");
  assert.equal(result.responseStatus, "completed");
  assert.deepEqual(result.usage, {
    inputTokens: 100,
    cachedInputTokens: 40,
    cacheWriteTokens: 10,
    outputTokens: 200,
    reasoningTokens: 75,
    totalTokens: 300,
  });
  assert.equal(result.draft?.reviewStatus, "pending");
  assert.equal(result.validationErrors.length, 0);
});

test("process env model is used by the provider and reported when no env dependency is passed", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.SCIENTIFIC_EDITORIAL_MODEL;
  process.env.OPENAI_API_KEY = "test-only";
  process.env.SCIENTIFIC_EDITORIAL_MODEL = "process-env-model";
  let requestedModel: unknown;
  try {
    const result = await runRealEditorialGeneration(
      { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
      {
        transport: {
          async create(request) {
            requestedModel = request.model;
            return { output_text: JSON.stringify(pmid42717033ExperimentalDraft) };
          },
        },
      },
    );
    assert.equal(requestedModel, "process-env-model");
    assert.equal(result.model, "process-env-model");
  } finally {
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
    if (previousModel === undefined) delete process.env.SCIENTIFIC_EDITORIAL_MODEL;
    else process.env.SCIENTIFIC_EDITORIAL_MODEL = previousModel;
  }
});

test("injected env overrides process env for deterministic tests", async () => {
  const previousModel = process.env.SCIENTIFIC_EDITORIAL_MODEL;
  process.env.SCIENTIFIC_EDITORIAL_MODEL = "process-env-model";
  let requestedModel: unknown;
  try {
    const result = await runRealEditorialGeneration(
      { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
      {
        env: { OPENAI_API_KEY: "test-only", SCIENTIFIC_EDITORIAL_MODEL: "injected-model" },
        transport: {
          async create(request) {
            requestedModel = request.model;
            return { output_text: JSON.stringify(pmid42717033ExperimentalDraft) };
          },
        },
      },
    );
    assert.equal(requestedModel, "injected-model");
    assert.equal(result.model, "injected-model");
  } finally {
    if (previousModel === undefined) delete process.env.SCIENTIFIC_EDITORIAL_MODEL;
    else process.env.SCIENTIFIC_EDITORIAL_MODEL = previousModel;
  }
});

test("an incomplete response records sanitized metrics and is never parsed as a draft", async () => {
  const result = await runRealEditorialGeneration(
    { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
    {
      env: { OPENAI_API_KEY: "test-only" },
      transport: {
        async create() {
          return {
            id: "response-incomplete",
            model: "gpt-6-sol-2026-09-01",
            service_tier: "default",
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output_text: JSON.stringify(pmid42717033ExperimentalDraft),
            usage: {
              input_tokens: 100,
              input_tokens_details: { cached_tokens: 20, cache_write_tokens: 5 },
              output_tokens: 25_000,
              output_tokens_details: { reasoning_tokens: 24_000 },
              total_tokens: 25_100,
            },
          };
        },
      },
    },
  );
  assert.equal(result.validationStatus, "not_run");
  assert.equal(result.draft, undefined);
  assert.equal(result.error?.code, "invalid_output");
  assert.equal(result.incompleteReason, "max_output_tokens");
  assert.equal(result.responseStatus, "incomplete");
  assert.equal(result.usage?.reasoningTokens, 24_000);
});

test("schema-valid but scientifically invalid output remains an explicitly rejected candidate", async () => {
  const invalid = structuredClone(pmid42717033ExperimentalDraft);
  invalid.blocks[0].claims[0].grounding.factIds = ["unknown-fact"];
  const result = await runRealEditorialGeneration(
    { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
    {
      env: { OPENAI_API_KEY: "test-only" },
      transport: {
        async create() {
          return { output_text: JSON.stringify(invalid) };
        },
      },
    },
  );
  assert.equal(result.validationStatus, "rejected");
  assert.equal(result.draft, undefined);
  assert.equal(result.candidateDraft?.requiresHumanReview, true);
  assert.equal(result.candidateDraft?.reviewStatus, "pending");
  assert.ok(result.validationErrors.some(({ code }) => code === "FACT_NOT_FOUND"));
});

test("schema-invalid model output never exposes a draft or typed candidate", async () => {
  const invalid = { ...structuredClone(pmid42717033ExperimentalDraft), reviewStatus: "approved" };
  const result = await runRealEditorialGeneration(
    { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
    {
      env: { OPENAI_API_KEY: "test-only" },
      transport: {
        async create() {
          return { output_text: JSON.stringify(invalid) };
        },
      },
    },
  );
  assert.equal(result.validationStatus, "rejected");
  assert.equal(result.draft, undefined);
  assert.equal(result.candidateDraft, undefined);
  assert.ok(result.validationErrors.some(({ code }) => code === "DRAFT_SCHEMA_INVALID"));
});

test("explicit confirmation and the single-canary allowlist gate all provider calls", async () => {
  let calls = 0;
  const dependencies = {
    env: { OPENAI_API_KEY: "test-only" },
    transport: {
      async create() {
        calls += 1;
        return { output_text: "{}" };
      },
    },
  };
  await assert.rejects(
    runRealEditorialGeneration(
      { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: false },
      dependencies,
    ),
    /confirmation is required/,
  );
  for (const articleId of ["pmid:41910396", "pmid:42670964"])
    await assert.rejects(
      runRealEditorialGeneration({ articleId, confirmRealGeneration: true }, dependencies),
      /not authorized/,
    );
  assert.equal(calls, 0);
});

test("the authorized payload contains no golden or preview material", async () => {
  let serializedInput = "";
  await runRealEditorialGeneration(
    { articleId: SCIENTIFIC_EDITORIAL_CANARY_ARTICLE_ID, confirmRealGeneration: true },
    {
      env: { OPENAI_API_KEY: "test-only" },
      transport: {
        async create(request) {
          serializedInput = String(request.input);
          return { output_text: JSON.stringify(pmid42717033ExperimentalDraft) };
        },
      },
    },
  );
  assert.doesNotMatch(serializedInput, /DoseDocument|approvedDocument|preview|manual aprovada/i);
  const implementation = await readFile(
    "src/server/scientific/editorial-draft/real-generation.server.ts",
    "utf8",
  );
  assert.doesNotMatch(
    implementation,
    /createPmid42717033DoseDocument|dose-document\/pmid-42717033|editorial-preview/,
  );
});

test("imports, builds, and preview source have no implicit generation or client secret", async () => {
  const calls = 0;
  await import("./real-generation.server");
  assert.equal(calls, 0);
  const [previewRoute, previewComponent, clientAi, routeSource] = await Promise.all([
    readFile("src/routes/internal.scientific-preview.tsx", "utf8"),
    readFile("src/components/scientific-editorial-preview.tsx", "utf8"),
    readFile("src/lib/ai.ts", "utf8"),
    readFile("server/api/scientific-editorial-generation.post.ts", "utf8"),
  ]);
  assert.doesNotMatch(
    `${previewRoute}\n${previewComponent}`,
    /runRealEditorialGeneration|OPENAI_API_KEY/,
  );
  assert.doesNotMatch(clientAi, /OPENAI_API_KEY/);
  assert.match(routeSource, /confirmRealGeneration/);
  assert.doesNotMatch(routeSource, /createPmid42717033DoseDocument/);
});
