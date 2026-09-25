import type {
  RCTScientificFactSet,
  ScientificEvidenceSet,
  ScientificInterpretationArtifact,
  ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import {
  scientificEditorialDraftSchema,
  type ContextualScientificMaterial,
  type ScientificEditorialDraft,
} from "./contracts";

export type EditorialDraftValidationCode =
  | "DRAFT_SCHEMA_INVALID"
  | "DRAFT_LINEAGE_MISMATCH"
  | "DRAFT_ARTICLE_MISMATCH"
  | "FACT_NOT_FOUND"
  | "INTERPRETATION_CLAIM_NOT_FOUND"
  | "EVIDENCE_ANCHOR_NOT_FOUND"
  | "SOURCE_DOCUMENT_NOT_FOUND"
  | "EXTERNAL_CONTEXT_REFERENCE_NOT_FOUND"
  | "CONTEXT_PROVENANCE_REQUIRED"
  | "SCIENTIFIC_CLAIM_GROUNDING_REQUIRED"
  | "GROUNDING_KIND_INCOMPATIBLE"
  | "UNSUPPORTED_CONCLUSION_USED"
  | "FULL_TEXT_NOT_AVAILABLE"
  | "EQUIVALENCE_NOT_SUPPORTED"
  | "SUPERIORITY_NOT_SUPPORTED"
  | "CAUSALITY_NOT_SUPPORTED"
  | "THERAPEUTIC_RECOMMENDATION_NOT_AUTHORIZED"
  | "SOURCE_BOUNDARY_INCOMPATIBLE"
  | "QUANTITATIVE_CLAIM_NOT_IN_FACT";

export interface EditorialDraftValidationIssue {
  code: EditorialDraftValidationCode;
  path: string;
  message: string;
}

export interface ValidateScientificEditorialDraftInput {
  draft: ScientificEditorialDraft | unknown;
  sourceSet: ScientificSourceSet;
  evidenceSet: ScientificEvidenceSet;
  factSet: RCTScientificFactSet;
  interpretationArtifact: ScientificInterpretationArtifact;
  contextualMaterial?: ContextualScientificMaterial[];
  /** IDs are supplied only by a future, separately authorized context acquisition boundary. */
  authorizedExternalContextReferenceIds?: string[];
}

const substantiveKinds = new Set([
  "article_supported_fact",
  "deterministic_interpretation",
  "contextual_explanation",
]);

function hasGrounding(
  grounding: ScientificEditorialDraft["blocks"][number]["claims"][number]["grounding"],
) {
  return Object.values(grounding).some((values) => values.length > 0);
}

export function validateScientificEditorialDraft(input: ValidateScientificEditorialDraftInput): {
  valid: boolean;
  errors: EditorialDraftValidationIssue[];
} {
  const parsed = scientificEditorialDraftSchema.safeParse(input.draft);
  if (!parsed.success)
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        code: "DRAFT_SCHEMA_INVALID",
        path: issue.path.join("."),
        message: issue.message,
      })),
    };

  const draft = parsed.data;
  const errors: EditorialDraftValidationIssue[] = [];
  const add = (code: EditorialDraftValidationCode, path: string, message: string) =>
    errors.push({ code, path, message });
  const factIds = new Set(input.factSet.facts.map(({ id }) => id));
  const interpretationIds = new Set(input.interpretationArtifact.claims.map(({ id }) => id));
  const anchors = new Map(input.evidenceSet.anchors.map((anchor) => [anchor.id, anchor]));
  const sources = new Set(input.sourceSet.sourceDocuments.map(({ id }) => id));
  const externalIds = new Set(input.authorizedExternalContextReferenceIds ?? []);
  const contextClaims = new Map(
    (input.contextualMaterial ?? []).flatMap((material) =>
      material.claims.map((claim) => [claim.id, claim] as const),
    ),
  );

  if (draft.articleId !== input.sourceSet.articleId)
    add(
      "DRAFT_ARTICLE_MISMATCH",
      "articleId",
      "Draft and scientific inputs must describe one article.",
    );
  const lineage = draft.inputLineage;
  if (
    lineage.sourceSetId !== input.sourceSet.id ||
    lineage.evidenceSetId !== input.evidenceSet.id ||
    lineage.factSetId !== input.factSet.id ||
    lineage.interpretationArtifactId !== input.interpretationArtifact.id
  )
    add(
      "DRAFT_LINEAGE_MISMATCH",
      "inputLineage",
      "Draft lineage must identify the supplied artifacts.",
    );

  for (const material of input.contextualMaterial ?? []) {
    for (const [index, claim] of material.claims.entries()) {
      const path = `contextualMaterial.${material.id}.claims.${index}.provenance`;
      if (!Object.values(claim.provenance).some((values) => values.length))
        add(
          "CONTEXT_PROVENANCE_REQUIRED",
          path,
          "Contextual scientific material requires independent provenance.",
        );
      for (const sourceId of claim.provenance.sourceDocumentIds)
        if (!sources.has(sourceId))
          add("SOURCE_DOCUMENT_NOT_FOUND", path, `Unknown source document: ${sourceId}`);
      for (const anchorId of claim.provenance.evidenceAnchorIds)
        if (!anchors.has(anchorId))
          add("EVIDENCE_ANCHOR_NOT_FOUND", path, `Unknown evidence anchor: ${anchorId}`);
      for (const referenceId of claim.provenance.externalContextReferenceIds)
        if (!externalIds.has(referenceId))
          add(
            "EXTERNAL_CONTEXT_REFERENCE_NOT_FOUND",
            path,
            `Unauthorized context reference: ${referenceId}`,
          );
    }
  }

  const unsupported = new Set(draft.inferenceLimits.unsupportedConclusions.map(({ id }) => id));
  for (const [group, conclusions] of Object.entries(draft.inferenceLimits))
    for (const [index, conclusion] of conclusions.entries()) {
      const path = `inferenceLimits.${group}.${index}`;
      for (const factId of conclusion.factIds)
        if (!factIds.has(factId))
          add("FACT_NOT_FOUND", `${path}.factIds`, `Unknown conclusion fact: ${factId}`);
      for (const interpretationId of conclusion.interpretationClaimIds)
        if (!interpretationIds.has(interpretationId))
          add(
            "INTERPRETATION_CLAIM_NOT_FOUND",
            `${path}.interpretationClaimIds`,
            `Unknown conclusion interpretation: ${interpretationId}`,
          );
    }
  for (const [blockIndex, block] of draft.blocks.entries())
    for (const [claimIndex, claim] of block.claims.entries()) {
      const path = `blocks.${blockIndex}.claims.${claimIndex}`;
      if (substantiveKinds.has(claim.statementKind) && !hasGrounding(claim.grounding))
        add(
          "SCIENTIFIC_CLAIM_GROUNDING_REQUIRED",
          `${path}.grounding`,
          "Every substantive scientific claim requires grounding.",
        );
      if (claim.statementKind === "editorial_transition" && hasGrounding(claim.grounding))
        add(
          "GROUNDING_KIND_INCOMPATIBLE",
          `${path}.grounding`,
          "Editorial transitions must not masquerade as grounded scientific claims.",
        );
      for (const factId of claim.grounding.factIds)
        if (!factIds.has(factId))
          add("FACT_NOT_FOUND", `${path}.grounding.factIds`, `Unknown fact: ${factId}`);
      for (const quantitative of claim.quantitativeClaims) {
        const fact = input.factSet.facts.find(({ id }) => id === quantitative.factId);
        const serialized = fact ? JSON.stringify(fact.availability) : "";
        if (
          !fact ||
          !claim.grounding.factIds.includes(quantitative.factId) ||
          !serialized.includes(`"value":${quantitative.value}`) ||
          !serialized.includes(`"unit":"${quantitative.unit}"`)
        )
          add(
            "QUANTITATIVE_CLAIM_NOT_IN_FACT",
            `${path}.quantitativeClaims`,
            "Every declared quantitative value and unit must occur in its grounded fact.",
          );
      }
      for (const interpretationId of claim.grounding.interpretationClaimIds)
        if (!interpretationIds.has(interpretationId))
          add(
            "INTERPRETATION_CLAIM_NOT_FOUND",
            `${path}.grounding.interpretationClaimIds`,
            `Unknown interpretation: ${interpretationId}`,
          );
      for (const anchorId of claim.grounding.evidenceAnchorIds)
        if (!anchors.has(anchorId))
          add(
            "EVIDENCE_ANCHOR_NOT_FOUND",
            `${path}.grounding.evidenceAnchorIds`,
            `Unknown anchor: ${anchorId}`,
          );
      for (const sourceId of claim.grounding.sourceDocumentIds)
        if (!sources.has(sourceId))
          add(
            "SOURCE_DOCUMENT_NOT_FOUND",
            `${path}.grounding.sourceDocumentIds`,
            `Unknown source: ${sourceId}`,
          );
      for (const referenceId of claim.grounding.externalContextReferenceIds)
        if (!externalIds.has(referenceId) && !contextClaims.has(referenceId))
          add(
            "EXTERNAL_CONTEXT_REFERENCE_NOT_FOUND",
            `${path}.grounding.externalContextReferenceIds`,
            `Unknown context reference: ${referenceId}`,
          );
      for (const conclusionId of claim.conclusionIds)
        if (unsupported.has(conclusionId))
          add(
            "UNSUPPORTED_CONCLUSION_USED",
            `${path}.conclusionIds`,
            `Claim invokes prohibited conclusion: ${conclusionId}`,
          );
      if (
        claim.sourceRequirement === "authorized_full_text" &&
        !input.sourceSet.coverage.hasAuthorizedFullText
      )
        add(
          "FULL_TEXT_NOT_AVAILABLE",
          `${path}.sourceRequirement`,
          "Full-text claim requires authorized full-text coverage.",
        );
      if (claim.epistemicStatus === "equivalence")
        add(
          "EQUIVALENCE_NOT_SUPPORTED",
          `${path}.epistemicStatus`,
          "rct.v1 does not establish equivalence.",
        );
      if (claim.epistemicStatus === "superiority")
        add(
          "SUPERIORITY_NOT_SUPPORTED",
          `${path}.epistemicStatus`,
          "No supported superiority decision exists in rct.v1.",
        );
      if (claim.epistemicStatus === "therapeutic_recommendation")
        add(
          "THERAPEUTIC_RECOMMENDATION_NOT_AUTHORIZED",
          `${path}.epistemicStatus`,
          "Editorial Draft v1 cannot authorize treatment recommendations.",
        );
      if (claim.epistemicStatus === "demonstrated_causality") {
        const groundedContext = claim.grounding.externalContextReferenceIds
          .map((id) => contextClaims.get(id))
          .some((context) => context?.epistemicStatus === "demonstrated_causality");
        if (!groundedContext)
          add(
            "CAUSALITY_NOT_SUPPORTED",
            `${path}.epistemicStatus`,
            "Mechanistic plausibility cannot be promoted to demonstrated causality.",
          );
      }
      if (block.kind === "source_boundary" && claim.epistemicStatus !== "source_coverage")
        add(
          "SOURCE_BOUNDARY_INCOMPATIBLE",
          `${path}.epistemicStatus`,
          "Source-boundary claims must explicitly describe source coverage.",
        );
    }

  return { valid: errors.length === 0, errors };
}
