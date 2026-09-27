import { z } from "zod";

export const SCIENTIFIC_EDITORIAL_DRAFT_VERSION = "scientific-editorial-draft.v4" as const;
export const EDITORIAL_GENERATION_PROFILE_VERSION = "editorial-generation-profile.v1" as const;
export const CONTEXTUAL_SCIENTIFIC_MATERIAL_VERSION = "contextual-scientific-material.v1" as const;

/** Canonical units for numeric fact fields whose rct.v1 shape has no explicit `unit` property. */
export const SCIENTIFIC_EDITORIAL_STRUCTURAL_QUANTITATIVE_UNITS = {
  participantCount: "participant",
  allocationPart: "allocation_part",
  confidenceLevelPercent: "percent",
  pValue: "p_value",
} as const;

const id = z.string().trim().min(1).max(200);
const text = z.string().trim().min(1).max(10_000);

export const editorialBlockKindSchema = z.enum([
  "headline",
  "deck",
  "scientific_context",
  "mechanistic_context",
  "research_question",
  "study_design",
  "population",
  "intervention_comparator",
  "endpoint_explanation",
  "primary_result",
  "secondary_result",
  "safety",
  "interpretation",
  "limitations",
  "what_this_adds",
  "contextual_explainer",
  "source_boundary",
]);

export const epistemicStatusSchema = z.enum([
  "observed_clinical_result",
  "proposed_mechanism",
  "association",
  "hypothesis",
  "demonstrated_causality",
  "causality_not_demonstrated",
  "noninferiority",
  "equivalence",
  "superiority",
  "therapeutic_recommendation",
  "source_coverage",
]);

export const claimGroundingSchema = z
  .object({
    factIds: z.array(id).default([]),
    interpretationClaimIds: z.array(id).default([]),
    evidenceAnchorIds: z.array(id).default([]),
    sourceDocumentIds: z.array(id).default([]),
    externalContextReferenceIds: z.array(id).default([]),
  })
  .strict();

const scientificEditorialClaimSchema = z
  .object({
    id,
    text,
    statementKind: z.enum([
      "article_supported_fact",
      "deterministic_interpretation",
      "contextual_explanation",
      "editorial_transition",
    ]),
    grounding: claimGroundingSchema,
    epistemicStatus: epistemicStatusSchema.optional(),
    quantitativeClaims: z
      .array(z.object({ value: z.number().finite(), unit: id, factId: id }).strict())
      .default([]),
    sourceRequirement: z
      .enum(["declared_coverage", "authorized_full_text"])
      .default("declared_coverage"),
  })
  .strict();

/** A boundary reference contains no model-authored prose or scientific-claim fields. */
const editorialBoundaryExplanationSchema = z
  .object({
    id,
    statementKind: z.literal("boundary_explanation"),
    boundaryId: id,
  })
  .strict();

export const editorialClaimSchema = z.discriminatedUnion("statementKind", [
  scientificEditorialClaimSchema,
  editorialBoundaryExplanationSchema,
]);

export const editorialBlockSchema = z
  .object({
    id,
    kind: editorialBlockKindSchema,
    disclosureLayer: z.enum(["opening", "core", "deep_dive"]),
    title: text.optional(),
    claims: z.array(editorialClaimSchema).min(1),
  })
  .strict();

export const scientificEditorialDraftSchema = z
  .object({
    schemaVersion: z.literal(SCIENTIFIC_EDITORIAL_DRAFT_VERSION),
    id,
    articleId: id,
    language: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    inputLineage: z
      .object({ sourceSetId: id, evidenceSetId: id, factSetId: id, interpretationArtifactId: id })
      .strict(),
    blocks: z.array(editorialBlockSchema).min(1),
    requiresHumanReview: z.literal(true),
    reviewStatus: z.literal("pending"),
  })
  .strict();

type JsonSchemaNode = Record<string, unknown>;

function strictProviderSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictProviderSchema);
  if (!node || typeof node !== "object") return node;
  const source = node as JsonSchemaNode;
  const output = Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => key !== "$schema" && key !== "default")
      .map(([key, value]) => [key, strictProviderSchema(value)]),
  ) as JsonSchemaNode;
  if (source.type === "object" && source.properties && typeof source.properties === "object") {
    const properties = output.properties as JsonSchemaNode;
    const originallyRequired = new Set(Array.isArray(source.required) ? source.required : []);
    for (const key of Object.keys(properties))
      if (!originallyRequired.has(key))
        properties[key] = { anyOf: [properties[key], { type: "null" }] };
    output.required = Object.keys(properties);
  }
  return output;
}

/**
 * Provider-facing strict schema. Optional contract fields are nullable here because OpenAI strict
 * output requires every property; nulls are removed after parsing and before runtime validation.
 */
export const scientificEditorialDraftJsonSchema = strictProviderSchema(
  z.toJSONSchema(scientificEditorialDraftSchema, { reused: "inline" }),
);

export const contextualScientificMaterialSchema = z
  .object({
    schemaVersion: z.literal(CONTEXTUAL_SCIENTIFIC_MATERIAL_VERSION),
    id,
    articleId: id,
    claims: z
      .array(
        z
          .object({
            id,
            statement: text,
            epistemicStatus: epistemicStatusSchema,
            provenance: z
              .object({
                sourceDocumentIds: z.array(id).default([]),
                evidenceAnchorIds: z.array(id).default([]),
                externalContextReferenceIds: z.array(id).default([]),
              })
              .strict(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

/** Presentation policy only. It never adds scientific facts or permitted conclusions. */
export const editorialGenerationProfileSchema = z
  .object({
    version: z.literal(EDITORIAL_GENERATION_PROFILE_VERSION),
    targetLanguage: z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/),
    audience: z.literal("health_professionals"),
    comprehensionDepth: z.literal("progressive"),
  })
  .strict();

export type ScientificEditorialDraft = z.infer<typeof scientificEditorialDraftSchema>;
export type ContextualScientificMaterial = z.infer<typeof contextualScientificMaterialSchema>;
export type EditorialClaim = z.infer<typeof editorialClaimSchema>;
export type EditorialBlockKind = z.infer<typeof editorialBlockKindSchema>;
export type EditorialGenerationProfile = z.infer<typeof editorialGenerationProfileSchema>;
