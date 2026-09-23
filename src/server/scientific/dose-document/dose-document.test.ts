import assert from "node:assert/strict";
import test from "node:test";
import { pmid42717033ScientificFacts } from "../knowledge-representation/pmid-42717033.fixture";
import { doseDocumentSchema } from "./contracts";
import { createPmid42717033DoseDocument } from "./pmid-42717033";

const document = createPmid42717033DoseDocument({
  title: "Original study title",
  doi: "10.1000/test",
});

test("DoseDocument v1 validates as a structured presentation document", () => {
  assert.equal(doseDocumentSchema.safeParse(document).success, true);
  assert.ok(document.chapters.length >= 10);
  assert.ok(document.chapters.every((chapter) => chapter.blocks.every((block) => block.id)));
});

test("every scientific presentation block is linked to existing ScientificFacts", () => {
  const facts = new Set(pmid42717033ScientificFacts.map((fact) => fact.id));
  const references = [
    ...document.chapters.flatMap((chapter) => chapter.blocks.flatMap((block) => block.factIds)),
    ...document.keyNumbers.flatMap((number) => number.factIds),
    ...document.contextualExplainers.flatMap((explainer) => explainer.factIds),
  ];
  assert.ok(references.length > 0);
  assert.ok(references.every((id) => facts.has(id)));
});

test("result presentation preserves pooling, timepoint, units, intervals and p-values", () => {
  const results = document.chapters
    .flatMap((chapter) => chapter.blocks)
    .filter((block) => block.kind === "result");
  assert.deepEqual(
    results.map((result) => result.estimate),
    ["−1,4 ponto", "+3,8 m"],
  );
  assert.deepEqual(
    results.map((result) => result.confidenceInterval),
    ["IC95% −3,9 a 1,2", "IC95% −3,1 a 10,8"],
  );
  assert.deepEqual(
    results.map((result) => result.pValue),
    ["P = 0,29", "P = 0,28"],
  );
  assert.ok(
    results.every(
      (result) => result.comparison.includes("agrupadas") && result.timepoint === "16 semanas",
    ),
  );
});

test("coverage, explainers and guarded interpretation remain explicit", () => {
  assert.deepEqual(document.sourceCoverage.basedOn, ["metadata", "abstract"]);
  assert.equal(document.contextualExplainers.length, 7);
  const prose = JSON.stringify(document);
  assert.doesNotMatch(prose, /equivalência comprovada|paper inteiro|MPO não participa/i);
  assert.match(prose, /não representa uma leitura integral/);
});
