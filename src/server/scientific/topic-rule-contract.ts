import { z } from "zod";

export const TOPIC_RULE_VERSION = "catalog-v1-topic-rules-v1" as const;

const term = z.string().trim().min(1).max(200);
const terms = z.array(term).max(100);
const evidenceKeys = [
  "preferredTerms",
  "synonyms",
  "meshTerms",
  "publicationTypes",
  "journals",
] as const;

const normalized = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const storedTopicRuleSchema = z
  .object({
    version: z.literal(TOPIC_RULE_VERSION),
    preferredTerms: terms.optional(),
    synonyms: terms.optional(),
    meshTerms: terms.optional(),
    requiredTerms: terms.optional(),
    exclusionTerms: terms.optional(),
    ambiguousTerms: terms.optional(),
    publicationTypes: terms.optional(),
    journals: terms.optional(),
  })
  .strict()
  .superRefine((rule, context) => {
    for (const [key, values] of Object.entries(rule)) {
      if (!Array.isArray(values)) continue;
      const seen = new Set<string>();
      for (const value of values) {
        const keyValue = normalized(value);
        if (seen.has(keyValue))
          context.addIssue({
            code: "custom",
            path: [key],
            message: "terms must be unique after normalization",
          });
        seen.add(keyValue);
      }
    }

    const evidence = new Set(evidenceKeys.flatMap((key) => rule[key] ?? []).map(normalized));
    if (!evidence.size)
      context.addIssue({
        code: "custom",
        message: "at least one evidence term is required",
      });

    const exclusions = new Set((rule.exclusionTerms ?? []).map(normalized));
    for (const value of rule.requiredTerms ?? [])
      if (exclusions.has(normalized(value)))
        context.addIssue({
          code: "custom",
          path: ["requiredTerms"],
          message: "a required term cannot also be excluded",
        });
    for (const value of evidence)
      if (exclusions.has(value))
        context.addIssue({
          code: "custom",
          path: ["exclusionTerms"],
          message: "an evidence term cannot also be excluded",
        });
    for (const value of rule.ambiguousTerms ?? [])
      if (!evidence.has(normalized(value)))
        context.addIssue({
          code: "custom",
          path: ["ambiguousTerms"],
          message: "an ambiguous term must also be an evidence term",
        });
  });

export type StoredTopicRule = z.infer<typeof storedTopicRuleSchema>;
