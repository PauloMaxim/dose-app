import type { ScientificFact } from "../knowledge-representation/contracts";
import {
  validateEditorialPipeline,
  type InterpretationClaim,
  type RCTScientificFactSet,
  type ScientificEvidenceSet,
  type ScientificInterpretationArtifact,
  type ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import { doseDocumentSchema, type DoseDocument } from "./contracts";

export interface RctDoseDocumentMetadata {
  title: string;
  doi?: string | null;
}

export interface ComposeRctDoseDocumentInput {
  sourceSet: ScientificSourceSet;
  evidenceSet: ScientificEvidenceSet;
  factSet: RCTScientificFactSet;
  interpretation: ScientificInterpretationArtifact;
  metadata: RctDoseDocumentMetadata;
}

type AvailableFact = ScientificFact & {
  availability: Extract<ScientificFact["availability"], { status: "available" }>;
};
type FactValue = AvailableFact["availability"]["value"];
type ValueOfType<T extends FactValue["type"]> = Extract<FactValue, { type: T }>;
type FactOfType<T extends FactValue["type"]> = AvailableFact & {
  availability: { status: "available"; value: ValueOfType<T> };
};
type Duration = ValueOfType<"endpoint">["timepoint"];
type Result = ValueOfType<"result">;

const unitLabels: Record<string, string> = {
  day: "dia",
  week: "semana",
  month: "mês",
  year: "ano",
  point: "ponto",
  percent: "%",
  percentage_points: "pontos percentuais",
  proportion: "proporção",
  proportion_difference: "diferença de proporções",
  ratio: "",
};

const measureLabels: Partial<Record<Result["estimate"]["measureType"], string>> = {
  hazard_ratio: "HR",
  risk_ratio: "RR",
  odds_ratio: "OR",
  risk_difference: "diferença de risco",
  slope_difference: "diferença de inclinação",
  mean_change: "mudança média",
  placebo_corrected_mean_change: "diferença média corrigida pelo placebo",
  proportion: "proporção",
};

function number(value: number) {
  return Object.is(value, -0) ? "0" : value.toString().replace("-", "−").replace(".", ",");
}

function signedNumber(value: number) {
  return value > 0 ? `+${number(value)}` : number(value);
}

function withUnit(value: number, unit: string, signed = false) {
  const rendered = signed ? signedNumber(value) : number(value);
  if (unit === "percent") return `${rendered}%`;
  const label = unitLabels[unit] ?? unit;
  return label ? `${rendered} ${label}` : rendered;
}

export function formatDuration(duration: Duration) {
  const singular = unitLabels[duration.unit] ?? duration.unit;
  const label = duration.value === 1 ? singular : singular === "mês" ? "meses" : `${singular}s`;
  return `${number(duration.value)} ${label}`;
}

export function formatConfidenceInterval(
  interval: { lower: number; upper: number; levelPercent: number },
  unit: string,
) {
  const suffix = unit === "ratio" ? "" : ` ${unitLabels[unit] ?? unit}`;
  return `IC${number(interval.levelPercent)}% ${number(interval.lower)} a ${number(interval.upper)}${suffix}`;
}

export function formatPValue(value: {
  operator: "equal" | "less_than" | "less_than_or_equal";
  value: number;
}) {
  const operator = value.operator === "equal" ? "=" : value.operator === "less_than" ? "<" : "≤";
  return `P ${operator} ${number(value.value)}`;
}

export function formatResultEstimate(result: Result) {
  const { measureType, value, unit } = result.estimate;
  if (["hazard_ratio", "risk_ratio", "odds_ratio"].includes(measureType))
    return `${measureLabels[measureType]} ${number(value)}`;
  return `${measureLabels[measureType] ?? measureType}: ${withUnit(value, unit, true)}`;
}

export function formatArmEstimate(value: ValueOfType<"arm_estimate">) {
  const estimate = withUnit(value.estimate.value, value.estimate.unit);
  if (value.eventCount.status !== "available" || value.denominator.status !== "available")
    return estimate;
  return `${value.eventCount.value}/${value.denominator.value} (${estimate})`;
}

export function formatMeanDifference(value: number, unit: string) {
  return `diferença média: ${withUnit(value, unit, true)}`;
}

function availableFacts(factSet: RCTScientificFactSet): AvailableFact[] {
  return factSet.facts.filter(
    (fact): fact is AvailableFact => fact.availability.status === "available",
  );
}

function factsOfType<T extends FactValue["type"]>(
  facts: AvailableFact[],
  type: T,
): FactOfType<T>[] {
  return facts.filter((fact): fact is FactOfType<T> => fact.availability.value.type === type);
}

function sentence(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function formatArms(arms: FactOfType<"arm">[]) {
  return arms.map(({ availability }) => {
    const { label, randomizedSampleSize } = availability.value;
    return randomizedSampleSize ? `${label} (n=${randomizedSampleSize})` : label;
  });
}

function resultComparison(
  result: Result,
  arms: Map<string, ValueOfType<"arm">>,
  armEstimates: FactOfType<"arm_estimate">[],
) {
  const labels = result.arms.map(({ armId }) => arms.get(armId)?.label ?? armId);
  const pooling = result.pooling.status === "pooled" ? " (braços de intervenção agrupados)" : "";
  const estimates = armEstimates
    .filter(({ availability }) => availability.value.endpointId === result.endpointId)
    .map(({ availability }) => {
      const value = availability.value;
      return `${arms.get(value.armId)?.label ?? value.armId}: ${formatArmEstimate(value)}`;
    });
  return `${labels.join(" versus ")}${pooling}${estimates.length ? `. Estimativas por braço: ${estimates.join("; ")}.` : ""}`;
}

function reviewBoundary(claims: InterpretationClaim[]) {
  const statuses = [...new Set(claims.map(({ reviewStatus }) => reviewStatus))].join(", ");
  const operations = [...new Set(claims.map(({ operationalStatus }) => operationalStatus))].join(
    ", ",
  );
  return `Documento determinístico em rascunho, não publicável automaticamente. As interpretações preservam revisão humana (reviewStatus: ${statuses}; operationalStatus: ${operations}).`;
}

function sourceReferences(
  sourceSet: ScientificSourceSet,
  registryFacts: FactOfType<"registry_identifier">[],
  metadata: RctDoseDocumentMetadata,
): DoseDocument["sourceReferences"] {
  const references: DoseDocument["sourceReferences"] = [];
  for (const document of sourceSet.sourceDocuments) {
    const identifier = document.externalIdentifier;
    if (document.provider === "pubmed" && identifier.scheme.toLowerCase() === "pmid")
      references.push({
        id: `source-pubmed-${references.length + 1}`,
        kind: "pubmed",
        label: "PubMed",
        value: `PMID ${identifier.value}`,
        url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(identifier.value)}/`,
      });
  }
  for (const { availability } of registryFacts) {
    const { registry, identifier } = availability.value;
    if (registry === "ClinicalTrials.gov")
      references.push({
        id: `source-registry-${references.length + 1}`,
        kind: "registry",
        label: registry,
        value: identifier,
        url: `https://clinicaltrials.gov/study/${encodeURIComponent(identifier)}`,
      });
  }
  if (metadata.doi)
    references.push({
      id: `source-doi-${references.length + 1}`,
      kind: "doi",
      label: "DOI",
      value: metadata.doi,
      url: `https://doi.org/${encodeURIComponent(metadata.doi)}`,
    });
  if (!references.length)
    throw new Error("Cannot compose a DoseDocument without a supported source reference");
  return references;
}

/**
 * Deterministic presentation projection. Source, evidence, facts, and interpretation remain
 * authoritative and are never mutated. The returned document is always an editorial draft.
 */
export function composeRctDoseDocument(input: ComposeRctDoseDocumentInput): DoseDocument {
  const validation = validateEditorialPipeline(input);
  if (!validation.valid)
    throw new Error(
      `Cannot compose an incompatible scientific pipeline: ${validation.errors.map(({ code }) => code).join(", ")}`,
    );
  if (
    [
      input.sourceSet.validation,
      input.evidenceSet.validation,
      input.factSet.validation,
      input.interpretation.validation,
    ].some(({ status }) => status !== "valid")
  )
    throw new Error("Cannot compose artifacts that have not completed validation");

  const facts = availableFacts(input.factSet);
  const arms = factsOfType(facts, "arm");
  const armMap = new Map(
    arms.map(({ availability }) => [availability.value.armId, availability.value]),
  );
  const endpoints = factsOfType(facts, "endpoint");
  const endpointMap = new Map(
    endpoints.map(({ availability }) => [availability.value.endpointId, availability.value]),
  );
  const results = factsOfType(facts, "result");
  const armEstimates = factsOfType(facts, "arm_estimate");
  const hypotheses = factsOfType(facts, "statistical_hypothesis");
  const sampleSize = factsOfType(facts, "population_sample_size")[0];
  const population = factsOfType(facts, "population_condition")[0];
  const duration = factsOfType(facts, "treatment_duration")[0];
  const safetyEvents = factsOfType(facts, "safety_event");
  const safetyComparisons = factsOfType(facts, "safety_comparison");
  const registryFacts = factsOfType(facts, "registry_identifier");
  const primaryEndpoints = endpoints.filter(({ availability }) =>
    ["primary", "co_primary"].includes(availability.value.role),
  );
  const primaryResults = results.filter(({ availability }) =>
    primaryEndpoints.some(
      ({ availability: endpoint }) => endpoint.value.endpointId === availability.value.endpointId,
    ),
  );

  if (!arms.length || !endpoints.length || !results.length || !primaryEndpoints.length)
    throw new Error(
      "Cannot compose an RCT DoseDocument without arms, endpoints, results, and a primary endpoint",
    );

  const intervention = arms.find(({ availability }) => !availability.value.comparator)?.availability
    .value;
  const comparator = arms.find(({ availability }) => availability.value.comparator)?.availability
    .value;
  const primaryEndpoint = primaryEndpoints[0].availability.value;
  const noninferiority = hypotheses.find(
    ({ availability }) => availability.value.endpointId === primaryEndpoint.endpointId,
  );
  const noninferiorityClaim = noninferiority
    ? input.interpretation.claims.find(({ inputFactIds }) =>
        inputFactIds.includes(noninferiority.id),
      )
    : undefined;
  const headline =
    noninferiority?.availability.value.conclusion === "noninferiority_met" && noninferiorityClaim
      ? `${intervention?.label ?? "A intervenção"} foi não inferior a ${comparator?.label ?? "o comparador"} para ${primaryEndpoint.name}`
      : `${intervention?.label ?? "Intervenção"} versus ${comparator?.label ?? "comparador"}: resultados de ${primaryEndpoint.name}`;

  const designFeatures = factsOfType(facts, "study_design_feature")
    .filter(({ availability }) => availability.value.value)
    .map(({ availability }) => availability.value.feature.replaceAll("_", " "));
  const phase = factsOfType(facts, "phase")[0]?.availability.value.value.replace("_", " ");
  const blinding = factsOfType(facts, "blinding")[0]?.availability.value.value.replaceAll("_", " ");
  const deck = sentence([
    `Ensaio ${[phase, ...designFeatures, blinding].filter(Boolean).join(", ")}.`,
    population ? `População: ${population.availability.value.condition}.` : undefined,
    `Comparação: ${formatArms(arms).join(" versus ")}.`,
    `Desfecho ${primaryEndpoint.role === "co_primary" ? "coprimário" : "primário"}: ${primaryEndpoint.name}.`,
  ]);

  const designFactIds = [
    ...factsOfType(facts, "study_design_feature").map(({ id }) => id),
    ...factsOfType(facts, "phase").map(({ id }) => id),
    ...factsOfType(facts, "blinding").map(({ id }) => id),
    ...arms.map(({ id }) => id),
    ...(sampleSize ? [sampleSize.id] : []),
    ...(population ? [population.id] : []),
    ...(duration ? [duration.id] : []),
  ];
  const designSteps = [
    ...(sampleSize
      ? [{ id: "design-size", label: `${sampleSize.availability.value.value} participantes` }]
      : []),
    { id: "design-arms", label: formatArms(arms).join(" · ") },
    ...(duration
      ? [
          {
            id: "design-duration",
            label: `Acompanhamento/tratamento: ${formatDuration(duration.availability.value.duration)}`,
          },
        ]
      : []),
    { id: "design-primary", label: `Desfecho principal: ${primaryEndpoint.name}` },
  ];

  const endpointParagraphs = endpoints.map(({ availability }) => {
    const endpoint = availability.value;
    const role =
      endpoint.role === "secondary"
        ? "secundário"
        : endpoint.role === "co_primary"
          ? "coprimário"
          : "primário";
    const components = endpoint.components?.length
      ? ` O desfecho composto incluiu: ${endpoint.components.map(({ name }) => name).join(", ")}. Os resultados apresentados pertencem ao composto, não a cada componente isoladamente.`
      : "";
    return `${endpoint.name} (${role}), medido em ${formatDuration(endpoint.timepoint)}: ${endpoint.measure}.${components}`;
  });

  const resultBlocks: DoseDocument["chapters"][number]["blocks"] = results.map((fact, index) => {
    const result = fact.availability.value;
    const endpoint = endpointMap.get(result.endpointId);
    const claim = input.interpretation.claims.find(({ inputFactIds }) =>
      inputFactIds.includes(fact.id),
    );
    const hypothesis = hypotheses.find(
      ({ availability }) => availability.value.resultFactId === fact.id,
    );
    const hypothesisText = hypothesis
      ? ` Margem de não inferioridade: ${withUnit(hypothesis.availability.value.margin.value, hypothesis.availability.value.margin.unit)}; regra: limite superior do IC ${hypothesis.availability.value.decisionRule.operator === "less_than" ? "abaixo" : hypothesis.availability.value.decisionRule.operator} da margem; conclusão estruturada: ${hypothesis.availability.value.conclusion === "noninferiority_met" ? "não inferioridade atingida" : "não inferioridade não atingida"}.`
      : "";
    return {
      id: `result-${index + 1}`,
      kind: "result",
      endpoint: endpoint?.name ?? result.endpointId,
      estimate: formatResultEstimate(result),
      confidenceInterval:
        result.estimate.confidenceInterval.status === "available"
          ? formatConfidenceInterval(result.estimate.confidenceInterval.value, result.estimate.unit)
          : "Intervalo de confiança não disponível na fonte estruturada",
      pValue:
        result.estimate.pValue.status === "available"
          ? formatPValue(result.estimate.pValue.value)
          : hypothesis?.availability.value.pValue.status === "available"
            ? `${formatPValue(hypothesis.availability.value.pValue.value)} (não inferioridade)`
            : "Valor de P não disponível ou não aplicável",
      comparison: resultComparison(result, armMap, armEstimates),
      timepoint: `${formatDuration(result.timepoint)}${result.analysisType === "time_to_event" ? " · análise de tempo até o evento" : ""}`,
      interpretation: `${claim?.statement ?? "Nenhuma interpretação estruturada foi fornecida para este resultado."}${hypothesisText}`,
      factIds: [fact.id, ...(hypothesis ? [hypothesis.id] : [])],
    };
  });

  const chapters: DoseDocument["chapters"] = [
    {
      id: "chapter-understand",
      title: "Para entender o estudo",
      blocks: [
        {
          id: "understand-prose",
          kind: "prose",
          paragraphs: [
            sentence([
              population
                ? `O estudo avaliou ${population.availability.value.condition}.`
                : undefined,
              `A intervenção foi ${intervention?.label ?? "a intervenção descrita"} e o comparador foi ${comparator?.label ?? "o comparador descrito"}.`,
              noninferiority ? "A hipótese principal foi de não inferioridade." : undefined,
            ]),
          ],
          factIds: [
            ...(population ? [population.id] : []),
            ...arms.map(({ id }) => id),
            ...(noninferiority ? [noninferiority.id] : []),
          ],
        },
      ],
    },
    {
      id: "chapter-study",
      title: "Como o estudo foi feito?",
      blocks: [
        {
          id: "study-design",
          kind: "study_design",
          label: "Estrutura derivada dos fatos do estudo",
          steps: designSteps,
          factIds: designFactIds,
        },
      ],
    },
    {
      id: "chapter-endpoints",
      title: "Quais desfechos foram avaliados?",
      blocks: [
        {
          id: "endpoints-prose",
          kind: "prose",
          paragraphs: endpointParagraphs,
          factIds: endpoints.map(({ id }) => id),
        },
      ],
    },
    { id: "chapter-results", title: "Quais foram os resultados?", blocks: resultBlocks },
  ];

  const interpretiveClaims = input.interpretation.claims.filter(
    ({ claimType, inputFactIds }) => claimType !== "source_boundary" && inputFactIds.length,
  );
  if (interpretiveClaims.length)
    chapters.push({
      id: "chapter-interpretation",
      title: "Como interpretar os resultados?",
      blocks: [
        {
          id: "interpretation-prose",
          kind: "prose",
          paragraphs: interpretiveClaims.map(({ statement }) => statement),
          factIds: [...new Set(interpretiveClaims.flatMap(({ inputFactIds }) => inputFactIds))],
        },
      ],
    });

  if (safetyEvents.length || safetyComparisons.length) {
    const events = safetyEvents.map(({ availability }, index) => {
      const value = availability.value;
      const armLabels = value.arms
        .map(({ armId }) => armMap.get(armId)?.label ?? armId)
        .join(" + ");
      const denominator =
        value.denominator.status === "available" ? `; denominador ${value.denominator.value}` : "";
      return {
        id: `safety-event-${index + 1}`,
        label: `${value.event} · ${armLabels}`,
        value: `${withUnit(value.frequency.value, value.frequency.unit)}${denominator}`,
      };
    });
    const comparisons = safetyComparisons.map(({ availability }) => {
      const { scope, finding } = availability.value;
      return `${scope}: ${finding === "similar" ? "frequência semelhante entre os braços" : finding === "higher_in_intervention" ? "maior no braço de intervenção" : "menor no braço de intervenção"}`;
    });
    chapters.push({
      id: "chapter-safety",
      title: "Segurança",
      blocks: [
        {
          id: "safety-summary",
          kind: "safety",
          summary: comparisons.join(". ") || "Eventos de segurança estruturados na fonte.",
          events: events.length
            ? events
            : comparisons.map((value, index) => ({
                id: `safety-comparison-${index + 1}`,
                label: "Comparação",
                value,
              })),
          caveat: safetyEvents.some(
            ({ availability }) => availability.value.denominator.status !== "available",
          )
            ? "A fonte estruturada não informou denominadores para todos os eventos; o tamanho randomizado dos braços não foi usado como denominador de análise."
            : "Os denominadores exibidos são somente os explicitamente estruturados na fonte.",
          factIds: [...safetyEvents, ...safetyComparisons].map(({ id }) => id),
        },
      ],
    });
  }

  const basedOn = [
    ...new Set(
      input.sourceSet.coverage.sourceKinds.filter(
        (kind): kind is "metadata" | "abstract" => kind === "metadata" || kind === "abstract",
      ),
    ),
  ];
  if (!basedOn.length)
    throw new Error("DoseDocument v1 can only declare metadata or abstract source coverage");
  const primaryNumbers = primaryResults.length ? primaryResults : results;
  const keyNumbers: DoseDocument["keyNumbers"] = [
    ...(sampleSize
      ? [
          {
            id: "number-sample",
            value: String(sampleSize.availability.value.value),
            label: "participantes",
            context: "tamanho total estruturado; não é denominador de análise",
            factIds: [sampleSize.id],
          },
        ]
      : []),
    ...primaryNumbers.slice(0, 3).map((fact, index) => ({
      id: `number-result-${index + 1}`,
      value: formatResultEstimate(fact.availability.value),
      label:
        endpointMap.get(fact.availability.value.endpointId)?.name ??
        fact.availability.value.endpointId,
      context: formatDuration(fact.availability.value.timepoint),
      factIds: [fact.id],
    })),
  ];
  if (!keyNumbers.length)
    throw new Error("Cannot compose a DoseDocument without a structured key number");

  const document = {
    schemaVersion: "dose-document.v1" as const,
    id: `dose:${input.factSet.id}:pt-BR:generic-v1`,
    articleId: input.factSet.articleId,
    language: "pt-BR" as const,
    label: "Edição editorial Dose" as const,
    headline,
    deck,
    openingSummary: [
      {
        id: "opening-study",
        text: deck,
        factIds: [...designFactIds, ...primaryEndpoints.map(({ id }) => id)],
      },
      {
        id: "opening-review-boundary",
        text: reviewBoundary(input.interpretation.claims),
        factIds: primaryResults.map(({ id }) => id).length
          ? primaryResults.map(({ id }) => id)
          : [results[0].id],
      },
    ],
    chapters,
    keyNumbers,
    contextualExplainers: input.interpretation.claims.length
      ? input.interpretation.claims.map((claim, index) => ({
          id: `interpretation-${index + 1}`,
          title:
            claim.claimType === "source_boundary" ? "Limite da fonte" : "Interpretação estruturada",
          body: `${claim.statement} Revisão humana: ${claim.requiresHumanReview ? "obrigatória" : "não exigida"}; status: ${claim.reviewStatus}; estado operacional: ${claim.operationalStatus}.`,
          factIds: claim.inputFactIds.length ? claim.inputFactIds : [results[0].id],
        }))
      : [
          {
            id: "interpretation-unavailable",
            title: "Interpretação",
            body: "Nenhuma interpretação estruturada foi fornecida.",
            factIds: [results[0].id],
          },
        ],
    sourceCoverage: {
      id: "source-coverage",
      basedOn,
      notCovered: input.sourceSet.coverage.hasAuthorizedFullText
        ? ["fontes não representadas no conjunto científico validado"]
        : ["texto completo", "tabelas", "figuras", "suplementos"],
      statement: input.sourceSet.coverage.hasAuthorizedFullText
        ? "Esta análise usa somente as fontes identificadas no conjunto científico validado."
        : `Esta análise foi construída a partir ${basedOn.includes("metadata") ? "dos metadados e " : ""}do resumo indexado. Não houve revisão autorizada do texto completo, tabelas, figuras ou suplementos.`,
    },
    sourceReferences: sourceReferences(input.sourceSet, registryFacts, input.metadata),
  };

  void input.metadata.title;
  return doseDocumentSchema.parse(document);
}
