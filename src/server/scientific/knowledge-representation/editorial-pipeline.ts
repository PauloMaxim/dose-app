import { z } from "zod";
import {
  evidenceAnchorSchema,
  scientificFactSchema,
  sourceDocumentSchema,
  type EvidenceAnchor,
  type ScientificFact,
  type SourceDocument,
} from "./contracts";

export const SCIENTIFIC_SOURCE_SET_VERSION = "scientific-source-set.v1" as const;
export const SCIENTIFIC_EVIDENCE_SET_VERSION = "scientific-evidence-set.v1" as const;
export const RCT_SCIENTIFIC_FACT_SET_VERSION = "rct-scientific-fact-set.v1" as const;
export const SCIENTIFIC_INTERPRETATION_VERSION = "scientific-interpretation.v1" as const;

const id = z.string().trim().min(1).max(200);

export const validationStatusSchema = z
  .object({ status: z.enum(["pending", "valid", "invalid"]), validatedBy: id.optional() })
  .strict();

export const scientificSourceSetSchema = z
  .object({
    version: z.literal(SCIENTIFIC_SOURCE_SET_VERSION),
    id,
    articleId: id,
    sourceDocuments: z.array(sourceDocumentSchema).min(1),
    primarySourceDocumentIds: z.array(id).min(1),
    coverage: z
      .object({
        sourceKinds: z.array(sourceDocumentSchema.shape.sourceKind),
        hasAuthorizedFullText: z.boolean(),
      })
      .strict(),
    validation: validationStatusSchema,
  })
  .strict();

export const scientificEvidenceSetSchema = z
  .object({
    version: z.literal(SCIENTIFIC_EVIDENCE_SET_VERSION),
    id,
    articleId: id,
    sourceSet: z.object({ id, version: z.literal(SCIENTIFIC_SOURCE_SET_VERSION) }).strict(),
    anchors: z.array(evidenceAnchorSchema),
    validation: validationStatusSchema,
  })
  .strict();

export const rctScientificFactSetSchema = z
  .object({
    version: z.literal(RCT_SCIENTIFIC_FACT_SET_VERSION),
    id,
    articleId: id,
    scientificGrammar: z.literal("rct.v1"),
    sourceSet: z.object({ id, version: z.literal(SCIENTIFIC_SOURCE_SET_VERSION) }).strict(),
    evidenceSet: z.object({ id, version: z.literal(SCIENTIFIC_EVIDENCE_SET_VERSION) }).strict(),
    facts: z.array(scientificFactSchema),
    validation: validationStatusSchema,
  })
  .strict();

export const interpretationClaimSchema = z
  .object({
    id,
    claimType: z.enum([
      "statistical_interpretation",
      "clinical_interpretation",
      "limitation",
      "source_boundary",
      "contextual_explanation",
    ]),
    statement: z.string().trim().min(1).max(2_000),
    provenanceBasis: z.enum(["article_supported", "deterministic_rule", "external_context"]),
    inputFactIds: z.array(id),
    externalContextReferences: z.array(id),
    method: z.object({ name: id, version: id }).strict(),
    qualifiers: z.array(id),
    prohibitedExtrapolations: z.array(id),
    operationalStatus: z.enum(["draft", "qualified", "ready_for_review"]),
    requiresHumanReview: z.boolean(),
    reviewStatus: z.enum(["not_requested", "pending", "approved", "rejected"]),
  })
  .strict();

export const scientificInterpretationArtifactSchema = z
  .object({
    version: z.literal(SCIENTIFIC_INTERPRETATION_VERSION),
    id,
    articleId: id,
    sourceSet: z.object({ id, version: z.literal(SCIENTIFIC_SOURCE_SET_VERSION) }).strict(),
    factSet: z.object({ id, version: z.literal(RCT_SCIENTIFIC_FACT_SET_VERSION) }).strict(),
    claims: z.array(interpretationClaimSchema),
    validation: validationStatusSchema,
  })
  .strict();

export type ScientificSourceSet = z.infer<typeof scientificSourceSetSchema>;
export type ScientificEvidenceSet = z.infer<typeof scientificEvidenceSetSchema>;
export type RCTScientificFactSet = z.infer<typeof rctScientificFactSetSchema>;
export type InterpretationClaim = z.infer<typeof interpretationClaimSchema>;
export type ScientificInterpretationArtifact = z.infer<
  typeof scientificInterpretationArtifactSchema
>;

