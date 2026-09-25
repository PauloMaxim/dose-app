import { z } from "zod";

export const SOURCE_DOCUMENT_SCHEMA_VERSION = "source-document.v1" as const;
export const EVIDENCE_ANCHOR_SCHEMA_VERSION = "evidence-anchor.v1" as const;
export const SCIENTIFIC_FACT_SCHEMA_VERSION = "scientific-fact.v1" as const;

const id = z.string().trim().min(1).max(200);
const language = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
const finiteNumber = z.number().finite();

export const unavailableStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_reported_in_source") }).strict(),
  z.object({ status: z.literal("requires_additional_source") }).strict(),
  z
    .object({
      status: z.literal("extraction_uncertain"),
      reason: z.string().trim().min(1).max(500),
    })
    .strict(),
  z
    .object({
      status: z.literal("conflicting_sources"),
      conflictingFactIds: z.array(id).min(2),
    })
    .strict(),
  z.object({ status: z.literal("not_applicable") }).strict(),
]);

export const availability = <T extends z.ZodType>(value: T) =>
  z.discriminatedUnion("status", [
    z.object({ status: z.literal("available"), value }).strict(),
    ...unavailableStateSchema.options,
  ]);

export const sourceDocumentSchema = z
  .object({
    schemaVersion: z.literal(SOURCE_DOCUMENT_SCHEMA_VERSION),
    id,
    articleId: id,
    sourceKind: z.enum([
      "metadata",
      "abstract",
      "registry_record",
      "licensed_full_text",
      "supplement",
      "guideline",
    ]),
    provider: z.enum([
      "pubmed",
      "europe_pmc",
      "crossref",
      "clinical_trials_gov",
      "licensed_provider",
    ]),
    externalIdentifier: z.object({ scheme: id, value: id }).strict(),
    language,
    sourceVersion: availability(id),
    sourceDate: availability(
      z.string().regex(/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/),
    ),
    accessScope: z.enum([
      "metadata_only",
      "abstract",
      "registry_record",
      "licensed_full_text",
      "supplement",
      "guideline",
    ]),
    textStorage: z.enum(["none", "anchors_only", "full_text"]),
    retrievedAt: z.iso.datetime({ offset: true }),
    checksum: availability(
      z
        .object({ algorithm: z.enum(["sha256", "sha512"]), value: z.string().regex(/^[a-f0-9]+$/) })
        .strict(),
    ),
  })
  .strict()
  .superRefine((document, context) => {
    if (
      document.provider === "crossref" &&
      document.sourceKind !== "metadata" &&
      document.sourceKind !== "abstract"
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceKind"],
        message: "Crossref source documents are limited to metadata and abstract records",
      });
    }
    if (
      document.provider === "crossref" &&
      !["metadata_only", "abstract"].includes(document.accessScope)
    ) {
      context.addIssue({
        code: "custom",
        path: ["accessScope"],
        message: "Crossref does not establish full-text or supplemental access",
      });
    }
    if (document.textStorage === "full_text" && document.accessScope !== "licensed_full_text") {
      context.addIssue({
        code: "custom",
        path: ["textStorage"],
        message: "full text storage requires licensed full-text access",
      });
    }
    if (
      document.sourceKind === "licensed_full_text" &&
      document.accessScope !== "licensed_full_text"
    ) {
      context.addIssue({
        code: "custom",
        path: ["accessScope"],
        message: "licensed full-text documents must declare licensed full-text access",
      });
    }
  });

const locatorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("paragraph"), index: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("structured_field"), path: id }).strict(),
  z.object({ kind: z.literal("page"), page: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("table"), label: id, cell: id.optional() }).strict(),
  z.object({ kind: z.literal("figure"), label: id }).strict(),
  z.object({ kind: z.literal("registry_field"), path: id }).strict(),
  z.object({ kind: z.literal("other"), value: id }).strict(),
]);

