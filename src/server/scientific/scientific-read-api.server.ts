import "./server-only";
import { z } from "zod";
import { storedTopicRuleSchema } from "./topic-rule-contract";

const uuid = z.string().uuid();
const nullableTrimmedString = z.string().nullable();

export const topicRuleSnapshotRowSchema = z
  .object({
    topic_id: uuid,
    topic_slug: z.string().trim().min(1),
    topic_name: z.string().trim().min(1),
    topic_is_active: z.boolean(),
    specialty_id: uuid.nullable(),
    specialty_slug: z.string().trim().min(1).nullable(),
    specialty_name: z.string().trim().min(1).nullable(),
    specialty_is_active: z.boolean().nullable(),
    classification_rules: storedTopicRuleSchema,
  })
  .strict()
  .superRefine((row, context) => {
    const specialtyFields = [row.specialty_slug, row.specialty_name, row.specialty_is_active];
    if (row.specialty_id === null && specialtyFields.some((value) => value !== null))
      context.addIssue({ code: "custom", message: "transversal topic cannot include specialty data" });
    if (row.specialty_id !== null && specialtyFields.some((value) => value === null))
      context.addIssue({ code: "custom", message: "topic specialty data is incomplete" });
  });

const evidenceSchema = z
  .object({
    field: z.enum(["title", "abstract", "keyword", "mesh", "publication_type", "journal"]),
    term: z.string().trim().min(1),
  })
  .strict();

const associationSchema = z
  .object({
    topic_id: uuid,
    association_type: z.enum(["automatic", "editorial"]),
    method: nullableTrimmedString,
    confidence: z.number().min(0).max(1).nullable(),
    evidence: z.array(evidenceSchema),
    rule_version: nullableTrimmedString,
  })
  .strict();

export const scientificReclassificationRowSchema = z
  .object({
    article_id: uuid,
    title: z.string().trim().min(1),
    abstract: nullableTrimmedString,
    keywords: z.array(z.string()),
    mesh_terms: z.array(z.string()),
    publication_types: z.array(z.string()),
    journal: nullableTrimmedString,
    associations: z.array(associationSchema),
  })
  .strict()
  .superRefine((row, context) => {
    const ids = row.associations.map((association) => association.topic_id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", path: ["associations"], message: "topic IDs must be unique" });
    if (ids.some((id, index) => index > 0 && ids[index - 1].localeCompare(id) >= 0))
      context.addIssue({ code: "custom", path: ["associations"], message: "associations must be ordered" });
  });

export const topicRuleSnapshotSchema = z.array(topicRuleSnapshotRowSchema).max(100);
export const scientificReclassificationBatchSchema = z
  .array(scientificReclassificationRowSchema)
  .max(100)
  .superRefine((rows, context) => {
    const ids = rows.map((row) => row.article_id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: "custom", message: "article IDs must be unique" });
    if (ids.some((id, index) => index > 0 && ids[index - 1].localeCompare(id) >= 0))
      context.addIssue({ code: "custom", message: "articles must be ordered" });
  });