export type PipelineArtifact = "source" | "evidence" | "facts" | "interpretation" | "pipeline";
export interface PipelineValidationIssue {
  code: string;
  artifact: PipelineArtifact;
  path?: string;
  message: string;
}
export interface PipelineValidationResult {
  valid: boolean;
  errors: PipelineValidationIssue[];
  warnings: PipelineValidationIssue[];
}

class Issues {
  errors: PipelineValidationIssue[] = [];
  warnings: PipelineValidationIssue[] = [];
  error(code: string, artifact: PipelineArtifact, path: string | undefined, message: string) {
    this.errors.push({ code, artifact, ...(path ? { path } : {}), message });
  }
  result(): PipelineValidationResult {
    return { valid: this.errors.length === 0, errors: this.errors, warnings: this.warnings };
  }
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  return new Set(values.filter((value) => (seen.has(value) ? true : !seen.add(value))));
}

function mergeIssues(target: Issues, report: PipelineValidationResult) {
  target.errors.push(...report.errors);
  target.warnings.push(...report.warnings);
}

export function deriveSourceCoverage(sourceDocuments: SourceDocument[]) {
  return {
    sourceKinds: [...new Set(sourceDocuments.map((document) => document.sourceKind))].sort(),
    hasAuthorizedFullText: sourceDocuments.some(
      (document) =>
        document.sourceKind === "licensed_full_text" &&
        document.accessScope === "licensed_full_text" &&
        document.textStorage === "full_text",
    ),
  };
}

export function validateScientificSourceSet(sourceSet: ScientificSourceSet) {
  const issues = new Issues();
  for (const duplicate of duplicates(sourceSet.sourceDocuments.map(({ id }) => id))) {
    issues.error(
      "SOURCE_DOCUMENT_ID_DUPLICATE",
      "source",
      `sourceDocuments.${duplicate}`,
      "Source document IDs must be unique.",
    );
  }
  const documentIds = new Set(sourceSet.sourceDocuments.map(({ id }) => id));
  for (const primaryId of sourceSet.primarySourceDocumentIds) {
    if (!documentIds.has(primaryId))
      issues.error(
        "PRIMARY_SOURCE_NOT_FOUND",
        "source",
        `primarySourceDocumentIds.${primaryId}`,
        "Primary source document must resolve within the source set.",
      );
  }
  for (const document of sourceSet.sourceDocuments) {
    if (document.articleId !== sourceSet.articleId)
      issues.error(
        "SOURCE_ARTICLE_MISMATCH",
        "source",
        `sourceDocuments.${document.id}.articleId`,
        "Source document article identity must match its source set.",
      );
    if (document.textStorage === "full_text" && document.accessScope !== "licensed_full_text")
      issues.error(
        "SOURCE_STORAGE_SCOPE_INVALID",
        "source",
        `sourceDocuments.${document.id}.textStorage`,
        "Full-text storage requires authorized full-text access.",
      );
    if (
      document.provider === "crossref" &&
      (document.sourceKind === "licensed_full_text" || document.textStorage === "full_text")
    )
      issues.error(
        "CROSSREF_FULL_TEXT_UNSUPPORTED",
        "source",
        `sourceDocuments.${document.id}`,
        "Crossref records do not establish authorized full-text access.",
      );
  }
  const derived = deriveSourceCoverage(sourceSet.sourceDocuments);
  if (
    JSON.stringify([...sourceSet.coverage.sourceKinds].sort()) !==
      JSON.stringify(derived.sourceKinds) ||
    sourceSet.coverage.hasAuthorizedFullText !== derived.hasAuthorizedFullText
  ) {
    issues.error(
      "SOURCE_COVERAGE_MISMATCH",
      "source",
      "coverage",
      "Declared source coverage must equal coverage derivable from source documents.",
    );
  }
  return issues.result();
}

function locatorAllowed(anchor: EvidenceAnchor, source: SourceDocument) {
  if (anchor.locator.kind === "registry_field") return source.sourceKind === "registry_record";
  if (["page", "table", "figure"].includes(anchor.locator.kind))
    return ["licensed_full_text", "supplement", "guideline"].includes(source.sourceKind);
  return true;
}

