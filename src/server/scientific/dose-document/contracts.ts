import { z } from "zod";

export const DOSE_DOCUMENT_SCHEMA_VERSION = "dose-document.v1" as const;

const id = z.string().trim().min(1).max(200);
const text = z.string().trim().min(1).max(5_000);
const factIds = z.array(id).min(1);

const proseBlockSchema = z
  .object({ id, kind: z.literal("prose"), paragraphs: z.array(text).min(1), factIds })
  .strict();

const studyDesignBlockSchema = z
  .object({
    id,
    kind: z.literal("study_design"),
    label: text,
    steps: z.array(z.object({ id, label: text }).strict()).min(2),
    factIds,
  })
  .strict();

const resultBlockSchema = z
  .object({
    id,
    kind: z.literal("result"),
    endpoint: text,
    estimate: text,
    confidenceInterval: text,
    pValue: text,
    comparison: text,
    timepoint: text,
    interpretation: text,
    factIds,
  })
  .strict();

const safetyBlockSchema = z
  .object({
    id,
    kind: z.literal("safety"),
    summary: text,
    events: z.array(z.object({ id, label: text, value: text }).strict()).min(1),
    caveat: text,
    factIds,
  })
  .strict();

export const doseBlockSchema = z.discriminatedUnion("kind", [
  proseBlockSchema,
  studyDesignBlockSchema,
  resultBlockSchema,
  safetyBlockSchema,
]);

export const doseDocumentSchema = z
  .object({
    schemaVersion: z.literal(DOSE_DOCUMENT_SCHEMA_VERSION),
    id,
    articleId: id,
    language: z.literal("pt-BR"),
    label: z.literal("Edição editorial Dose"),
    headline: text,
    deck: text,
    openingSummary: z.array(z.object({ id, text, factIds }).strict()).min(1),
    chapters: z
      .array(z.object({ id, title: text, blocks: z.array(doseBlockSchema).min(1) }).strict())
      .min(1),
    keyNumbers: z
      .array(z.object({ id, value: text, label: text, context: text, factIds }).strict())
      .min(1),
    contextualExplainers: z
      .array(z.object({ id, title: text, body: text, factIds }).strict())
      .min(1),
    sourceCoverage: z
      .object({
        id,
        basedOn: z.array(z.enum(["metadata", "abstract"])).min(1),
        notCovered: z.array(text).min(1),
        statement: text,
      })
      .strict(),
    sourceReferences: z
      .array(
        z
          .object({
            id,
            kind: z.enum(["pubmed", "doi", "registry"]),
            label: text,
            value: text,
            url: z.url(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((document, context) => {
    const blockIds = document.chapters.flatMap((chapter) =>
      chapter.blocks.map((block) => block.id),
    );
    const allIds = [
      ...document.chapters.map((chapter) => chapter.id),
      ...blockIds,
      ...document.openingSummary.map((paragraph) => paragraph.id),
      ...document.keyNumbers.map((number) => number.id),
      ...document.contextualExplainers.map((explainer) => explainer.id),
      document.sourceCoverage.id,
      ...document.sourceReferences.map((reference) => reference.id),
    ];
    if (new Set(allIds).size !== allIds.length) {
      context.addIssue({ code: "custom", message: "presentation block ids must be unique" });
    }
  });

export type DoseDocument = z.infer<typeof doseDocumentSchema>;
