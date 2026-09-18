import { z } from "zod";

export const SUMMARY_SCHEMA_VERSION = "scientific-summary.v1";

const nullableText = z.string().trim().max(2_000).nullable();
export const keyNumberSchema = z.object({
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(120),
  context: z.string().trim().max(500).nullable(),
});
export const technicalTermSchema = z.object({
  term: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(500),
});

export const scientificSummarySchema = z
  .object({
    shortSummary: z.string().trim().min(1).max(1_500),
    objective: nullableText,
    studyDesign: nullableText,
    populationOrSample: nullableText,
    methods: nullableText,
    mainFindings: nullableText,
    keyNumbers: z.array(keyNumberSchema).max(30),
    authorsConclusion: nullableText,
    limitations: nullableText,
    practicalImplications: nullableText,
    evidenceContext: nullableText,
    cautions: nullableText,
    technicalTerms: z.array(technicalTermSchema).max(30),
    sourceScope: z.literal("abstract_and_metadata"),
  })
  .strict();

export type ScientificSummary = z.infer<typeof scientificSummarySchema>;

export const scientificSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "shortSummary",
    "objective",
    "studyDesign",
    "populationOrSample",
    "methods",
    "mainFindings",
    "keyNumbers",
    "authorsConclusion",
    "limitations",
    "practicalImplications",
    "evidenceContext",
    "cautions",
    "technicalTerms",
    "sourceScope",
  ],
  properties: {
    shortSummary: { type: "string", minLength: 1, maxLength: 1500 },
    ...Object.fromEntries(
      [
        "objective",
        "studyDesign",
        "populationOrSample",
        "methods",
        "mainFindings",
        "authorsConclusion",
        "limitations",
        "practicalImplications",
        "evidenceContext",
        "cautions",
      ].map((key) => [key, { type: ["string", "null"], maxLength: 2000 }]),
    ),
    keyNumbers: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "context"],
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          context: { type: ["string", "null"] },
        },
      },
    },
    technicalTerms: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "explanation"],
        properties: { term: { type: "string" }, explanation: { type: "string" } },
      },
    },
    sourceScope: { type: "string", const: "abstract_and_metadata" },
  },
} as const;