export function validateScientificEvidenceSet(
  evidenceSet: ScientificEvidenceSet,
  sourceSet: ScientificSourceSet,
) {
  const issues = new Issues();
  const sources = new Map(sourceSet.sourceDocuments.map((source) => [source.id, source]));
  for (const duplicate of duplicates(evidenceSet.anchors.map(({ id }) => id)))
    issues.error(
      "EVIDENCE_ANCHOR_ID_DUPLICATE",
      "evidence",
      `anchors.${duplicate}`,
      "Evidence anchor IDs must be unique.",
    );
  for (const anchor of evidenceSet.anchors) {
    const source = sources.get(anchor.sourceDocumentId);
    if (!source)
      issues.error(
        "EVIDENCE_SOURCE_NOT_FOUND",
        "evidence",
        `anchors.${anchor.id}.sourceDocumentId`,
        "Evidence anchor source document must resolve within the source set.",
      );
    else if (!locatorAllowed(anchor, source))
      issues.error(
        "EVIDENCE_LOCATOR_INCOMPATIBLE",
        "evidence",
        `anchors.${anchor.id}.locator`,
        "Evidence locator is incompatible with its source document type.",
      );
    if (anchor.offsets.status === "available" && anchor.excerpt.status !== "available")
      issues.error(
        "EVIDENCE_OFFSETS_WITHOUT_EXCERPT",
        "evidence",
        `anchors.${anchor.id}.offsets`,
        "Available offsets require an available excerpt.",
      );
    if (anchor.contentHash.status === "available" && anchor.excerpt.status !== "available")
      issues.error(
        "EVIDENCE_HASH_WITHOUT_EXCERPT",
        "evidence",
        `anchors.${anchor.id}.contentHash`,
        "An excerpt hash requires an available excerpt.",
      );
  }
  return issues.result();
}

type AvailableFact = ScientificFact & {
  availability: Extract<ScientificFact["availability"], { status: "available" }>;
};

