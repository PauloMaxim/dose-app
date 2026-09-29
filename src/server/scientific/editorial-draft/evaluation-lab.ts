import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScientificEditorialProvider } from "./provider.server";
import {
  ValidatedScientificEditorialDraftGenerator,
  type GenerateEditorialDraftInput,
} from "./generator";
import { SCIENTIFIC_EDITORIAL_PROMPT_VERSION } from "./prompt";
import { createPmid42717033InterventionInput } from "./real-generation.server";
import type { EditorialDraftValidationIssue } from "./validation";

export const EDITORIAL_EVALUATION_PROTOCOL_VERSION = "editorial-evaluation.v2" as const;
export const PMID_42717033_EVALUATION_CASE_ID = "editorial-evaluation:pmid:42717033:v2" as const;

const nonEmpty = z.string().trim().min(1);
const nonNegativeFinite = z.number().finite().nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();
const criterionSchema = z
  .object({ rating: z.number().int().min(1).max(5), notes: nonEmpty })
  .strict();
const humanReviewSchema = z
  .object({
    reviewerId: nonEmpty,
    reviewedAt: z.iso.datetime(),
    fidelityToFactsNumbersUnitsIntervalsAndHorizons: criterionSchema,
    preservationOfLimitationsAndScientificUncertainty: criterionSchema,
    ungroundedClaimsAndImproperExtrapolations: criterionSchema,
    authorizedExternalContextUse: criterionSchema,
    scientificallyRelevantOmissions: criterionSchema,
    editorialClarityDepthAndOrganization: criterionSchema,
    correctionRequired: z
      .object({ level: z.enum(["none", "minor", "major", "rewrite"]), notes: nonEmpty })
      .strict(),
    reviewTimeMinutes: nonNegativeFinite,
  })
  .strict();
const metricsSchema = z
  .object({
    tokenUsage: z
      .object({
        inputTokens: nonNegativeInteger,
        outputTokens: nonNegativeInteger,
        source: z.literal("provider_reported"),
      })
      .strict()
      .nullable(),
    cost: z
      .discriminatedUnion("kind", [
        z
          .object({ kind: z.literal("estimated"), amountUsd: nonNegativeFinite, basis: nonEmpty })
          .strict(),
        z.object({ kind: z.literal("provider_reported"), amountUsd: nonNegativeFinite }).strict(),
      ])
      .nullable(),
    latency: z
      .object({
        milliseconds: nonNegativeFinite,
        source: z.enum(["provider_reported", "client_measured"]),
      })
      .strict()
      .nullable(),
  })
  .strict();
const runConfigurationSchema = z
  .object({
    providerIdentifier: nonEmpty,
    modelIdentifier: nonEmpty,
    shared: z
      .object({
        maxOutputTokens: z.number().int().positive(),
        responseFormat: z.literal("scientific_editorial_draft.v5.strict_json_schema"),
        additionalInstructions: z.null(),
      })
      .strict(),
    modelSpecific: z.record(z.string(), z.json()),
  })
  .strict();
const recordedResponseSchema = z
  .object({
    experimentId: nonEmpty,
    caseId: z.literal(PMID_42717033_EVALUATION_CASE_ID),
    caseFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    modelIdentifier: nonEmpty,
    configuration: runConfigurationSchema,
    provenance: z.enum(["recorded_model_output", "synthetic_test_fixture"]),
    response: z.unknown(),
    metrics: metricsSchema.nullable(),
    humanReview: humanReviewSchema.nullable(),
  })
  .strict();

export type EditorialEvaluationMetrics = z.infer<typeof metricsSchema>;
export type EditorialHumanReview = z.infer<typeof humanReviewSchema>;
export type EditorialEvaluationRunConfiguration = z.infer<typeof runConfigurationSchema>;
export type RecordedEditorialEvaluationResponse = z.infer<typeof recordedResponseSchema>;

