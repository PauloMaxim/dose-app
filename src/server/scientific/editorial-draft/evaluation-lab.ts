import type { ScientificEditorialProvider } from "./provider.server";
import {
  ValidatedScientificEditorialDraftGenerator,
  type GenerateEditorialDraftInput,
} from "./generator";
import { SCIENTIFIC_EDITORIAL_PROMPT_VERSION } from "./prompt";
import { createPmid42717033InterventionInput } from "./real-generation.server";
import type { EditorialDraftValidationIssue } from "./validation";

export const EDITORIAL_EVALUATION_PROTOCOL_VERSION = "editorial-evaluation.v1" as const;
export const PMID_42717033_EVALUATION_CASE_ID = "editorial-evaluation:pmid:42717033:v1" as const;
export type RecordedResponseProvenance = "recorded_model_output" | "synthetic_test_fixture";

export interface EditorialEvaluationMetrics {
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number | null;
}
export interface HumanCriterionAssessment {
  rating: number;
  notes: string;
}
export interface EditorialHumanReview {
  fidelityToFactsNumbersUnitsIntervalsAndHorizons: HumanCriterionAssessment | null;
  preservationOfLimitationsAndScientificUncertainty: HumanCriterionAssessment | null;
  ungroundedClaimsAndImproperExtrapolations: HumanCriterionAssessment | null;
  authorizedExternalContextUse: HumanCriterionAssessment | null;
  scientificallyRelevantOmissions: HumanCriterionAssessment | null;
  editorialClarityDepthAndOrganization: HumanCriterionAssessment | null;
  correctionRequired: HumanCriterionAssessment | null;
  reviewTimeMinutes: number | null;
  reviewerId: string | null;
  reviewedAt: string | null;
}
export interface RecordedEditorialEvaluationResponse {
  modelIdentifier: string;
  configuration: Readonly<Record<string, unknown>>;
  provenance: RecordedResponseProvenance;
  response: unknown;
  metrics?: Partial<EditorialEvaluationMetrics>;
  humanReview?: Partial<EditorialHumanReview>;
}
export interface EditorialEvaluationCaseSnapshot {
  protocolVersion: typeof EDITORIAL_EVALUATION_PROTOCOL_VERSION;
  caseId: typeof PMID_42717033_EVALUATION_CASE_ID;
  articleId: "pmid:42717033";
  promptVersion: typeof SCIENTIFIC_EDITORIAL_PROMPT_VERSION;
  editorialProfile: GenerateEditorialDraftInput["editorialProfile"];
  artifacts: {
    sourceSet: { id: string; version: string };
    evidenceSet: { id: string; version: string };
    factSet: { id: string; version: string };
    interpretation: { id: string; version: string };
    contextualMaterial: ReadonlyArray<{ id: string; version: string }>;
  };
  authorizedContextLimits: {
    sourceAccessScopes: readonly string[];
    externalContextReferenceIds: readonly string[];
    contextualClaimIds: readonly string[];
  };
}
export interface EditorialEvaluationRunReport {
  caseSnapshot: EditorialEvaluationCaseSnapshot;
  modelIdentifier: string;
  configuration: Readonly<Record<string, unknown>>;
  responseProvenance: RecordedResponseProvenance;
  automaticEvaluation: {
    scope: "deterministic_structure_and_grounding_contract_only";
    validationStatus: "passed" | "rejected";
    validationErrors: EditorialDraftValidationIssue[];
    scientificApproval: false;
  };
  humanReview: EditorialHumanReview;
  metrics: EditorialEvaluationMetrics;
}

const emptyMetrics = (): EditorialEvaluationMetrics => ({
  inputTokens: null,
  outputTokens: null,
  estimatedCostUsd: null,
  latencyMs: null,
});
const emptyHumanReview = (): EditorialHumanReview => ({
  fidelityToFactsNumbersUnitsIntervalsAndHorizons: null,
  preservationOfLimitationsAndScientificUncertainty: null,
  ungroundedClaimsAndImproperExtrapolations: null,
  authorizedExternalContextUse: null,
  scientificallyRelevantOmissions: null,
  editorialClarityDepthAndOrganization: null,
  correctionRequired: null,
  reviewTimeMinutes: null,
  reviewerId: null,
  reviewedAt: null,
});

