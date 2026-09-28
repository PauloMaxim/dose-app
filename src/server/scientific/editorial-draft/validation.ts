import type {
  RCTScientificFactSet,
  ScientificEvidenceSet,
  ScientificInterpretationArtifact,
  ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import {
  contextualScientificMaterialSchema,
  scientificEditorialDraftSchema,
  type EditorialGenerationProfile,
  type ScientificEditorialDraft,
} from "./contracts";
import { deriveEditorialScientificAuthority } from "./scientific-authority";

export type EditorialDraftValidationCode =
  | "CONTEXT_SCHEMA_INVALID"
  | "CONTEXT_ARTICLE_MISMATCH"
  | "CONTEXT_MATERIAL_ID_DUPLICATE"
  | "CONTEXT_CLAIM_ID_DUPLICATE"
  | "CONTEXT_CLAIM_NOT_FOUND"
  | "DRAFT_SCHEMA_INVALID"
  | "DRAFT_LINEAGE_MISMATCH"
  | "DRAFT_ARTICLE_MISMATCH"
  | "DRAFT_LANGUAGE_MISMATCH"
  | "FACT_NOT_FOUND"
  | "INTERPRETATION_CLAIM_NOT_FOUND"
  | "EVIDENCE_ANCHOR_NOT_FOUND"
  | "SOURCE_DOCUMENT_NOT_FOUND"
  | "EXTERNAL_CONTEXT_REFERENCE_NOT_FOUND"
  | "CONTEXT_PROVENANCE_REQUIRED"
  | "SCIENTIFIC_CLAIM_GROUNDING_REQUIRED"
  | "GROUNDING_KIND_INCOMPATIBLE"
  | "INFERENCE_BOUNDARY_NOT_AUTHORIZED"
  | "FULL_TEXT_NOT_AVAILABLE"
  | "EQUIVALENCE_NOT_SUPPORTED"
  | "SUPERIORITY_NOT_SUPPORTED"
  | "CAUSALITY_NOT_SUPPORTED"
  | "THERAPEUTIC_RECOMMENDATION_NOT_AUTHORIZED"
  | "SOURCE_BOUNDARY_INCOMPATIBLE"
  | "QUANTITATIVE_CLAIM_NOT_DECLARED"
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
  contextualMaterial?: unknown[];
  editorialProfile: EditorialGenerationProfile;
  /** IDs are supplied only by a future, separately authorized context acquisition boundary. */
  authorizedExternalContextReferenceIds?: string[];
}

export interface ValidateContextualScientificMaterialInput {
  sourceSet: ScientificSourceSet;
  evidenceSet: ScientificEvidenceSet;
  factSet: RCTScientificFactSet;
  interpretationArtifact: ScientificInterpretationArtifact;
  contextualMaterial?: unknown[];
  authorizedExternalContextReferenceIds?: string[];
}

const substantiveKinds = new Set([
  "article_supported_fact",
  "deterministic_interpretation",
  "contextual_explanation",
]);

function hasGrounding(grounding: {
  factIds: string[];
  interpretationClaimIds: string[];
  evidenceAnchorIds: string[];
  sourceDocumentIds: string[];
  contextualClaimIds: string[];
}) {
  return Object.values(grounding).some((values) => values.length > 0);
}