export interface EditorialEvaluationCaseSnapshot {
  protocolVersion: typeof EDITORIAL_EVALUATION_PROTOCOL_VERSION;
  caseId: typeof PMID_42717033_EVALUATION_CASE_ID;
  caseFingerprint: string;
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
  experimentId: string;
  caseSnapshot: EditorialEvaluationCaseSnapshot;
  modelIdentifier: string;
  configuration: EditorialEvaluationRunConfiguration;
  responseProvenance: RecordedEditorialEvaluationResponse["provenance"];
  automaticEvaluation: {
    scope: "deterministic_structure_and_grounding_contract_only";
    validationStatus: "passed" | "rejected";
    validationErrors: EditorialDraftValidationIssue[];
    scientificApproval: false;
  };
  humanReview: EditorialHumanReview | null;
  metrics: EditorialEvaluationMetrics | null;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Case fingerprint input must be JSON-serializable");
  return serialized;
}

/** Covers the complete scientific input, context limits, editorial profile and prompt version. */
export function computeEditorialEvaluationCaseFingerprint(
  input: GenerateEditorialDraftInput,
): string {
  const canonical = canonicalJson({ promptVersion: SCIENTIFIC_EDITORIAL_PROMPT_VERSION, input });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

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
      caseFingerprint: computeEditorialEvaluationCaseFingerprint(input),
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
  candidate: unknown,
): Promise<EditorialEvaluationRunReport> {
  const recorded = recordedResponseSchema.parse(candidate);
  const { snapshot, input } = createPmid42717033EvaluationCase();
  if (recorded.caseFingerprint !== snapshot.caseFingerprint)
    throw new Error("Recorded response does not belong to the frozen evaluation case");
  if (recorded.modelIdentifier !== recorded.configuration.modelIdentifier)
    throw new Error("Recorded model identifier does not match its explicit configuration");
  const result = await new ValidatedScientificEditorialDraftGenerator(
    new RecordedResponseProvider(recorded.response),
  ).generate(input);
  return {
    experimentId: recorded.experimentId,
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
    humanReview: recorded.humanReview,
    metrics: recorded.metrics,
  };
}

function modelSpecificDifferences(
  left: EditorialEvaluationRunConfiguration,
  right: EditorialEvaluationRunConfiguration,
): string[] {
  const keys = new Set([...Object.keys(left.modelSpecific), ...Object.keys(right.modelSpecific)]);
  return [...keys]
    .sort()
    .filter((key) => {
      if (!(key in left.modelSpecific) || !(key in right.modelSpecific)) return true;
      return canonicalJson(left.modelSpecific[key]) !== canonicalJson(right.modelSpecific[key]);
    })
    .map((key) => `modelSpecific.${key}`);
}

/** Keeps comparable runs side by side without ranking or choosing a production model. */
export async function compareRecordedEditorialResponses(
  candidates: readonly [unknown, unknown],
): Promise<{
  experimentId: string;
  caseId: typeof PMID_42717033_EVALUATION_CASE_ID;
  configurationDifferences: string[];
  runs: EditorialEvaluationRunReport[];
}> {
  const responses = candidates.map((candidate) => recordedResponseSchema.parse(candidate));
  if (responses[0].experimentId !== responses[1].experimentId)
    throw new Error("Comparison requires responses from the same experiment");
  if (
    responses[0].caseId !== responses[1].caseId ||
    responses[0].caseFingerprint !== responses[1].caseFingerprint
  )
    throw new Error("Comparison requires responses from the same frozen case");
  if (responses[0].modelIdentifier === responses[1].modelIdentifier)
    throw new Error("Comparison requires two distinct model identifiers");
  if (
    canonicalJson(responses[0].configuration.shared) !==
    canonicalJson(responses[1].configuration.shared)
  )
    throw new Error("Comparison requires equivalent shared generation conditions");
  return {
    experimentId: responses[0].experimentId,
    caseId: PMID_42717033_EVALUATION_CASE_ID,
    configurationDifferences: [
      ...(responses[0].configuration.providerIdentifier !==
      responses[1].configuration.providerIdentifier
        ? ["providerIdentifier"]
        : []),
      "modelIdentifier",
      ...modelSpecificDifferences(responses[0].configuration, responses[1].configuration),
    ],
    runs: await Promise.all(responses.map(evaluateRecordedEditorialResponse)),
  };
}