export function validateRCTScientificFactSet(
  factSet: RCTScientificFactSet,
  evidenceSet: ScientificEvidenceSet,
) {
  const issues = new Issues();
  const factIds = new Set(factSet.facts.map(({ id }) => id));
  const anchorIds = new Set(evidenceSet.anchors.map(({ id }) => id));
  for (const duplicate of duplicates(factSet.facts.map(({ id }) => id)))
    issues.error(
      "FACT_ID_DUPLICATE",
      "facts",
      `facts.${duplicate}`,
      "Scientific fact IDs must be unique.",
    );
  const available = factSet.facts.filter(
    (fact): fact is AvailableFact => fact.availability.status === "available",
  );
  const arms = new Map<string, { comparator: boolean }>();
  const endpoints = new Set<string>();
  const componentIds = new Set<string>();
  for (const fact of available) {
    const value = fact.availability.value;
    if (value.type === "arm" && value.armId) {
      if (arms.has(value.armId))
        issues.error(
          "FACT_ARM_ID_DUPLICATE",
          "facts",
          `facts.${fact.id}.availability.value.armId`,
          "Arm identities must be unique within the fact set.",
        );
      arms.set(value.armId, { comparator: Boolean(value.comparator) });
    }
    if (value.type === "endpoint" && value.endpointId) {
      if (endpoints.has(value.endpointId))
        issues.error(
          "FACT_ENDPOINT_ID_DUPLICATE",
          "facts",
          `facts.${fact.id}.availability.value.endpointId`,
          "Endpoint identities must be unique within the fact set.",
        );
      endpoints.add(value.endpointId);
    }
  }
  for (const fact of available) {
    const value = fact.availability.value;
    if (value.type !== "endpoint") continue;
    for (const component of value.components ?? []) {
      if (componentIds.has(component.componentId) || endpoints.has(component.componentId))
        issues.error(
          "FACT_COMPOSITE_COMPONENT_ID_DUPLICATE",
          "facts",
          `facts.${fact.id}.availability.value.components.${component.componentId}`,
          "Composite component IDs must not collide with an endpoint or another component.",
        );
      componentIds.add(component.componentId);
    }
  }
  for (const fact of factSet.facts) {
    if (fact.articleId !== factSet.articleId)
      issues.error(
        "FACT_ARTICLE_MISMATCH",
        "facts",
        `facts.${fact.id}.articleId`,
        "Scientific fact article identity must match its fact set.",
      );
    if (fact.origin.kind === "source")
      for (const provenance of fact.provenance)
        if (provenance.target.kind === "evidence_anchor" && !anchorIds.has(provenance.target.id))
          issues.error(
            "FACT_EVIDENCE_NOT_FOUND",
            "facts",
            `facts.${fact.id}.provenance`,
            "Source fact evidence anchor must resolve within the evidence set.",
          );
    if (fact.origin.kind === "derived")
      for (const inputId of fact.origin.inputFactIds)
        if (!factIds.has(inputId))
          issues.error(
            "DERIVED_FACT_INPUT_NOT_FOUND",
            "facts",
            `facts.${fact.id}.origin.inputFactIds`,
            "Derived fact input must resolve within the fact set.",
          );
    if (fact.origin.kind === "derived")
      for (const provenance of fact.provenance)
        if (provenance.target.kind === "scientific_fact" && !factIds.has(provenance.target.id))
          issues.error(
            "DERIVED_FACT_PROVENANCE_NOT_FOUND",
            "facts",
            `facts.${fact.id}.provenance.${provenance.target.id}`,
            "Derived fact provenance must resolve within the fact set.",
          );
    if (fact.availability.status !== "available") continue;
    const value = fact.availability.value;
    const referencedArms =
      value.type === "allocation_ratio"
        ? value.allocations.map(({ armId }) => ({ armId }))
        : value.type === "result" ||
            value.type === "safety_event" ||
            value.type === "safety_comparison"
          ? value.arms
          : value.type === "arm_estimate"
            ? [{ armId: value.armId }]
            : [];
    for (const reference of referencedArms)
      if (!arms.has(reference.armId))
        issues.error(
          "FACT_ARM_NOT_FOUND",
          "facts",
          `facts.${fact.id}.availability.value.arms.${reference.armId}`,
          "Referenced arm must resolve within the fact set.",
        );
    if (
      (value.type === "result" ||
        value.type === "endpoint_timepoint" ||
        value.type === "arm_estimate" ||
        value.type === "statistical_hypothesis") &&
      !endpoints.has(value.endpointId)
    )
      issues.error(
        "FACT_ENDPOINT_NOT_FOUND",
        "facts",
        `facts.${fact.id}.availability.value.endpointId`,
        "Referenced endpoint must resolve within the fact set.",
      );
    if (value.type === "statistical_hypothesis") {
      const resultFact = available.find(({ id }) => id === value.resultFactId);
      if (!resultFact || resultFact.availability.value.type !== "result") {
        issues.error(
          "HYPOTHESIS_RESULT_NOT_FOUND",
          "facts",
          `facts.${fact.id}.availability.value.resultFactId`,
          "Noninferiority hypothesis must reference an available comparative result.",
        );
      } else {
        const result = resultFact.availability.value;
        if (result.endpointId !== value.endpointId)
          issues.error(
            "HYPOTHESIS_ENDPOINT_MISMATCH",
            "facts",
            `facts.${fact.id}.availability.value.endpointId`,
            "Hypothesis and referenced result must use the same endpoint.",
          );
        if (
          result.estimate.measureType !== value.effectMeasure ||
          result.estimate.unit !== value.margin.unit
        )
          issues.error(
            "HYPOTHESIS_MEASURE_MISMATCH",
            "facts",
            `facts.${fact.id}.availability.value.effectMeasure`,
            "Hypothesis margin must use the referenced result's effect measure and unit.",
          );
        const interval = result.estimate.confidenceInterval;
        if (
          interval.status !== "available" ||
          interval.value.levelPercent !== value.confidenceLevelPercent
        )
          issues.error(
            "HYPOTHESIS_CONFIDENCE_INTERVAL_MISMATCH",
            "facts",
            `facts.${fact.id}.availability.value.confidenceLevelPercent`,
            "Decision confidence level must match the referenced result interval.",
          );
        else {
          const met = interval.value.upper < value.margin.value;
          if (met !== (value.conclusion === "noninferiority_met"))
            issues.error(
              "HYPOTHESIS_CONCLUSION_INVALID",
              "facts",
              `facts.${fact.id}.availability.value.conclusion`,
              "Noninferiority conclusion must follow the declared upper-bound decision rule.",
            );
        }
      }
    }
    if (value.type === "result" && value.pooling.status === "pooled")
      for (const armId of value.pooling.pooledArmIds) {
        const arm = arms.get(armId);
        const resultReference = value.arms.find((candidate) => candidate.armId === armId);
        if (!arm || arm.comparator || resultReference?.role !== "intervention")
          issues.error(
            "FACT_POOLING_INVALID",
            "facts",
            `facts.${fact.id}.availability.value.pooling.${armId}`,
            "Pooled arms must resolve to intervention arms represented in the result.",
          );
      }
  }
  return issues.result();
}

