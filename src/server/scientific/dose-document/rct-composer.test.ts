import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  pmid41910396EvidenceSet,
  pmid41910396FactSet,
  pmid41910396Interpretation,
  pmid41910396SourceSet,
} from "../knowledge-representation/pmid-41910396.fixture";
import {
  pmid42670964EvidenceSet,
  pmid42670964FactSet,
  pmid42670964Interpretation,
  pmid42670964SourceSet,
} from "../knowledge-representation/pmid-42670964.fixture";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "../knowledge-representation/pmid-42717033.fixture";
import { doseDocumentSchema } from "./contracts";
import { createPmid42717033DoseDocument } from "./pmid-42717033";
import {
  composeRctDoseDocument,
  formatArmEstimate,
  formatConfidenceInterval,
  formatMeanDifference,
  formatPValue,
  formatResultEstimate,
} from "./rct-composer";

const metadata = { title: "Título bibliográfico validado", doi: "10.1000/example" };

const canaries = [
  {
    name: "first canary",
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretation: pmid42717033Interpretation,
  },
  {
    name: "second canary",
    sourceSet: pmid41910396SourceSet,
    evidenceSet: pmid41910396EvidenceSet,
    factSet: pmid41910396FactSet,
    interpretation: pmid41910396Interpretation,
  },
  {
    name: "third canary",
    sourceSet: pmid42670964SourceSet,
    evidenceSet: pmid42670964EvidenceSet,
    factSet: pmid42670964FactSet,
    interpretation: pmid42670964Interpretation,
  },
] as const;

for (const canary of canaries) {
  test(`${canary.name} produces a valid generic DoseDocument without mutating authority artifacts`, () => {
    const factsBefore = structuredClone(canary.factSet);
    const interpretationBefore = structuredClone(canary.interpretation);
    const document = composeRctDoseDocument({ ...canary, metadata });

    assert.equal(doseDocumentSchema.safeParse(document).success, true);
    assert.deepEqual(canary.factSet, factsBefore);
    assert.deepEqual(canary.interpretation, interpretationBefore);
    assert.match(document.sourceCoverage.statement, /resumo indexado/i);
    assert.match(JSON.stringify(document), /rascunho, não publicável automaticamente/i);
    assert.doesNotMatch(JSON.stringify(document), /undefined|null|not_reported_in_source/i);
  });
}

test("golden comparison preserves material coverage without requiring manual wording", () => {
  const manual = createPmid42717033DoseDocument(metadata);
  const generic = composeRctDoseDocument({
    sourceSet: pmid42717033SourceSet,
    evidenceSet: pmid42717033EvidenceSet,
    factSet: pmid42717033FactSet,
    interpretation: pmid42717033Interpretation,
    metadata,
  });
  const manualFacts = new Set([
    ...manual.chapters.flatMap(({ blocks }) => blocks.flatMap(({ factIds }) => factIds)),
    ...manual.keyNumbers.flatMap(({ factIds }) => factIds),
    ...manual.contextualExplainers.flatMap(({ factIds }) => factIds),
  ]);
  const genericFacts = new Set([
    ...generic.chapters.flatMap(({ blocks }) => blocks.flatMap(({ factIds }) => factIds)),
    ...generic.keyNumbers.flatMap(({ factIds }) => factIds),
    ...generic.contextualExplainers.flatMap(({ factIds }) => factIds),
  ]);
  const essentialSuffixes = [
    "sample-size",
    "arm-low-dose",
    "arm-high-dose",
    "arm-placebo",
    "endpoint-kccq",
    "endpoint-6mwd",
    "result-kccq",
    "result-6mwd",
    "safety-general",
    "rash-mitiperstat",
    "rash-placebo",
  ];
  for (const suffix of essentialSuffixes) {
    const id = `pmid:42717033:${suffix}`;
    assert.equal(manualFacts.has(id), true, `manual missing ${suffix}`);
    assert.equal(genericFacts.has(id), true, `composer missing ${suffix}`);
  }
  // The approved manual declares metadata + abstract, while the validated source set currently
  // contains one abstract SourceDocument. The generic composer must not broaden that authority.
  assert.deepEqual(manual.sourceCoverage.basedOn, ["metadata", "abstract"]);
  assert.deepEqual(generic.sourceCoverage.basedOn, ["abstract"]);
  assert.ok(generic.sourceReferences.some(({ kind }) => kind === "pubmed"));
  assert.ok(generic.sourceReferences.some(({ kind }) => kind === "registry"));
  assert.deepEqual(
    generic.chapters
      .flatMap(({ blocks }) => blocks)
      .filter((block) => block.kind === "result")
      .map(({ estimate, confidenceInterval, pValue }) => ({
        estimate,
        confidenceInterval,
        pValue,
      })),
    [
      {
        estimate: "diferença média corrigida pelo placebo: −1,4 ponto",
        confidenceInterval: "IC95% −3,9 a 1,2 ponto",
        pValue: "P = 0,29",
      },
      {
        estimate: "diferença média corrigida pelo placebo: +3,8 m",
        confidenceInterval: "IC95% −3,1 a 10,8 m",
        pValue: "P = 0,28",
      },
    ],
  );
});