export const evidenceAnchorSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_ANCHOR_SCHEMA_VERSION),
    id,
    sourceDocumentId: id,
    section: id,
    locator: locatorSchema,
    offsets: availability(
      z
        .object({
          unit: z.literal("unicode_code_point"),
          start: z.number().int().nonnegative(),
          end: z.number().int().positive(),
        })
        .strict(),
    ),
    excerpt: availability(z.string().trim().min(1).max(500)),
    sourceLanguage: language,
    contentHash: availability(
      z
        .object({ algorithm: z.literal("sha256"), value: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict(),
    ),
  })
  .strict()
  .superRefine((anchor, context) => {
    if (
      anchor.offsets.status === "available" &&
      anchor.offsets.value.end <= anchor.offsets.value.start
    ) {
      context.addIssue({ code: "custom", path: ["offsets"], message: "end must be after start" });
    }
  });

const durationSchema = z
  .object({ value: finiteNumber.positive(), unit: z.enum(["day", "week", "month", "year"]) })
  .strict();
const quantitySchema = z.object({ value: finiteNumber, unit: id }).strict();
const confidenceIntervalSchema = z
  .object({
    lower: finiteNumber,
    upper: finiteNumber,
    levelPercent: finiteNumber.gt(0).lt(100),
  })
  .strict();
const pValueSchema = z
  .object({
    operator: z.enum(["equal", "less_than", "less_than_or_equal"]),
    value: finiteNumber.min(0).max(1),
  })
  .strict();
const armReferenceSchema = z
  .object({ armId: id, role: z.enum(["intervention", "comparator"]) })
  .strict();

const rctFactValueSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("study_design_feature"),
      feature: z.enum(["randomized", "multicenter", "placebo_controlled", "parallel_groups"]),
      value: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("blinding"),
      value: z.enum(["open_label", "single_blind", "double_blind", "triple_blind"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("phase"),
      value: z.enum(["phase_1", "phase_2", "phase_2b", "phase_3", "phase_4"]),
    })
    .strict(),
  z
    .object({ type: z.literal("population_condition"), condition: id, criterion: id.optional() })
    .strict(),
  z
    .object({ type: z.literal("population_sample_size"), value: z.number().int().positive() })
    .strict(),
  z
    .object({
      type: z.literal("population_characteristic"),
      characteristic: id,
      value: quantitySchema,
      denominator: availability(z.number().int().positive()),
    })
    .strict(),
  z
    .object({
      type: z.literal("eligibility"),
      criterion: id,
      operator: z.enum([
        "greater_than",
        "greater_than_or_equal",
        "less_than",
        "less_than_or_equal",
        "equal",
      ]),
      value: quantitySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("arm"),
      armId: id,
      label: id,
      intervention: id,
      dose: availability(quantitySchema),
      comparator: z.boolean(),
      randomizedSampleSize: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("allocation_ratio"),
      allocations: z
        .array(z.object({ armId: id, parts: z.number().int().positive() }).strict())
        .min(2),
    })
    .strict(),
  z.object({ type: z.literal("treatment_duration"), duration: durationSchema }).strict(),
  z
    .object({ type: z.literal("endpoint_timepoint"), endpointId: id, timepoint: durationSchema })
    .strict(),
  z
    .object({
      type: z.literal("endpoint"),
      endpointId: id,
      name: id,
      role: z.enum(["primary", "co_primary", "secondary"]),
      measure: id,
      timepoint: durationSchema,
      components: z
        .array(z.object({ componentId: id, name: id }).strict())
        .min(2)
        .optional(),
    })
    .strict()
    .superRefine((endpoint, context) => {
      if (endpoint.components) {
        const componentIds = endpoint.components.map(({ componentId }) => componentId);
        if (new Set(componentIds).size !== componentIds.length)
          context.addIssue({
            code: "custom",
            path: ["components"],
            message: "composite endpoint component IDs must be unique",
          });
      }
    }),
  z
    .object({
      type: z.literal("result"),
      endpointId: id,
      arms: z.array(armReferenceSchema).min(2),
      pooling: z.discriminatedUnion("status", [
        z.object({ status: z.literal("not_pooled") }).strict(),
        z.object({ status: z.literal("pooled"), pooledArmIds: z.array(id).min(2) }).strict(),
      ]),
      estimate: z
        .object({
          measureType: z.enum([
            "mean_change",
            "placebo_corrected_mean_change",
            "risk_ratio",
            "odds_ratio",
            "hazard_ratio",
            "proportion",
            "slope_difference",
            "risk_difference",
          ]),
          value: finiteNumber,
          unit: id,
          confidenceInterval: availability(confidenceIntervalSchema),
          pValue: availability(pValueSchema),
        })
        .strict(),
      timepoint: durationSchema,
      analysisType: z.literal("time_to_event").optional(),
    })
    .strict()
    .superRefine((result, context) => {
      if (result.estimate.confidenceInterval.status === "available") {
        const { lower, upper } = result.estimate.confidenceInterval.value;
        if (lower > result.estimate.value || upper < result.estimate.value || lower > upper) {
          context.addIssue({
            code: "custom",
            path: ["estimate", "confidenceInterval"],
            message: "confidence interval must contain the estimate",
          });
        }
      }
      if (result.pooling.status === "pooled") {
        const interventionIds = new Set(
          result.arms.filter((arm) => arm.role === "intervention").map((arm) => arm.armId),
        );
        if (result.pooling.pooledArmIds.some((armId) => !interventionIds.has(armId))) {
          context.addIssue({
            code: "custom",
            path: ["pooling"],
            message: "pooled arms must be intervention arms in this result",
          });
        }
      }
      if (
        result.estimate.measureType === "risk_difference" &&
        !["percentage_points", "proportion_difference"].includes(result.estimate.unit)
      )
        context.addIssue({
          code: "custom",
          path: ["estimate", "unit"],
          message: "risk difference requires a difference unit",
        });
      if (result.analysisType === "time_to_event" && result.estimate.measureType !== "hazard_ratio")
        context.addIssue({
          code: "custom",
          path: ["analysisType"],
          message: "time-to-event analysis requires a hazard-ratio estimate in rct.v1",
        });
    }),
  z
    .object({
      type: z.literal("arm_estimate"),
      armId: id,
      endpointId: id,
      eventCount: availability(z.number().int().nonnegative()),
      denominator: availability(z.number().int().positive()),
      estimate: z.discriminatedUnion("measureType", [
        z
          .object({
            measureType: z.literal("percentage"),
            value: finiteNumber.min(0).max(100),
            unit: z.literal("percent"),
          })
          .strict(),
        z
          .object({
            measureType: z.literal("proportion"),
            value: finiteNumber.min(0).max(1),
            unit: z.literal("proportion"),
          })
          .strict(),
        z
          .object({
            measureType: z.literal("continuous"),
            value: finiteNumber,
            unit: id,
          })
          .strict(),
      ]),
      timepoint: durationSchema,
    })
    .strict()
    .superRefine((armEstimate, context) => {
      if (
        armEstimate.eventCount.status === "available" &&
        armEstimate.denominator.status === "available" &&
        armEstimate.eventCount.value > armEstimate.denominator.value
      )
        context.addIssue({
          code: "custom",
          path: ["eventCount"],
          message: "event count cannot exceed its reported analysis denominator",
        });
    }),
  z
    .object({
      type: z.literal("statistical_hypothesis"),
      hypothesisType: z.literal("noninferiority"),
      endpointId: id,
      resultFactId: id,
      effectMeasure: z.literal("risk_difference"),
      margin: z
        .object({ value: finiteNumber.positive(), unit: z.literal("percentage_points") })
        .strict(),
      direction: z.literal("upper_bound_below_margin"),
      confidenceLevelPercent: finiteNumber.gt(0).lt(100),
      decisionRule: z
        .object({
          method: z.literal("confidence_interval_bound_vs_margin"),
          bound: z.literal("upper"),
          operator: z.literal("less_than"),
        })
        .strict(),
      conclusion: z.enum(["noninferiority_met", "noninferiority_not_met"]),
      pValue: availability(pValueSchema.extend({ context: z.literal("noninferiority") }).strict()),
    })
    .strict(),
  z
    .object({
      type: z.literal("safety_event"),
      event: id,
      arms: z.array(armReferenceSchema).min(1),
      frequency: quantitySchema,
      denominator: availability(z.number().int().positive()),
      severity: availability(id),
    })
    .strict(),
  z
    .object({
      type: z.literal("safety_comparison"),
      scope: id,
      arms: z.array(armReferenceSchema).min(2),
      finding: z.enum(["similar", "higher_in_intervention", "lower_in_intervention"]),
    })
    .strict(),
  z.object({ type: z.literal("registry_identifier"), registry: id, identifier: id }).strict(),
  z
    .object({
      type: z.literal("mechanism_relation"),
      subjectConcept: id,
      relation: z.enum(["derives", "reduces", "promotes", "inhibits"]),
      objectConcept: id,
    })
    .strict(),
]);

