import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DeterministicScientificEditorialProvider } from "./fake-provider.server";
import { SCIENTIFIC_EDITORIAL_STRUCTURAL_QUANTITATIVE_UNITS } from "./contracts";
import { ValidatedScientificEditorialDraftGenerator } from "./generator";
import { pmid42717033ExperimentalDraft } from "./pmid-42717033-experiment.fixture";
import { projectScientificEditorialDraft } from "./projection";
import { SCIENTIFIC_EDITORIAL_PROMPT_VERSION, SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT } from "./prompt";
import { DOSE_PROGRESSIVE_EDITORIAL_PROFILE } from "./profile";
import { deriveEditorialScientificAuthority } from "./scientific-authority";
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
  editorialProfile: DOSE_PROGRESSIVE_EDITORIAL_PROFILE,
};

test("the deterministic provider exercises structured generation without network I/O", async () => {
  const provider = new DeterministicScientificEditorialProvider(pmid42717033ExperimentalDraft);
  const generator = new ValidatedScientificEditorialDraftGenerator(provider);
  const result = await generator.generate(input);
  assert.equal(result.ok, true);
  assert.deepEqual(provider.calls, [SCIENTIFIC_EDITORIAL_PROMPT_VERSION]);
  assert.equal(provider.requests[0].input.editorialProfile.targetLanguage, "pt-BR");
  assert.ok(
    provider.requests[0].scientificAuthority.inferenceBoundaries.some(
      ({ id }) => id === "do_not_infer_individual_dose_effect",
    ),
  );
  assert.deepEqual(
    provider.requests[0].scientificAuthority,
    deriveEditorialScientificAuthority(pmid42717033FactSet, pmid42717033Interpretation),
  );
  assert.deepEqual(
    provider.requests[0].scientificAuthority.quantitativeClaims.filter(
      ({ factId }) => factId === "pmid:42717033:endpoint-6mwd",
    ),
    [{ factId: "pmid:42717033:endpoint-6mwd", value: 16, unit: "week" }],
  );
  if (result.ok) {
    assert.equal(result.deterministicValidation, "passed");
    assert.equal(result.draft.requiresHumanReview, true);
    assert.equal(result.draft.reviewStatus, "pending");
    assert.ok(
      result.draft.blocks.every((block) => block.claims.every((claim) => claim.statementKind)),
    );
  }
});

test("structurally valid free prose remains pending and cannot become an approved document", async () => {
  const adversarial = structuredClone(pmid42717033ExperimentalDraft);
  const claim = adversarial.blocks[0].claims[0];
  assert.notEqual(claim.statementKind, "boundary_explanation");
  if (claim.statementKind === "boundary_explanation") throw new Error("Expected claim");
  claim.text = "Mitiperstat e placebo são equivalentes.";
  claim.statementKind = "article_supported_fact";
  claim.epistemicStatus = "observed_clinical_result";

  const result = await new ValidatedScientificEditorialDraftGenerator(
    new DeterministicScientificEditorialProvider(adversarial),
  ).generate(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.deterministicValidation, "passed");
  assert.equal(result.draft.requiresHumanReview, true);
  assert.equal(result.draft.reviewStatus, "pending");

  const preview = projectScientificEditorialDraft({
    draft: result.draft,
    sourceSet: pmid42717033SourceSet,
  });
  assert.match(preview.id, /experimental-projection-v1$/);
  assert.notEqual(preview.id, "approved");
});

test("generation returns a structured validation failure and never repairs output", async () => {
  const invalid = structuredClone(pmid42717033ExperimentalDraft);
  const invalidClaim = invalid.blocks[0].claims[0];
  assert.notEqual(invalidClaim.statementKind, "boundary_explanation");
  if (invalidClaim.statementKind === "boundary_explanation") throw new Error("Expected claim");
  invalidClaim.grounding.factIds = ["fact:does-not-exist"];
  const result = await new ValidatedScientificEditorialDraftGenerator(
    new DeterministicScientificEditorialProvider(invalid),
  ).generate(input);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(({ code }) => code === "FACT_NOT_FOUND"));
    assert.equal(result.candidateDraft?.requiresHumanReview, true);
    assert.equal(result.candidateDraft?.reviewStatus, "pending");
  }
});

test("schema-invalid provider output is rejected without a typed candidate", async () => {
  const invalid = { ...structuredClone(pmid42717033ExperimentalDraft), reviewStatus: "approved" };
  const result = await new ValidatedScientificEditorialDraftGenerator(
    new DeterministicScientificEditorialProvider(invalid),
  ).generate(input);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some(({ code }) => code === "DRAFT_SCHEMA_INVALID"));
    assert.equal(result.candidateDraft, undefined);
  }
});

test("deterministically checked pending draft projects only to an experimental DoseDocument", () => {
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

test("the generation prompt declares every canonical unit synthesized by validation", () => {
  assert.equal(SCIENTIFIC_EDITORIAL_PROMPT_VERSION, "scientific-editorial-prompt.v6");
  for (const unit of Object.values(SCIENTIFIC_EDITORIAL_STRUCTURAL_QUANTITATIVE_UNITS))
    assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, new RegExp(`"${unit}"`));
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /sample sizes, event counts, and denominators/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /allocation ratio parts/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /confidenceInterval\.value\.levelPercent/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /pValue\.value\.value/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /complete allowlist/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /scientific nomenclature are names/i);
});

test("the editorial profile requires supported progressive comprehension without padding", () => {
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /targetLanguage "pt-BR"/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /Do not translate IDs, canonical units/);
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /optimize for progressive understanding, not word count/i,
  );
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /omit unsupported material/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /COMPREHENSION > BREVITY/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /Do not use padding, a minimum length/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /fixed number of blocks/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /not mandatory sections/);
});

test("the editorial policy turns supported study facts into explanatory relationships", () => {
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /what the study tried to discover/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /why that question made sense/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /design choice.*structures the test/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /who was actually studied/i);
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /what each endpoint represents within this study/i,
  );
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /distinct endpoints answer distinct aspects/i);
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /Never supply an endpoint definition.*parametric knowledge/i,
  );
});

test("the editorial policy relates estimates to uncertainty without expanding authority", () => {
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /RESULT → UNCERTAINTY → INTERPRETATION/);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /confidence interval as uncertainty/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /only what the authorized P-value permits/i);
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /lack of statistical significance into equivalence/i,
  );
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /biological plausibility, not demonstrated causality or clinical benefit/i,
  );
});

test("the editorial policy delimits synthesis, coverage, and progressive disclosure", () => {
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /studied population, intervention or doses, endpoints, and time horizon/i,
  );
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /whole class, biological pathway, unstudied population/i,
  );
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /abstract-only coverage must never read as a full-text review/i,
  );
  assert.match(
    SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT,
    /omit it or explicitly state.*supplied-source limitation/i,
  );
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /Opening should quickly orient/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /Core should build/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /Deep_dive should add/i);
  assert.match(SCIENTIFIC_EDITORIAL_SYSTEM_PROMPT, /not as three paraphrases/i);
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
