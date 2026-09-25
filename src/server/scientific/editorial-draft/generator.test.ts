import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DeterministicScientificEditorialProvider } from "./fake-provider.server";
import { ValidatedScientificEditorialDraftGenerator } from "./generator";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";
import { projectScientificEditorialDraft } from "./projection";
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

test("the deterministic provider exercises structured generation without network I/O", async () => {
  const provider = new DeterministicScientificEditorialProvider(pmid42717033ExperimentalDraft);
  const generator = new ValidatedScientificEditorialDraftGenerator(provider);
  const result = await generator.generate(input);
  assert.equal(result.ok, true);
  assert.deepEqual(provider.calls, [SCIENTIFIC_EDITORIAL_PROMPT_VERSION]);
  if (result.ok) {
    assert.equal(result.draft.requiresHumanReview, true);
    assert.equal(result.draft.reviewStatus, "pending");
    assert.ok(
      result.draft.blocks.every((block) => block.claims.every((claim) => claim.statementKind)),
    );
  }
});

test("generation returns a structured validation failure and never repairs output", async () => {
  const invalid = structuredClone(pmid42717033ExperimentalDraft);
  invalid.blocks[0].claims[0].grounding.factIds = ["fact:does-not-exist"];
  const result = await new ValidatedScientificEditorialDraftGenerator(
    new DeterministicScientificEditorialProvider(invalid),
  ).generate(input);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some(({ code }) => code === "FACT_NOT_FOUND"));
});

test("validated draft projects generically to DoseDocument", () => {
  const document = projectScientificEditorialDraft({
    draft: pmid42717033ExperimentalDraft,
    sourceSet: pmid42717033SourceSet,
  });
  assert.equal(document.articleId, pmid42717033ExperimentalDraft.articleId);
  assert.match(document.id, /experimental-projection-v1$/);
  assert.ok(
    document.chapters.some(({ title }) => title === "Do racional biológico ao teste clínico"),
  );
});

test("the generic prompt contains no canary-specific scientific content", () => {
  assert.doesNotMatch(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /Mitiperstat|\bMPO\b|heart failure|42717033/i,
  );
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /never decide what is true/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /Never invent an ID/i);
});

test("experiment remains isolated from public surfaces and contains no remote provider", async () => {
  const surfaces = await Promise.all(
    [
      "src/routes/_app/index.tsx",
      "src/components/scientific-feed.tsx",
      "src/lib/scientific-catalog.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const surface of surfaces) assert.doesNotMatch(surface, /ExperimentalDraft|editorial-draft/);
  const fake = await readFile(
    "src/server/scientific/editorial-draft/fake-provider.server.ts",
    "utf8",
  );
  assert.doesNotMatch(fake, /fetch\(|https?:\/\//);
});
