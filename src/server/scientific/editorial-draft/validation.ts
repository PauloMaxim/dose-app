import type {
  RCTScientificFactSet,
  ScientificEvidenceSet,
  ScientificInterpretationArtifact,
  ScientificSourceSet,
} from "../knowledge-representation/editorial-pipeline";
import type { ScientificFact } from "../knowledge-representation/contracts";
import {
  SCIENTIFIC_EDITORIAL_STRUCTURAL_QUANTITATIVE_UNITS,
  scientificEditorialDraftSchema,
  type ContextualScientificMaterial,
  type EditorialGenerationProfile,
  type ScientificEditorialDraft,
} from "./contracts";
import { deriveEditorialScientificAuthority } from "./scientific-authority";

const structuralUnits = SCIENTIFIC_EDITORIAL_STRUCTURAL_QUANTITATIVE_UNITS;

export type EditorialDraftValidationCode =
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
  | "UNSUPPORTED_CONCLUSION_USED"
  | "INFERENCE_BOUNDARY_NOT_AUTHORIZED"
  | "INFERENCE_ASSERTION_NOT_AUTHORIZED"
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
  contextualMaterial?: ContextualScientificMaterial[];
  editorialProfile: EditorialGenerationProfile;
  /** IDs are supplied only by a future, separately authorized context acquisition boundary. */
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
  externalContextReferenceIds: string[];
}) {
  return Object.values(grounding).some((values) => values.length > 0);
}

interface FactQuantity {
  value: number;
  unit: string;
}

function availableValue<T>(availability: { status: string; value?: T }): T | undefined {
  return availability.status === "available" ? availability.value : undefined;
}

/** Extracts only semantically paired quantities from the typed rct.v1 fact value. */
function factQuantities(fact: ScientificFact): FactQuantity[] {
  const value = availableValue(fact.availability);
  if (!value) return [];
  switch (value.type) {
    case "population_sample_size":
      return [{ value: value.value, unit: structuralUnits.participantCount }];
    case "population_characteristic": {
      const denominator = availableValue(value.denominator);
      return [
        value.value,
        ...(denominator === undefined
          ? []
          : [{ value: denominator, unit: structuralUnits.participantCount }]),
      ];
    }
    case "eligibility":
      return [value.value];
    case "arm": {
      const dose = availableValue(value.dose);
      return [
        ...(dose ? [dose] : []),
        ...(value.randomizedSampleSize === undefined
          ? []
          : [{ value: value.randomizedSampleSize, unit: structuralUnits.participantCount }]),
      ];
    }
    case "allocation_ratio":
      return value.allocations.map(({ parts }) => ({
        value: parts,
        unit: structuralUnits.allocationPart,
      }));
    case "treatment_duration":
      return [value.duration];
    case "endpoint_timepoint":
      return [value.timepoint];
    case "endpoint":
      return [value.timepoint];
    case "result": {
      const interval = availableValue(value.estimate.confidenceInterval);
      const pValue = availableValue(value.estimate.pValue);
      return [
        { value: value.estimate.value, unit: value.estimate.unit },
        ...(interval
          ? [
              { value: interval.lower, unit: value.estimate.unit },
              { value: interval.upper, unit: value.estimate.unit },
              { value: interval.levelPercent, unit: structuralUnits.confidenceLevelPercent },
            ]
          : []),
        ...(pValue ? [{ value: pValue.value, unit: structuralUnits.pValue }] : []),
        value.timepoint,
      ];
    }
    case "arm_estimate": {
      const eventCount = availableValue(value.eventCount);
      const denominator = availableValue(value.denominator);
      return [
        { value: value.estimate.value, unit: value.estimate.unit },
        ...(eventCount === undefined
          ? []
          : [{ value: eventCount, unit: structuralUnits.participantCount }]),
        ...(denominator === undefined
          ? []
          : [{ value: denominator, unit: structuralUnits.participantCount }]),
        value.timepoint,
      ];
    }
    case "statistical_hypothesis": {
      const pValue = availableValue(value.pValue);
      return [
        value.margin,
        {
          value: value.confidenceLevelPercent,
          unit: structuralUnits.confidenceLevelPercent,
        },
        ...(pValue ? [{ value: pValue.value, unit: structuralUnits.pValue }] : []),
      ];
    }
    case "safety_event": {
      const denominator = availableValue(value.denominator);
      return [
        value.frequency,
        ...(denominator === undefined
          ? []
          : [{ value: denominator, unit: structuralUnits.participantCount }]),
      ];
    }
    case "study_design_feature":
    case "blinding":
    case "phase":
    case "population_condition":
    case "safety_comparison":
    case "registry_identifier":
    case "mechanism_relation":
      return [];
  }
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

  const authoritativeBoundaries = new Set(
    deriveEditorialScientificAuthority(input.interpretationArtifact).inferenceBoundaries.map(
      ({ id }) => id,
    ),
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
        const quantityExists =
          fact?.availability.status === "available" &&
          factQuantities(fact).some(
            ({ value, unit }) => value === quantitative.value && unit === quantitative.unit,
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
      for (const referenceId of claim.grounding.externalContextReferenceIds)
        if (!externalIds.has(referenceId) && !contextClaims.has(referenceId))
          add(
            "EXTERNAL_CONTEXT_REFERENCE_NOT_FOUND",
            `${path}.grounding.externalContextReferenceIds`,
            `Unknown context reference: ${referenceId}`,
          );
      for (const [inferenceIndex, inferenceId] of claim.assertedInferenceIds.entries()) {
        if (authoritativeBoundaries.has(inferenceId))
          add(
            "UNSUPPORTED_CONCLUSION_USED",
            `${path}.assertedInferenceIds.${inferenceIndex}`,
            `Claim asserts prohibited conclusion: ${inferenceId}`,
          );
        else
          add(
            "INFERENCE_ASSERTION_NOT_AUTHORIZED",
            `${path}.assertedInferenceIds.${inferenceIndex}`,
            `Unknown authoritative inference assertion: ${inferenceId}`,
          );
      }
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