test("second canary preserves slope, randomized arms, time-to-event result and safety", () => {
  const document = composeRctDoseDocument({
    sourceSet: pmid41910396SourceSet,
    evidenceSet: pmid41910396EvidenceSet,
    factSet: pmid41910396FactSet,
    interpretation: pmid41910396Interpretation,
    metadata,
  });
  const prose = JSON.stringify(document);
  assert.match(prose, /diferença de inclinação: \+3,02 ml\/min\/1.73 m2\/year/);
  assert.match(prose, /n=238/);
  assert.match(prose, /n=239/);
  assert.match(prose, /HR 0,57/);
  // The secondary measure is an HR, but this fixture does not mark analysisType=time_to_event.
  assert.doesNotMatch(prose, /análise de tempo até o evento/);
  assert.match(prose, /serious infections/);
  assert.doesNotMatch(prose, /238\/238|239\/239/);
});

test("third canary preserves noninferiority, composite attribution and competing results without extrapolation", () => {
  const document = composeRctDoseDocument({
    sourceSet: pmid42670964SourceSet,
    evidenceSet: pmid42670964EvidenceSet,
    factSet: pmid42670964FactSet,
    interpretation: pmid42670964Interpretation,
    metadata,
  });
  const prose = JSON.stringify(document);
  assert.match(prose, /diferença de risco: −0,1 pontos percentuais/);
  assert.match(prose, /80\/1601 \(5%\)/);
  assert.match(prose, /81\/1602 \(5,1%\)/);
  assert.match(prose, /Margem de não inferioridade: 2,3 pontos percentuais/);
  assert.match(prose, /limite superior do IC abaixo da margem/);
  assert.match(prose, /Os resultados apresentados pertencem ao composto/);
  assert.match(prose, /HR 2,33/);
  assert.match(prose, /HR 0,43/);
  assert.doesNotMatch(
    prose,
    /benefício líquido|estratégia preferível|melhor tratamento|equivalente|superioridade|foi superior/i,
  );
});

test("formatters preserve sign, unit, confidence level, p-value operator and explicit arm denominator", () => {
  assert.equal(formatMeanDifference(-1.25, "point"), "diferença média: −1,25 ponto");
  assert.equal(
    formatConfidenceInterval({ lower: -1.3, upper: 1.2, levelPercent: 90 }, "percentage_points"),
    "IC90% −1,3 a 1,2 pontos percentuais",
  );
  assert.equal(formatPValue({ operator: "less_than_or_equal", value: 0.05 }), "P ≤ 0,05");
  assert.equal(
    formatArmEstimate({
      type: "arm_estimate",
      armId: "arm-a",
      endpointId: "endpoint-a",
      eventCount: { status: "available", value: 4 },
      denominator: { status: "available", value: 20 },
      estimate: { measureType: "proportion", value: 0.2, unit: "proportion" },
      timepoint: { value: 1, unit: "year" },
    }),
    "4/20 (0,2 proporção)",
  );
  assert.equal(
    formatResultEstimate({
      type: "result",
      endpointId: "endpoint-a",
      arms: [
        { armId: "a", role: "intervention" },
        { armId: "b", role: "comparator" },
      ],
      pooling: { status: "not_pooled" },
      estimate: {
        measureType: "hazard_ratio",
        value: 0.57,
        unit: "ratio",
        confidenceInterval: { status: "not_reported_in_source" },
        pValue: { status: "not_reported_in_source" },
      },
      timepoint: { value: 2, unit: "year" },
      analysisType: "time_to_event",
    }),
    "HR 0,57",
  );
});

test("incompatible identities and validation states fail safely", () => {
  assert.throws(
    () =>
      composeRctDoseDocument({
        sourceSet: pmid42717033SourceSet,
        evidenceSet: pmid41910396EvidenceSet,
        factSet: pmid42717033FactSet,
        interpretation: pmid42717033Interpretation,
        metadata,
      }),
    /incompatible scientific pipeline/,
  );
  assert.throws(
    () =>
      composeRctDoseDocument({
        sourceSet: { ...pmid42717033SourceSet, validation: { status: "pending" } },
        evidenceSet: pmid42717033EvidenceSet,
        factSet: pmid42717033FactSet,
        interpretation: pmid42717033Interpretation,
        metadata,
      }),
    /completed validation/,
  );
});

test("composer source contains no article-specific content branch", async () => {
  const source = await readFile(new URL("./rct-composer.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /42717033|41910396|42670964|mitiperstat|iptacopan|clopidogrel/i);
  assert.doesNotMatch(source, /openai|xai|prompt|embedding|vector search/i);
});