export function validateScientificInterpretationArtifact(
  artifact: ScientificInterpretationArtifact,
  factSet: RCTScientificFactSet,
) {
  const issues = new Issues();
  const factIds = new Set(factSet.facts.map(({ id }) => id));
  for (const duplicate of duplicates(artifact.claims.map(({ id }) => id)))
    issues.error(
      "INTERPRETATION_ID_DUPLICATE",
      "interpretation",
      `claims.${duplicate}`,
      "Interpretation claim IDs must be unique.",
    );
  for (const claim of artifact.claims) {
    for (const factId of claim.inputFactIds)
      if (!factIds.has(factId))
        issues.error(
          "INTERPRETATION_FACT_NOT_FOUND",
          "interpretation",
          `claims.${claim.id}.inputFactIds.${factId}`,
          "Interpretation input fact must resolve within the fact set.",
        );
    const factsRequired =
      claim.claimType !== "source_boundary" &&
      !(
        claim.claimType === "contextual_explanation" && claim.provenanceBasis === "external_context"
      );
    if (factsRequired && claim.inputFactIds.length === 0)
      issues.error(
        "INTERPRETATION_FACT_SUPPORT_REQUIRED",
        "interpretation",
        `claims.${claim.id}.inputFactIds`,
        "This interpretation claim type requires factual support.",
      );
    if (claim.provenanceBasis === "article_supported" && claim.inputFactIds.length === 0)
      issues.error(
        "ARTICLE_SUPPORT_REQUIRED",
        "interpretation",
        `claims.${claim.id}.inputFactIds`,
        "Article-supported interpretation requires article facts.",
      );
    if (
      claim.provenanceBasis === "external_context" &&
      claim.externalContextReferences.length === 0
    )
      issues.error(
        "EXTERNAL_CONTEXT_REFERENCE_REQUIRED",
        "interpretation",
        `claims.${claim.id}.externalContextReferences`,
        "External-context interpretation must identify its separate context provenance.",
      );
    if (claim.provenanceBasis !== "external_context" && claim.externalContextReferences.length)
      issues.error(
        "EXTERNAL_CONTEXT_PROVENANCE_INVALID",
        "interpretation",
        `claims.${claim.id}.externalContextReferences`,
        "External context references are only valid for external-context claims.",
      );
    if (
      claim.requiresHumanReview &&
      !["pending", "approved", "rejected"].includes(claim.reviewStatus)
    )
      issues.error(
        "INTERPRETATION_REVIEW_GATE_INVALID",
        "interpretation",
        `claims.${claim.id}.reviewStatus`,
        "A claim requiring human review must enter the review workflow.",
      );
  }
  return issues.result();
}

export function validateEditorialPipeline(input: {
  sourceSet: ScientificSourceSet;
  evidenceSet: ScientificEvidenceSet;
  factSet: RCTScientificFactSet;
  interpretation: ScientificInterpretationArtifact;
}): PipelineValidationResult {
  const issues = new Issues();
  mergeIssues(issues, validateScientificSourceSet(input.sourceSet));
  mergeIssues(issues, validateScientificEvidenceSet(input.evidenceSet, input.sourceSet));
  mergeIssues(issues, validateRCTScientificFactSet(input.factSet, input.evidenceSet));
  mergeIssues(
    issues,
    validateScientificInterpretationArtifact(input.interpretation, input.factSet),
  );
  const artifacts = [input.evidenceSet, input.factSet, input.interpretation];
  for (const artifact of artifacts)
    if (artifact.articleId !== input.sourceSet.articleId)
      issues.error(
        "PIPELINE_ARTICLE_MISMATCH",
        "pipeline",
        "articleId",
        "All pipeline artifacts must share one article identity.",
      );
  if (
    input.evidenceSet.sourceSet.id !== input.sourceSet.id ||
    input.evidenceSet.sourceSet.version !== input.sourceSet.version ||
    input.factSet.sourceSet.id !== input.sourceSet.id ||
    input.factSet.sourceSet.version !== input.sourceSet.version ||
    input.interpretation.sourceSet.id !== input.sourceSet.id ||
    input.interpretation.sourceSet.version !== input.sourceSet.version
  )
    issues.error(
      "PIPELINE_SOURCE_LINEAGE_BROKEN",
      "pipeline",
      "sourceSet",
      "Downstream artifacts must reference the supplied source set.",
    );
  if (
    input.factSet.evidenceSet.id !== input.evidenceSet.id ||
    input.factSet.evidenceSet.version !== input.evidenceSet.version
  )
    issues.error(
      "PIPELINE_EVIDENCE_LINEAGE_BROKEN",
      "pipeline",
      "factSet.evidenceSet",
      "Fact set must reference the supplied evidence set.",
    );
  if (
    input.interpretation.factSet.id !== input.factSet.id ||
    input.interpretation.factSet.version !== input.factSet.version
  )
    issues.error(
      "PIPELINE_FACT_LINEAGE_BROKEN",
      "pipeline",
      "interpretation.factSet",
      "Interpretation must reference the supplied fact set.",
    );
  return issues.result();
}
