import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { TOPIC_V1 } from "../../lib/scientific-catalog";
import { emptyArticle } from "./parse-utils";
import { storedTopicRuleSchema } from "./topic-rule-contract";
import {
  TOPIC_RULES_V1_CLASSIFIER_FIXTURE,
  TOPIC_RULES_V1_CORPUS,
  TOPIC_RULES_V1_FIXTURE,
} from "./topic-rules.v1.fixture";
import { classifyArticleTopics } from "./topics";
import type { ScientificArticle } from "./types";

const slugById = new Map<string, string>(TOPIC_V1.map(([id, slug]) => [id, slug]));
const article = (
  id: string,
  values: Partial<ScientificArticle> & Pick<ScientificArticle, "title">,
): ScientificArticle => ({
  ...emptyArticle("pubmed", values.title, id),
  ...values,
});
const classify = (values: Partial<ScientificArticle> & Pick<ScientificArticle, "title">) =>
  classifyArticleTopics(article("fixture", values), TOPIC_RULES_V1_CLASSIFIER_FIXTURE);
const slugs = (values: Partial<ScientificArticle> & Pick<ScientificArticle, "title">) =>
  classify(values)
    .map((match) => slugById.get(match.topicId)!)
    .sort();

test("all twelve offline rules use the canonical catalog and runtime contract", () => {
  assert.equal(Object.keys(TOPIC_RULES_V1_FIXTURE).length, 12);
  assert.deepEqual(Object.keys(TOPIC_RULES_V1_FIXTURE).sort(), TOPIC_V1.map((x) => x[1]).sort());
  for (const rule of Object.values(TOPIC_RULES_V1_FIXTURE)) {
    assert.equal(storedTopicRuleSchema.safeParse(rule).success, true);
    assert.ok(!rule.journals?.length);
    assert.ok(!rule.publicationTypes?.length);
  }
  assert.equal(new Set(TOPIC_RULES_V1_CLASSIFIER_FIXTURE.map((rule) => rule.topicId)).size, 12);
});

test("the 96-scenario precision-first corpus has no false positives or false negatives", () => {
  assert.equal(TOPIC_RULES_V1_CORPUS.length, 96);
  for (const [, slug] of TOPIC_V1) {
    const topicScenarios = TOPIC_RULES_V1_CORPUS.filter((scenario) => scenario.focus === slug);
    assert.equal(topicScenarios.length, 8, slug);
    assert.equal(new Set(topicScenarios.map((scenario) => scenario.category)).size, 8, slug);
  }
  const results = TOPIC_RULES_V1_CORPUS.map((scenario) => {
    const expected: string[] = [...scenario.expectedSlugs].sort();
    const actual = slugs(scenario.article);
    return { scenario, expected, actual };
  });
  const falsePositives = results.flatMap(({ scenario, expected, actual }) =>
    actual.filter((slug) => !expected.includes(slug)).map((slug) => `${scenario.id}:${slug}`),
  );
  const falseNegatives = results.flatMap(({ scenario, expected, actual }) =>
    expected.filter((slug) => !actual.includes(slug)).map((slug) => `${scenario.id}:${slug}`),
  );
  assert.deepEqual(falsePositives, []);
  assert.deepEqual(falseNegatives, []);
  assert.equal(results.filter(({ expected }) => expected.length > 0).length, 72);
  assert.equal(results.filter(({ expected }) => expected.length === 0).length, 24);
  assert.equal(
    results.filter(({ expected, actual }) => assert.deepEqual(actual, expected) === undefined)
      .length,
    96,
  );
  assert.equal(
    results.reduce((total, { actual }) => total + actual.length, 0),
    84,
  );
  assert.equal(results.filter(({ scenario }) => scenario.deliberateFalseNegative).length, 12);
  assert.equal(results.filter(({ scenario }) => scenario.category === "multitopic").length, 12);

  const confidence = results
    .flatMap(({ scenario }) => classify(scenario.article))
    .reduce<Record<string, number>>((counts, match) => {
      const bucket = match.confidence.toFixed(2);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
      return counts;
    }, {});
  assert.deepEqual(confidence, { "0.80": 72, "0.65": 12 });
});

test("required multitopic combinations produce independent matches on one article", () => {
  for (const [title, expected] of [
    ["Type 2 diabetes and chronic kidney disease", ["diabetes", "doenca-renal-cronica"]],
    [
      "Obesity and cardiovascular risk reduction",
      ["obesidade-e-incretinas", "prevencao-cardiovascular"],
    ],
    ["Arterial hypertension with coronary artery disease", ["hipertensao", "doenca-coronariana"]],
    ["Atrial fibrillation in heart failure", ["fibrilacao-atrial", "insuficiencia-cardiaca"]],
    ["Dyslipidemia and cardiovascular prevention", ["lipidios", "prevencao-cardiovascular"]],
    ["Type 1 diabetes in chronic liver disease", ["diabetes", "hepatologia"]],
  ] as const)
    assert.deepEqual(slugs({ title }), [...expected].sort());
});

test("isolated drugs and drug classes never provide thematic evidence", () => {
  for (const term of ["semaglutide", "tirzepatide", "empagliflozin", "SGLT2", "GLP-1"])
    assert.deepEqual(slugs({ title: `${term} clinical outcomes` }), []);
});