const factTypeSchema = z.enum([
  "study_design_feature",
  "blinding",
  "phase",
  "population_condition",
  "population_sample_size",
  "population_characteristic",
  "eligibility",
  "arm",
  "allocation_ratio",
  "treatment_duration",
  "endpoint_timepoint",
  "endpoint",
  "result",
  "arm_estimate",
  "statistical_hypothesis",
  "safety_event",
  "safety_comparison",
  "registry_identifier",
  "mechanism_relation",
]);

const provenanceSchema = z
  .object({
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("evidence_anchor"), id }).strict(),
      z.object({ kind: z.literal("scientific_fact"), id }).strict(),
    ]),
    relation: z.enum(["supports", "qualifies", "contradicts", "defines", "derived_from"]),
  })
  .strict();

export const scientificFactSchema = z
  .object({
    schemaVersion: z.literal(SCIENTIFIC_FACT_SCHEMA_VERSION),
    id,
    articleId: id,
    studyType: z.literal("randomized_controlled_trial"),
    factType: factTypeSchema,
    availability: availability(rctFactValueSchema),
    origin: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("source") }).strict(),
      z
        .object({ kind: z.literal("derived"), inputFactIds: z.array(id).min(1), method: id })
        .strict(),
    ]),
    provenance: z.array(provenanceSchema).min(1),
  })
  .strict()
  .superRefine((fact, context) => {
    const derivedRelations = fact.provenance.filter((item) => item.relation === "derived_from");
    if (fact.origin.kind === "source" && derivedRelations.length) {
      context.addIssue({
        code: "custom",
        path: ["provenance"],
        message: "source facts cannot use derived_from provenance",
      });
    }
    if (fact.origin.kind === "derived" && !derivedRelations.length) {
      context.addIssue({
        code: "custom",
        path: ["provenance"],
        message: "derived facts require derived_from provenance",
      });
    }
    if (
      fact.availability.status === "available" &&
      fact.factType !== fact.availability.value.type
    ) {
      context.addIssue({
        code: "custom",
        path: ["factType"],
        message: "factType must match the available typed value",
      });
    }
    if (
      fact.provenance.some(
        (item) => (item.relation === "derived_from") !== (item.target.kind === "scientific_fact"),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["provenance"],
        message: "derived_from must target facts; source relations must target evidence anchors",
      });
    }
  });

export type SourceDocument = z.infer<typeof sourceDocumentSchema>;
export type EvidenceAnchor = z.infer<typeof evidenceAnchorSchema>;
export type ScientificFact = z.infer<typeof scientificFactSchema>;
