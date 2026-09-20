import { z } from "zod";

export const SUMMARY_SCHEMA_VERSION = "scientific-summary.v2" as const;
export const summaryFieldNames = [
  "scientificQuestion",
  "context",
  "studyDesign",
  "populationOrSample",
  "interventionOrExposure",
  "comparator",
  "primaryOutcomes",
  "mainResults",
  "interpretation",
  "limitations",
  "practicalImplications",
  "evidenceType",
] as const;

const nullableText = z.string().trim().min(1).max(2_000).nullable();
const identifier = z.string().trim().min(1).max(200).nullable();

export const scientificSummarySchema = z
  .object({
    schemaVersion: z.literal(SUMMARY_SCHEMA_VERSION),
    contextualTitle: z.string().trim().min(1).max(300),
    scientificQuestion: nullableText,
    context: nullableText,
    studyDesign: nullableText,
    populationOrSample: nullableText,
    interventionOrExposure: nullableText,
    comparator: nullableText,
    primaryOutcomes: nullableText,
    mainResults: nullableText,
    interpretation: nullableText,
    limitations: nullableText,
    practicalImplications: nullableText,
    evidenceType: nullableText,
    keyPoints: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
    unavailableFields: z.array(z.enum(summaryFieldNames)).max(summaryFieldNames.length),
    identifiers: z.object({ doi: identifier, pmid: identifier, pmcid: identifier }).strict(),
    sourceScope: z.literal("abstract_and_metadata"),
  })
  .strict()
  .superRefine((summary, context) => {
    const unavailable = new Set(summary.unavailableFields);
    for (const field of summaryFieldNames) {
      if ((summary[field] === null) !== unavailable.has(field)) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "null fields must be explicitly listed as unavailable, and vice versa",
        });
      }
    }
    if (unavailable.size !== summary.unavailableFields.length)
      context.addIssue({ code: "custom", path: ["unavailableFields"], message: "must be unique" });
  });

export type ScientificSummary = z.infer<typeof scientificSummarySchema>;

const nullableString = {
  anyOf: [{ type: "string", minLength: 1, maxLength: 2000 }, { type: "null" }],
};
export const scientificSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "contextualTitle",
    ...summaryFieldNames,
    "keyPoints",
    "unavailableFields",
    "identifiers",
    "sourceScope",
  ],
  properties: {
    schemaVersion: { type: "string", const: SUMMARY_SCHEMA_VERSION },
    contextualTitle: { type: "string", minLength: 1, maxLength: 300 },
    ...Object.fromEntries(summaryFieldNames.map((field) => [field, nullableString])),
    keyPoints: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 500 },
    },
    unavailableFields: {
      type: "array",
      uniqueItems: true,
      maxItems: summaryFieldNames.length,
      items: { type: "string", enum: summaryFieldNames },
    },
    identifiers: {
      type: "object",
      additionalProperties: false,
      required: ["doi", "pmid", "pmcid"],
      properties: Object.fromEntries(
        ["doi", "pmid", "pmcid"].map((key) => [
          key,
          {
            anyOf: [{ type: "string", minLength: 1, maxLength: 200 }, { type: "null" }],
          },
        ]),
      ),
    },
    sourceScope: { type: "string", const: "abstract_and_metadata" },
  },
} as const;
