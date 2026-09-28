import { z } from "zod";
import {
  rctScientificFactSetSchema,
  scientificEvidenceSetSchema,
  scientificInterpretationArtifactSchema,
  scientificSourceSetSchema,
  validateEditorialPipeline,
  type RCTScientificFactSet,
  type ScientificEvidenceSet,
  type ScientificInterpretationArtifact,
  type ScientificSourceSet,
} from "./editorial-pipeline";

export const CONTEXTUAL_NEED_VERSION = "contextual-need.v1" as const;
export const CONTEXTUAL_NEED_DETECTOR = {
  name: "central-endpoint-structural-gap",
  version: "1",
} as const;

const id = z.string().trim().min(1).max(200);

export const contextualNeedSchema = z
  .object({
    version: z.literal(CONTEXTUAL_NEED_VERSION),
    articleId: id,
    subject: z
      .object({
        kind: z.literal("endpoint_measure"),
        endpointId: id,
        name: id,
        measure: id,
      })
      .strict(),
    supportingFactIds: z.array(id).min(2),
    evidenceAnchorIds: z.array(id).min(1),
    detectedGap: z.literal("endpoint_measure_definition_not_structured"),
    contextualQuestion: z.string().trim().min(1).max(500),
    editorialPurpose: z.literal("explain_endpoint_measure"),
    method: z
      .object({
        name: z.literal(CONTEXTUAL_NEED_DETECTOR.name),
        version: z.literal(CONTEXTUAL_NEED_DETECTOR.version),
      })
      .strict(),
    status: z.literal("candidate"),
  })
  .strict();

export type ContextualNeed = z.infer<typeof contextualNeedSchema>;

export interface DetectContextualNeedsInput {
  sourceSet: ScientificSourceSet;
  evidenceSet: ScientificEvidenceSet;
  factSet: RCTScientificFactSet;
  interpretation: ScientificInterpretationArtifact;
}

function assertValidInput(input: DetectContextualNeedsInput) {
  const parsed = {
    sourceSet: scientificSourceSetSchema.parse(input.sourceSet),
    evidenceSet: scientificEvidenceSetSchema.parse(input.evidenceSet),
    factSet: rctScientificFactSetSchema.parse(input.factSet),
    interpretation: scientificInterpretationArtifactSchema.parse(input.interpretation),
  };
  const pipelineValidation = validateEditorialPipeline(parsed);
  if (!pipelineValidation.valid)
    throw new Error(
      `Contextual need detection requires a valid editorial pipeline: ${pipelineValidation.errors
        .map(({ code }) => code)
        .join(", ")}`,
    );

  for (const [artifact, value] of Object.entries(parsed))
    if (value.validation.status !== "valid")
      throw new Error(`Contextual need detection requires validated ${artifact}.`);

  return parsed;
}

function resolveEvidenceAnchorIds(factIds: string[], factSet: RCTScientificFactSet) {
  const factsById = new Map(factSet.facts.map((fact) => [fact.id, fact]));
  const visited = new Set<string>();
  const anchorIds = new Set<string>();

  function visit(factId: string) {
    if (visited.has(factId)) return;
    visited.add(factId);
    const fact = factsById.get(factId);
    if (!fact) return;
    for (const provenance of fact.provenance) {
      if (provenance.target.kind === "evidence_anchor") anchorIds.add(provenance.target.id);
      else visit(provenance.target.id);
    }
  }

  for (const factId of factIds) visit(factId);
  return [...anchorIds].sort();
}

export function detectContextualNeeds(input: DetectContextualNeedsInput): ContextualNeed[] {
  const { factSet } = assertValidInput(input);
  const availableFacts = factSet.facts.filter((fact) => fact.availability.status === "available");
  const resultFactIdsByEndpoint = new Map<string, string[]>();

  for (const fact of availableFacts) {
    const value = fact.availability.status === "available" ? fact.availability.value : undefined;
    if (value?.type !== "result") continue;
    const ids = resultFactIdsByEndpoint.get(value.endpointId) ?? [];
    ids.push(fact.id);
    resultFactIdsByEndpoint.set(value.endpointId, ids);
  }

  const candidates: ContextualNeed[] = [];
  for (const fact of availableFacts) {
    const endpoint = fact.availability.status === "available" ? fact.availability.value : undefined;
    if (
      endpoint?.type !== "endpoint" ||
      !["primary", "co_primary"].includes(endpoint.role) ||
      endpoint.components
    )
      continue;

    const resultFactIds = (resultFactIdsByEndpoint.get(endpoint.endpointId) ?? []).sort();
    if (resultFactIds.length === 0) continue;
    const supportingFactIds = [fact.id, ...resultFactIds];
    const evidenceAnchorIds = resolveEvidenceAnchorIds(supportingFactIds, factSet);

    candidates.push(
      contextualNeedSchema.parse({
        version: CONTEXTUAL_NEED_VERSION,
        articleId: factSet.articleId,
        subject: {
          kind: "endpoint_measure",
          endpointId: endpoint.endpointId,
          name: endpoint.name,
          measure: endpoint.measure,
        },
        supportingFactIds,
        evidenceAnchorIds,
        detectedGap: "endpoint_measure_definition_not_structured",
        contextualQuestion: `What does ${endpoint.measure} measure?`,
        editorialPurpose: "explain_endpoint_measure",
        method: CONTEXTUAL_NEED_DETECTOR,
        status: "candidate",
      }),
    );
  }

  return candidates.sort((left, right) =>
    left.subject.endpointId.localeCompare(right.subject.endpointId, "en"),
  );
}