test("unsafe abbreviations remain deliberate false negatives", () => {
  for (const term of [
    "HF",
    "IC",
    "AF",
    "FA",
    "CKD",
    "DRC",
    "CAD",
    "DAC",
    "DM",
    "BP",
    "HTN",
    "RSV",
    "MASH",
    "NASH",
  ])
    assert.deepEqual(slugs({ title: `${term} clinical update` }), []);
});

test("diabetes is explicit and diabetes insipidus remains negative", () => {
  for (const title of [
    "Diabetes mellitus",
    "Type 1 diabetes",
    "Type 2 diabetes",
    "Gestational diabetes",
  ])
    assert.deepEqual(slugs({ title }), ["diabetes"]);
  assert.deepEqual(slugs({ title: "Diabetes insipidus" }), []);
  assert.deepEqual(slugs({ title: "Semaglutide for obesity without glycemic disease" }), [
    "obesidade-e-incretinas",
  ]);
  assert.deepEqual(slugs({ title: "Empagliflozin in heart failure without glycemic disease" }), [
    "insuficiencia-cardiaca",
  ]);
});

test("systemic hypertension excludes four non-systemic contexts", () => {
  for (const title of [
    "Arterial hypertension",
    "Essential hypertension",
    "Systemic hypertension",
    "Hipertensão arterial",
  ])
    assert.deepEqual(slugs({ title }), ["hipertensao"]);
  for (const title of [
    "Pulmonary hypertension",
    "Portal hypertension",
    "Intracranial hypertension",
    "Ocular hypertension",
  ])
    assert.ok(!slugs({ title }).includes("hipertensao"));
  assert.deepEqual(slugs({ title: "Arterial hypertension with pulmonary hypertension" }), []);
});

test("specific MeSH descriptors classify while broad descriptors do not", () => {
  assert.deepEqual(slugs({ title: "Generic study", meshTerms: ["Heart Failure"] }), [
    "insuficiencia-cardiaca",
  ]);
  assert.deepEqual(slugs({ title: "Generic study", meshTerms: ["Vaccination", "Adult"] }), []);
  for (const mesh of ["Adult", "Cardiovascular Diseases", "Liver Diseases"])
    assert.deepEqual(slugs({ title: "Generic study", meshTerms: [mesh] }), []);
});

test("normalization coverage is explicit and hyphen-space behavior stays conservative", () => {
  assert.deepEqual(slugs({ title: "INSUFICIÊNCIA CARDÍACA: terapia" }), ["insuficiencia-cardiaca"]);
  assert.deepEqual(slugs({ title: "insuficiencia cardiaca, terapia" }), ["insuficiencia-cardiaca"]);
  assert.deepEqual(slugs({ title: "Lipid-lowering therapy" }), ["lipidios"]);
  assert.deepEqual(slugs({ title: "Lipid lowering therapy" }), []);
});

test("field evidence and deterministic confidence formula remain unchanged", () => {
  const cases: Array<[
    Partial<ScientificArticle> & Pick<ScientificArticle, "title">,
    "title" | "abstract" | "keyword" | "mesh",
    number,
  ]> = [
    [{ title: "Heart failure" }, "title", 0.8],
    [{ title: "Generic study", abstract: "Heart failure" }, "abstract", 0.65],
    [{ title: "Generic study", keywords: ["Heart failure"] }, "keyword", 0.75],
    [{ title: "Generic study", meshTerms: ["Heart Failure"] }, "mesh", 0.9],
  ];
  for (const [values, field, confidence] of cases) {
    const match = classify(values)[0];
    assert.equal(match.evidence[0].field, field);
    assert.equal(match.confidence, confidence);
  }
  const multiple = classify({
    title: "Heart failure",
    abstract: "Heart failure",
    keywords: ["Heart failure"],
  })[0];
  assert.deepEqual(
    multiple.evidence.map((item) => item.field),
    ["title", "abstract", "keyword"],
  );
  assert.equal(multiple.confidence, 0.9);
});

test("configured textual evidence has no redundant containing terms per field", () => {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  for (const [slug, rule] of Object.entries(TOPIC_RULES_V1_FIXTURE)) {
    const terms = [...(rule.preferredTerms ?? []), ...(rule.synonyms ?? [])].map(normalize);
    for (const [index, term] of terms.entries())
      for (const [otherIndex, other] of terms.entries())
        if (index !== otherIndex)
          assert.equal(other.includes(term), false, `${slug}: ${term} overlaps ${other}`);
  }
});

async function productionTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return productionTypeScriptFiles(fullPath);
      return entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".fixture.ts")
        ? [fullPath]
        : [];
    }),
  );
  return nested.flat();
}

test("offline V1 fixture is never imported by production TypeScript", async () => {
  const files = await productionTypeScriptFiles("src");
  const importers: string[] = [];
  for (const file of files)
    if ((await readFile(file, "utf8")).includes("topic-rules.v1.fixture")) importers.push(file);
  assert.deepEqual(importers, []);
  const loader = await readFile("src/server/scientific/topic-rules.server.ts", "utf8");
  assert.match(loader, /read_scientific_topic_rule_snapshot/);
  assert.doesNotMatch(loader, /\.from\(|\.select\(/);
  assert.match(loader, /classification_rules/);
});
