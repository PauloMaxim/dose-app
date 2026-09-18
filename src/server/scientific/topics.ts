import type { ScientificArticle } from "./types";

export type TopicEvidenceField =
  "title" | "abstract" | "keyword" | "mesh" | "publication_type" | "journal";
export interface TopicRule {
  topicId: string;
  specialtyId: string | null;
  version: string;
  preferredTerms?: string[];
  synonyms?: string[];
  meshTerms?: string[];
  requiredTerms?: string[];
  exclusionTerms?: string[];
  ambiguousTerms?: string[];
  publicationTypes?: string[];
  journals?: string[];
}
export interface TopicEvidence {
  field: TopicEvidenceField;
  term: string;
}
export interface TopicMatch {
  topicId: string;
  specialtyId: string | null;
  confidence: number;
  method: "deterministic_rules";
  ruleVersion: string;
  evidence: TopicEvidence[];
}

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const has = (text: string, term: string) =>
  new RegExp(
    `(^|[^a-z0-9])${norm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`,
    "i",
  ).test(text);

/** Rules are catalog data supplied by the trusted caller, not a hard-coded taxonomy. */
export function classifyArticleTopics(
  article: ScientificArticle,
  rules: readonly TopicRule[],
): TopicMatch[] {
  const fields: Array<[TopicEvidenceField, string[]]> = [
    ["title", [article.title]],
    ["abstract", [article.abstract ?? ""]],
    ["keyword", article.keywords],
    ["mesh", article.meshTerms],
    ["publication_type", article.publicationTypes],
    ["journal", [article.journal ?? ""]],
  ];
  return rules
    .flatMap((rule) => {
      const allText = fields.flatMap(([, xs]) => xs).map(norm);
      if ((rule.exclusionTerms ?? []).some((t) => allText.some((x) => has(x, t)))) return [];
      if ((rule.requiredTerms ?? []).some((t) => !allText.some((x) => has(x, t)))) return [];
      const evidence: TopicEvidence[] = [];
      const terms = [...(rule.preferredTerms ?? []), ...(rule.synonyms ?? [])];
      for (const [field, values] of fields.slice(0, 4))
        for (const term of field === "mesh" ? (rule.meshTerms ?? []) : terms)
          if (values.some((v) => has(norm(v), term))) evidence.push({ field, term });
      for (const term of rule.publicationTypes ?? [])
        if (article.publicationTypes.some((v) => has(norm(v), term)))
          evidence.push({ field: "publication_type", term });
      for (const term of rule.journals ?? [])
        if (article.journal && has(norm(article.journal), term))
          evidence.push({ field: "journal", term });
      const ambiguousOnly =
        evidence.length > 0 &&
        evidence.every((e) => (rule.ambiguousTerms ?? []).some((t) => norm(t) === norm(e.term)));
      if (!evidence.length || ambiguousOnly) return [];
      const weight: Record<TopicEvidenceField, number> = {
        mesh: 40,
        title: 30,
        keyword: 25,
        abstract: 15,
        publication_type: 15,
        journal: 10,
      };
      const confidence =
        Math.min(
          90,
          40 +
            new Set(evidence.map((e) => `${e.field}:${norm(e.term)}`)).size * 10 +
            Math.max(...evidence.map((e) => weight[e.field])),
        ) / 100;
      return [
        {
          topicId: rule.topicId,
          specialtyId: rule.specialtyId,
          confidence,
          method: "deterministic_rules" as const,
          ruleVersion: rule.version,
          evidence,
        },
      ];
    })
    .sort((a, b) => b.confidence - a.confidence || a.topicId.localeCompare(b.topicId));
}
