import type { ScientificArticle } from "./types";

export const studyTypes = [
  "systematic_review",
  "meta_analysis",
  "guideline",
  "randomized_trial",
  "cohort",
  "case_control",
  "cross_sectional",
  "case_report",
  "editorial",
  "other",
] as const;

export type StudyType = (typeof studyTypes)[number];
export type EvidenceLevel = "high" | "moderate" | "low" | "very_low";

export interface ArticleClassification {
  studyType: StudyType;
  evidenceLevel: EvidenceLevel;
  ruleVersion: "3b.1";
  matchedTerm: string | null;
}

const rules: ReadonlyArray<readonly [StudyType, EvidenceLevel, readonly string[]]> = [
  ["meta_analysis", "high", ["meta-analysis", "meta analysis"]],
  ["systematic_review", "high", ["systematic review"]],
  ["guideline", "high", ["practice guideline", "guideline", "consensus development conference"]],
  [
    "randomized_trial",
    "high",
    [
      "randomized controlled trial",
      "controlled clinical trial",
      "clinical trial, phase iii",
      "clinical trial, phase 3",
    ],
  ],
  [
    "cohort",
    "moderate",
    ["cohort studies", "cohort study", "longitudinal study", "prospective studies"],
  ],
  ["case_control", "moderate", ["case-control studies", "case control study"]],
  ["cross_sectional", "low", ["cross-sectional studies", "cross sectional study"]],
  ["case_report", "very_low", ["case reports", "case report"]],
  ["editorial", "very_low", ["editorial", "letter", "comment"]],
];

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("en-US");

/** Classifies only source metadata. Rule order is intentional and versioned. */
export function classifyScientificArticle(
  article: Pick<ScientificArticle, "publicationTypes">,
): ArticleClassification {
  const terms = article.publicationTypes.map(normalize).sort();
  for (const [studyType, evidenceLevel, needles] of rules) {
    const matchedTerm = terms.find((term) => needles.some((needle) => term.includes(needle)));
    if (matchedTerm) return { studyType, evidenceLevel, ruleVersion: "3b.1", matchedTerm };
  }
  return { studyType: "other", evidenceLevel: "low", ruleVersion: "3b.1", matchedTerm: null };
}