/** Freezes the reviewed canary inputs; adding cases requires a separate reviewed case definition. */
export function createPmid42717033EvaluationCase(): {
  snapshot: EditorialEvaluationCaseSnapshot;
  input: GenerateEditorialDraftInput;
} {
  const input = createPmid42717033InterventionInput();
  return {
    snapshot: {
      protocolVersion: EDITORIAL_EVALUATION_PROTOCOL_VERSION,
      caseId: PMID_42717033_EVALUATION_CASE_ID,
      articleId: "pmid:42717033",
      promptVersion: SCIENTIFIC_EDITORIAL_PROMPT_VERSION,
      editorialProfile: structuredClone(input.editorialProfile),
      artifacts: {
        sourceSet: { id: input.sourceSet.id, version: input.sourceSet.version },
        evidenceSet: { id: input.evidenceSet.id, version: input.evidenceSet.version },
        factSet: { id: input.factSet.id, version: input.factSet.version },
        interpretation: {
          id: input.interpretationArtifact.id,
          version: input.interpretationArtifact.version,
        },
        contextualMaterial: input.contextualMaterial.map((material) => {
          const artifact = material as { id: string; schemaVersion: string };
          return { id: artifact.id, version: artifact.schemaVersion };
        }),
      },
      authorizedContextLimits: {
        sourceAccessScopes: [
          ...new Set(input.sourceSet.sourceDocuments.map((item) => item.accessScope)),
        ],
        externalContextReferenceIds: [...input.authorizedExternalContextReferenceIds],
        contextualClaimIds: input.contextualMaterial.flatMap((material) =>
          (material as { claims: Array<{ id: string }> }).claims.map(({ id }) => id),
        ),
      },
    },
    input,
  };
}

class RecordedResponseProvider implements ScientificEditorialProvider {
  constructor(private readonly response: unknown) {}
  async generate(): Promise<unknown> {
    return structuredClone(this.response);
  }
}

/** Offline only: validates an already-recorded response and performs no I/O or persistence. */
export async function evaluateRecordedEditorialResponse(
  recorded: RecordedEditorialEvaluationResponse,
): Promise<EditorialEvaluationRunReport> {
  if (!recorded.modelIdentifier.trim()) throw new Error("modelIdentifier is required");
  const { snapshot, input } = createPmid42717033EvaluationCase();
  const result = await new ValidatedScientificEditorialDraftGenerator(
    new RecordedResponseProvider(recorded.response),
  ).generate(input);
  return {
    caseSnapshot: snapshot,
    modelIdentifier: recorded.modelIdentifier,
    configuration: structuredClone(recorded.configuration),
    responseProvenance: recorded.provenance,
    automaticEvaluation: {
      scope: "deterministic_structure_and_grounding_contract_only",
      validationStatus: result.ok ? "passed" : "rejected",
      validationErrors: result.ok ? [] : result.errors,
      scientificApproval: false,
    },
    humanReview: { ...emptyHumanReview(), ...recorded.humanReview },
    metrics: { ...emptyMetrics(), ...recorded.metrics },
  };
}

/** Keeps runs side by side without ranking or choosing a production model. */
export async function compareRecordedEditorialResponses(
  responses: readonly [RecordedEditorialEvaluationResponse, RecordedEditorialEvaluationResponse],
): Promise<{
  caseId: typeof PMID_42717033_EVALUATION_CASE_ID;
  runs: EditorialEvaluationRunReport[];
}> {
  if (responses[0].modelIdentifier === responses[1].modelIdentifier)
    throw new Error("Comparison requires two distinct model identifiers");
  return {
    caseId: PMID_42717033_EVALUATION_CASE_ID,
    runs: await Promise.all(responses.map(evaluateRecordedEditorialResponse)),
  };
}
