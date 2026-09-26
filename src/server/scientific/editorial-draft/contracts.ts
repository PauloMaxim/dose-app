import { z } from "zod";

export const SCIENTIFIC_EDITORIAL_DRAFT_VERSION = "scientific-editorial-draft.v1" as const;
export const CONTEXTUAL_SCIENTIFIC_MATERIAL_VERSION = "contextual-scientific-material.v1" as const;

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

export const editorialClaimSchema = z
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
    conclusionIds: z.array(id).default([]),
    quantitativeClaims: z
      .array(z.object({ value: z.number().finite(), unit: id, factId: id }).strict())
      .default([]),
    sourceRequirement: z
      .enum(["declared_coverage", "authorized_full_text"])
      .default("declared_coverage"),
  })
  .strict();

export const editorialBlockSchema = z
  .object({
    id,
    kind: editorialBlockKindSchema,
    disclosureLayer: z.enum(["opening", "core", "deep_dive"]),
    title: text.optional(),
    claims: z.array(editorialClaimSchema).min(1),
  })
  .strict();

const conclusionSchema = z
  .object({
    id,
    statement: text,
    factIds: z.array(id).default([]),
    interpretationClaimIds: z.array(id).default([]),
    rule: z.enum([
      "supported_by_inputs",
      "do_not_infer_equivalence",
      "do_not_infer_superiority",
      "do_not_infer_causality",
      "do_not_recommend_treatment",
      "do_not_generalize_beyond_study",
      "do_not_claim_full_text_review",
      "other",
    ]),
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
    inferenceLimits: z
      .object({
        supportedConclusions: z.array(conclusionSchema),
        unsupportedConclusions: z.array(conclusionSchema),
      })
      .strict(),
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

export type ScientificEditorialDraft = z.infer<typeof scientificEditorialDraftSchema>;
export type ContextualScientificMaterial = z.infer<typeof contextualScientificMaterialSchema>;
export type EditorialClaim = z.infer<typeof editorialClaimSchema>;
export type EditorialBlockKind = z.infer<typeof editorialBlockKindSchema>;