/** Validates all context at the acquisition boundary, before any provider can observe it. */
export function validateContextualScientificMaterialInput(
  input: ValidateContextualScientificMaterialInput,
): { valid: boolean; errors: EditorialDraftValidationIssue[] } {
  const errors: EditorialDraftValidationIssue[] = [];
  const add = (code: EditorialDraftValidationCode, path: string, message: string) =>
    errors.push({ code, path, message });
  const sources = new Set(input.sourceSet.sourceDocuments.map(({ id }) => id));
  const anchors = new Set(input.evidenceSet.anchors.map(({ id }) => id));
  const authorizedReferences = new Set(input.authorizedExternalContextReferenceIds ?? []);
  const materialIds = new Set<string>();
  const claimIds = new Set<string>();

  for (const [materialIndex, candidate] of (input.contextualMaterial ?? []).entries()) {
    const parsed = contextualScientificMaterialSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        add(
          "CONTEXT_SCHEMA_INVALID",
          `contextualMaterial.${materialIndex}.${issue.path.join(".")}`,
          issue.message,
        );
      continue;
    }
    const material = parsed.data;
    const materialPath = `contextualMaterial.${materialIndex}`;
    if (
      material.articleId !== input.sourceSet.articleId ||
      material.articleId !== input.evidenceSet.articleId ||
      material.articleId !== input.factSet.articleId ||
      material.articleId !== input.interpretationArtifact.articleId
    )
      add(
        "CONTEXT_ARTICLE_MISMATCH",
        `${materialPath}.articleId`,
        "Contextual material and scientific inputs must describe one article.",
      );
    if (materialIds.has(material.id))
      add(
        "CONTEXT_MATERIAL_ID_DUPLICATE",
        `${materialPath}.id`,
        `Duplicate contextual material ID: ${material.id}`,
      );
    materialIds.add(material.id);
    for (const [claimIndex, claim] of material.claims.entries()) {
      const claimPath = `${materialPath}.claims.${claimIndex}`;
      if (claimIds.has(claim.id))
        add(
          "CONTEXT_CLAIM_ID_DUPLICATE",
          `${claimPath}.id`,
          `Duplicate contextual claim ID: ${claim.id}`,
        );
      claimIds.add(claim.id);
      const provenancePath = `${claimPath}.provenance`;
      if (!Object.values(claim.provenance).some((values) => values.length))
        add(
          "CONTEXT_PROVENANCE_REQUIRED",
          provenancePath,
          "Contextual scientific material requires independent provenance.",
        );
      for (const sourceId of claim.provenance.sourceDocumentIds)
        if (!sources.has(sourceId))
          add("SOURCE_DOCUMENT_NOT_FOUND", provenancePath, `Unknown source document: ${sourceId}`);
      for (const anchorId of claim.provenance.evidenceAnchorIds)
        if (!anchors.has(anchorId))
          add("EVIDENCE_ANCHOR_NOT_FOUND", provenancePath, `Unknown evidence anchor: ${anchorId}`);
      for (const referenceId of claim.provenance.externalContextReferenceIds)
        if (!authorizedReferences.has(referenceId))
          add(
            "EXTERNAL_CONTEXT_REFERENCE_NOT_FOUND",
            provenancePath,
            `Unauthorized context reference: ${referenceId}`,
          );
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Proves deterministic contract properties only. Passing does not semantically approve model prose,
 * which remains pending mandatory human review.
 */
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
  const contextReport = validateContextualScientificMaterialInput(input);
  const errors: EditorialDraftValidationIssue[] = [...contextReport.errors];
  const add = (code: EditorialDraftValidationCode, path: string, message: string) =>
    errors.push({ code, path, message });
  const factIds = new Set(input.factSet.facts.map(({ id }) => id));
  const interpretationIds = new Set(input.interpretationArtifact.claims.map(({ id }) => id));
  const anchors = new Map(input.evidenceSet.anchors.map((anchor) => [anchor.id, anchor]));
  const sources = new Set(input.sourceSet.sourceDocuments.map(({ id }) => id));
  const validatedContextualMaterial = (input.contextualMaterial ?? []).flatMap((material) => {
    const candidate = contextualScientificMaterialSchema.safeParse(material);
    return candidate.success ? [candidate.data] : [];
  });
  const contextClaims = new Map(
    validatedContextualMaterial.flatMap((material) =>
      material.claims.map((claim) => [claim.id, claim] as const),
    ),
  );
  const scientificAuthority = deriveEditorialScientificAuthority(
    input.factSet,
    input.interpretationArtifact,
  );

  if (draft.articleId !== input.sourceSet.articleId)
    add(
      "DRAFT_ARTICLE_MISMATCH",
      "articleId",
      "Draft and scientific inputs must describe one article.",
    );
  if (draft.language !== input.editorialProfile.targetLanguage)
    add(
      "DRAFT_LANGUAGE_MISMATCH",
      "language",
      "Draft language must equal the editorial policy targetLanguage.",
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

  const authoritativeBoundaries = new Set(
    scientificAuthority.inferenceBoundaries.map(({ id }) => id),
  );
  for (const [blockIndex, block] of draft.blocks.entries())
    for (const [claimIndex, claim] of block.claims.entries()) {
      const path = `blocks.${blockIndex}.claims.${claimIndex}`;
      if (claim.statementKind === "boundary_explanation") {
        if (!authoritativeBoundaries.has(claim.boundaryId))
          add(
            "INFERENCE_BOUNDARY_NOT_AUTHORIZED",
            `${path}.boundaryId`,
            `Unknown authoritative inference boundary: ${claim.boundaryId}`,
          );
        continue;
      }
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
        const quantityExists = scientificAuthority.quantitativeClaims.some(
          ({ factId, value, unit }) =>
            factId === quantitative.factId &&
            value === quantitative.value &&
            unit === quantitative.unit,
        );
        if (!fact || !claim.grounding.factIds.includes(quantitative.factId) || !quantityExists)
          add(
            "QUANTITATIVE_CLAIM_NOT_IN_FACT",
            `${path}.quantitativeClaims`,
            "Every declared quantitative value and unit must occur in its grounded fact.",
          );
      }
      const proseNumbers =
        claim.text.match(/(?<![\p{L}\d\p{Pd}])[-−]?\d+(?:[.,]\d+)?(?![\p{L}\d\p{Pd}])/gu) ?? [];
      const declaredNumbers = claim.quantitativeClaims.map(({ value }) => value);
      for (const proseNumber of proseNumbers)
        if (!declaredNumbers.includes(Number(proseNumber.replace("−", "-").replace(",", "."))))
          add(
            "QUANTITATIVE_CLAIM_NOT_DECLARED",
            `${path}.text`,
            `Numeric prose value is not declared in quantitativeClaims: ${proseNumber}`,
          );
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
      for (const contextClaimId of claim.grounding.contextualClaimIds)
        if (!contextClaims.has(contextClaimId))
          add(
            "CONTEXT_CLAIM_NOT_FOUND",
            `${path}.grounding.contextualClaimIds`,
            `Unknown contextual claim: ${contextClaimId}`,
          );
      const usesContext = claim.grounding.contextualClaimIds.length > 0;
      const usesArticleAuthority =
        claim.grounding.factIds.length > 0 ||
        claim.grounding.interpretationClaimIds.length > 0 ||
        claim.grounding.evidenceAnchorIds.length > 0 ||
        claim.grounding.sourceDocumentIds.length > 0;
      if (usesContext && claim.statementKind !== "contextual_explanation")
        add(
          "GROUNDING_KIND_INCOMPATIBLE",
          `${path}.grounding.contextualClaimIds`,
          "Only contextual explanations may cite contextual claims.",
        );
      if (claim.statementKind === "article_supported_fact" && !usesArticleAuthority)
        add(
          "GROUNDING_KIND_INCOMPATIBLE",
          `${path}.grounding`,
          "Article-supported facts require authoritative article grounding.",
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
