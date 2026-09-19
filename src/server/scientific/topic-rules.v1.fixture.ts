/** Test-only clinical fixture. Production rules are loaded exclusively from the database. */
import { TOPIC_V1 } from "../../lib/scientific-catalog";
import {
  TOPIC_RULE_VERSION,
  storedTopicRuleSchema,
  type StoredTopicRule,
} from "./topic-rule-contract";
import type { TopicRule } from "./topics";
import type { ScientificArticle } from "./types";

type TopicSlug = (typeof TOPIC_V1)[number][1];

const defineRule = (value: unknown): StoredTopicRule => storedTopicRuleSchema.parse(value);

export const TOPIC_RULES_V1_FIXTURE: Readonly<Record<TopicSlug, StoredTopicRule>> = {
  "insuficiencia-cardiaca": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: ["heart failure", "insuficiência cardíaca"],
    synonyms: ["cardiac failure"],
    meshTerms: ["Heart Failure"],
  }),
  "obesidade-e-incretinas": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: ["obesity", "obesidade"],
    meshTerms: ["Obesity", "Obesity, Morbid"],
  }),
  "fibrilacao-atrial": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: ["atrial fibrillation", "fibrilação atrial"],
    meshTerms: ["Atrial Fibrillation"],
  }),
  "doenca-renal-cronica": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: ["chronic kidney disease", "chronic renal disease", "doença renal crônica"],
    synonyms: ["chronic renal insufficiency"],
    meshTerms: ["Renal Insufficiency, Chronic"],
  }),
  "prevencao-cardiovascular": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: [
      "cardiovascular prevention",
      "cardiovascular disease prevention",
      "cardiovascular risk reduction",
      "primary prevention of cardiovascular disease",
      "secondary prevention of cardiovascular disease",
      "prevenção cardiovascular",
    ],
    meshTerms: ["Primary Prevention", "Secondary Prevention"],
    requiredTerms: ["cardiovascular"],
  }),
  diabetes: defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: [
      "diabetes mellitus",
      "type 1 diabetes",
      "type 2 diabetes",
      "gestational diabetes",
    ],
    meshTerms: [
      "Diabetes Mellitus",
      "Diabetes Mellitus, Type 1",
      "Diabetes Mellitus, Type 2",
      "Diabetes, Gestational",
    ],
  }),
  "sepse-e-antibioticos": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: ["sepsis", "septic shock", "sepse", "choque séptico"],
    meshTerms: ["Sepsis", "Shock, Septic"],
  }),
  lipidios: defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: [
      "dyslipidemia",
      "dyslipidaemia",
      "dislipidemia",
      "hypercholesterolemia",
      "hypertriglyceridemia",
      "LDL cholesterol",
      "non-HDL cholesterol",
      "lipid-lowering therapy",
    ],
    meshTerms: ["Dyslipidemias", "Hypercholesterolemia", "Hypertriglyceridemia"],
  }),
  hipertensao: defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: [
      "arterial hypertension",
      "essential hypertension",
      "systemic hypertension",
      "hipertensão arterial",
    ],
    meshTerms: ["Hypertension", "Hypertension, Essential"],
    exclusionTerms: [
      "pulmonary hypertension",
      "portal hypertension",
      "intracranial hypertension",
      "ocular hypertension",
    ],
  }),
  "doenca-coronariana": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: [
      "coronary artery disease",
      "coronary heart disease",
      "acute coronary syndrome",
      "myocardial infarction",
      "ischemic heart disease",
      "ischaemic heart disease",
      "doença arterial coronariana",
    ],
    meshTerms: [
      "Coronary Artery Disease",
      "Acute Coronary Syndrome",
      "Myocardial Infarction",
      "Myocardial Ischemia",
    ],
  }),
  "vacinas-no-adulto": defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: [
      "adult vaccination",
      "adult immunization",
      "vaccination in adult",
      "immunization in adult",
      "vacinação no adulto",
    ],
  }),
  hepatologia: defineRule({
    version: TOPIC_RULE_VERSION,
    preferredTerms: [
      "liver cirrhosis",
      "hepatic cirrhosis",
      "portal hypertension",
      "viral hepatitis",
      "hepatocellular carcinoma",
      "metabolic dysfunction-associated steatotic liver disease",
      "alcohol-associated liver disease",
      "chronic liver disease",
      "hepatic fibrosis",
      "cirrose hepática",
      "hepatite viral",
    ],
    meshTerms: [
      "Liver Cirrhosis",
      "Portal Hypertension",
      "Hepatitis, Viral, Human",
      "Carcinoma, Hepatocellular",
      "Fatty Liver",
    ],
  }),
};

export const TOPIC_RULES_V1_CLASSIFIER_FIXTURE: readonly TopicRule[] = TOPIC_V1.map(
  ([topicId, slug, , specialtyId]) => ({
    ...TOPIC_RULES_V1_FIXTURE[slug],
    topicId,
    specialtyId,
  }),
);

export interface TopicRuleScenario {
  id: string;
  focus: TopicSlug;
  category:
    | "title_positive"
    | "obvious_negative"
    | "ambiguous_isolated"
    | "multitopic"
    | "no_abstract"
    | "strong_title_weak_abstract"
    | "generic_title_strong_abstract"
    | "drug_other_indication";
  article: Partial<ScientificArticle> & Pick<ScientificArticle, "title">;
  expectedSlugs: readonly TopicSlug[];
  deliberateFalseNegative?: boolean;
}

const s = (
  focus: TopicSlug,
  category: TopicRuleScenario["category"],
  title: string,
  expectedSlugs: readonly TopicSlug[],
  article: Omit<TopicRuleScenario["article"], "title"> = {},
  deliberateFalseNegative = false,
): TopicRuleScenario => ({
  id: `${focus}:${category}`,
  focus,
  category,
  article: { title, ...article },
  expectedSlugs,
  deliberateFalseNegative,
});

export const TOPIC_RULES_V1_CORPUS: readonly TopicRuleScenario[] = [
  s("insuficiencia-cardiaca", "title_positive", "Heart failure outcomes", [
    "insuficiencia-cardiaca",
  ]),
  s("insuficiencia-cardiaca", "obvious_negative", "Healthy volunteer exercise physiology", []),
  s("insuficiencia-cardiaca", "ambiguous_isolated", "HF treatment update", [], {}, true),
  s("insuficiencia-cardiaca", "multitopic", "Atrial fibrillation in heart failure", [
    "insuficiencia-cardiaca",
    "fibrilacao-atrial",
  ]),
  s(
    "insuficiencia-cardiaca",
    "no_abstract",
    "Insuficiência cardíaca descompensada",
    ["insuficiencia-cardiaca"],
    { abstract: null },
  ),
  s(
    "insuficiencia-cardiaca",
    "strong_title_weak_abstract",
    "Cardiac failure management",
    ["insuficiencia-cardiaca"],
    { abstract: "General clinical outcomes." },
  ),
  s(
    "insuficiencia-cardiaca",
    "generic_title_strong_abstract",
    "Contemporary therapy",
    ["insuficiencia-cardiaca"],
    { abstract: "Patients with heart failure were followed." },
  ),
  s("insuficiencia-cardiaca", "drug_other_indication", "Empagliflozin for type 2 diabetes", [
    "diabetes",
  ]),

  s("obesidade-e-incretinas", "title_positive", "Obesity management in adults", [
    "obesidade-e-incretinas",
  ]),
  s("obesidade-e-incretinas", "obvious_negative", "Normal-weight exercise physiology", []),
  s("obesidade-e-incretinas", "ambiguous_isolated", "GLP-1 receptor signaling", [], {}, true),
  s("obesidade-e-incretinas", "multitopic", "Obesity and cardiovascular risk reduction", [
    "obesidade-e-incretinas",
    "prevencao-cardiovascular",
  ]),
  s("obesidade-e-incretinas", "no_abstract", "Obesidade em adultos", ["obesidade-e-incretinas"], {
    abstract: null,
  }),
  s(
    "obesidade-e-incretinas",
    "strong_title_weak_abstract",
    "OBESITY treatment",
    ["obesidade-e-incretinas"],
    { abstract: "General outcomes." },
  ),
  s(
    "obesidade-e-incretinas",
    "generic_title_strong_abstract",
    "Weight study",
    ["obesidade-e-incretinas"],
    { abstract: "The cohort had obesity." },
  ),
  s("obesidade-e-incretinas", "drug_other_indication", "Empagliflozin for heart failure", [
    "insuficiencia-cardiaca",
  ]),

  s("fibrilacao-atrial", "title_positive", "Atrial fibrillation ablation", ["fibrilacao-atrial"]),
  s("fibrilacao-atrial", "obvious_negative", "Sinus rhythm in healthy adults", []),
  s("fibrilacao-atrial", "ambiguous_isolated", "AF monitoring", [], {}, true),
  s("fibrilacao-atrial", "multitopic", "Atrial fibrillation and coronary artery disease", [
    "fibrilacao-atrial",
    "doenca-coronariana",
  ]),
  s("fibrilacao-atrial", "no_abstract", "Fibrilação atrial persistente", ["fibrilacao-atrial"], {
    abstract: null,
  }),
  s(
    "fibrilacao-atrial",
    "strong_title_weak_abstract",
    "Atrial fibrillation therapy",
    ["fibrilacao-atrial"],
    { abstract: "General outcomes." },
  ),
  s("fibrilacao-atrial", "generic_title_strong_abstract", "Rhythm study", ["fibrilacao-atrial"], {
    abstract: "All participants had atrial fibrillation.",
  }),
  s("fibrilacao-atrial", "drug_other_indication", "Semaglutide for obesity", [
    "obesidade-e-incretinas",
  ]),

  s("doenca-renal-cronica", "title_positive", "Chronic kidney disease progression", [
    "doenca-renal-cronica",
  ]),
  s("doenca-renal-cronica", "obvious_negative", "Acute kidney injury recovery", []),
  s("doenca-renal-cronica", "ambiguous_isolated", "CKD registry", [], {}, true),
  s("doenca-renal-cronica", "multitopic", "Type 2 diabetes and chronic kidney disease", [
    "doenca-renal-cronica",
    "diabetes",
  ]),
  s(
    "doenca-renal-cronica",
    "no_abstract",
    "Doença renal crônica avançada",
    ["doenca-renal-cronica"],
    { abstract: null },
  ),
  s(
    "doenca-renal-cronica",
    "strong_title_weak_abstract",
    "Chronic renal disease therapy",
    ["doenca-renal-cronica"],
    { abstract: "General outcomes." },
  ),
  s(
    "doenca-renal-cronica",
    "generic_title_strong_abstract",
    "Renal cohort",
    ["doenca-renal-cronica"],
    { abstract: "Participants had chronic renal insufficiency." },
  ),
  s("doenca-renal-cronica", "drug_other_indication", "Tirzepatide for obesity", [
    "obesidade-e-incretinas",
  ]),

  s("prevencao-cardiovascular", "title_positive", "Cardiovascular disease prevention strategies", [
    "prevencao-cardiovascular",
  ]),
  s("prevencao-cardiovascular", "obvious_negative", "Cancer prevention strategies", []),
  s("prevencao-cardiovascular", "ambiguous_isolated", "Prevention in primary care", [], {}, true),
  s("prevencao-cardiovascular", "multitopic", "Dyslipidemia and cardiovascular prevention", [
    "prevencao-cardiovascular",
    "lipidios",
  ]),
  s(
    "prevencao-cardiovascular",
    "no_abstract",
    "Prevenção cardiovascular baseada em risco",
    ["prevencao-cardiovascular"],
    { abstract: null },
  ),
  s(
    "prevencao-cardiovascular",
    "strong_title_weak_abstract",
    "Cardiovascular risk reduction",
    ["prevencao-cardiovascular"],
    { abstract: "General outcomes." },
  ),
  s(
    "prevencao-cardiovascular",
    "generic_title_strong_abstract",
    "Prevention study",
    ["prevencao-cardiovascular"],
    { abstract: "We evaluated cardiovascular prevention." },
  ),
  s(
    "prevencao-cardiovascular",
    "drug_other_indication",
    "Empagliflozin in chronic kidney disease",
    ["doenca-renal-cronica"],
  ),

  s("diabetes", "title_positive", "Diabetes mellitus treatment", ["diabetes"]),
  s("diabetes", "obvious_negative", "Diabetes insipidus diagnosis", []),
  s("diabetes", "ambiguous_isolated", "DM care pathway", [], {}, true),
  s("diabetes", "multitopic", "Type 1 diabetes with chronic kidney disease", [
    "diabetes",
    "doenca-renal-cronica",
  ]),
  s("diabetes", "no_abstract", "Type 2 diabetes outcomes", ["diabetes"], { abstract: null }),
  s("diabetes", "strong_title_weak_abstract", "Gestational diabetes care", ["diabetes"], {
    abstract: "General outcomes.",
  }),
  s("diabetes", "generic_title_strong_abstract", "Metabolic cohort", ["diabetes"], {
    abstract: "Adults with type 1 diabetes were enrolled.",
  }),
  s("diabetes", "drug_other_indication", "Semaglutide for obesity without glycemic disease", [
    "obesidade-e-incretinas",
  ]),

  s("sepse-e-antibioticos", "title_positive", "Sepsis management", ["sepse-e-antibioticos"]),
  s("sepse-e-antibioticos", "obvious_negative", "Antibiotics for acne", []),
  s("sepse-e-antibioticos", "ambiguous_isolated", "Antibiotic selection", [], {}, true),
  s("sepse-e-antibioticos", "multitopic", "Sepsis in chronic liver disease", [
    "sepse-e-antibioticos",
    "hepatologia",
  ]),
  s("sepse-e-antibioticos", "no_abstract", "Choque séptico", ["sepse-e-antibioticos"], {
    abstract: null,
  }),
  s(
    "sepse-e-antibioticos",
    "strong_title_weak_abstract",
    "Septic shock therapy",
    ["sepse-e-antibioticos"],
    { abstract: "General outcomes." },
  ),
  s(
    "sepse-e-antibioticos",
    "generic_title_strong_abstract",
    "Critical care cohort",
    ["sepse-e-antibioticos"],
    { abstract: "Patients were admitted with sepsis." },
  ),
  s("sepse-e-antibioticos", "drug_other_indication", "Tirzepatide for obesity", [
    "obesidade-e-incretinas",
  ]),

  s("lipidios", "title_positive", "Dyslipidemia treatment", ["lipidios"]),
  s("lipidios", "obvious_negative", "Membrane lipids in cell biology", []),
  s("lipidios", "ambiguous_isolated", "Lipids and cellular transport", [], {}, true),
  s("lipidios", "multitopic", "LDL cholesterol and cardiovascular disease prevention", [
    "lipidios",
    "prevencao-cardiovascular",
  ]),
  s("lipidios", "no_abstract", "Dislipidemia familiar", ["lipidios"], { abstract: null }),
  s("lipidios", "strong_title_weak_abstract", "Hypercholesterolemia therapy", ["lipidios"], {
    abstract: "General outcomes.",
  }),
  s("lipidios", "generic_title_strong_abstract", "Metabolic study", ["lipidios"], {
    abstract: "Participants had hypertriglyceridemia.",
  }),
  s("lipidios", "drug_other_indication", "Empagliflozin for heart failure", [
    "insuficiencia-cardiaca",
  ]),

  s("hipertensao", "title_positive", "Arterial hypertension treatment", ["hipertensao"]),
  s("hipertensao", "obvious_negative", "Pulmonary hypertension treatment", []),
  s("hipertensao", "ambiguous_isolated", "HTN registry", [], {}, true),
  s("hipertensao", "multitopic", "Essential hypertension and coronary artery disease", [
    "hipertensao",
    "doenca-coronariana",
  ]),
  s("hipertensao", "no_abstract", "Hipertensão arterial resistente", ["hipertensao"], {
    abstract: null,
  }),
  s("hipertensao", "strong_title_weak_abstract", "Systemic hypertension therapy", ["hipertensao"], {
    abstract: "General outcomes.",
  }),
  s("hipertensao", "generic_title_strong_abstract", "Pressure cohort", ["hipertensao"], {
    abstract: "Adults with essential hypertension were enrolled.",
  }),
  s("hipertensao", "drug_other_indication", "Tirzepatide for obesity", ["obesidade-e-incretinas"]),

  s("doenca-coronariana", "title_positive", "Coronary artery disease management", [
    "doenca-coronariana",
  ]),
  s("doenca-coronariana", "obvious_negative", "Computer-aided design workflow", []),
  s("doenca-coronariana", "ambiguous_isolated", "CAD software update", [], {}, true),
  s("doenca-coronariana", "multitopic", "Coronary heart disease with arterial hypertension", [
    "doenca-coronariana",
    "hipertensao",
  ]),
  s(
    "doenca-coronariana",
    "no_abstract",
    "Doença arterial coronariana estável",
    ["doenca-coronariana"],
    { abstract: null },
  ),
  s(
    "doenca-coronariana",
    "strong_title_weak_abstract",
    "Acute coronary syndrome therapy",
    ["doenca-coronariana"],
    { abstract: "General outcomes." },
  ),
  s(
    "doenca-coronariana",
    "generic_title_strong_abstract",
    "Cardiac cohort",
    ["doenca-coronariana"],
    { abstract: "Participants survived myocardial infarction." },
  ),
  s("doenca-coronariana", "drug_other_indication", "Empagliflozin in chronic kidney disease", [
    "doenca-renal-cronica",
  ]),

  s("vacinas-no-adulto", "title_positive", "Adult vaccination strategies", ["vacinas-no-adulto"]),
  s("vacinas-no-adulto", "obvious_negative", "Childhood vaccination schedule", []),
  s("vacinas-no-adulto", "ambiguous_isolated", "RSV surveillance", [], {}, true),
  s("vacinas-no-adulto", "multitopic", "Adult immunization in chronic liver disease", [
    "vacinas-no-adulto",
    "hepatologia",
  ]),
  s("vacinas-no-adulto", "no_abstract", "Vacinação no adulto", ["vacinas-no-adulto"], {
    abstract: null,
  }),
  s(
    "vacinas-no-adulto",
    "strong_title_weak_abstract",
    "Adult immunization recommendations",
    ["vacinas-no-adulto"],
    { abstract: "General outcomes." },
  ),
  s(
    "vacinas-no-adulto",
    "generic_title_strong_abstract",
    "Prevention update",
    ["vacinas-no-adulto"],
    { abstract: "Adult vaccination was recommended." },
  ),
  s("vacinas-no-adulto", "drug_other_indication", "Semaglutide for obesity", [
    "obesidade-e-incretinas",
  ]),

  s("hepatologia", "title_positive", "Liver cirrhosis management", ["hepatologia"]),
  s("hepatologia", "obvious_negative", "Transient liver enzyme measurement", []),
  s("hepatologia", "ambiguous_isolated", "MASH and NASH update", [], {}, true),
  s("hepatologia", "multitopic", "Type 2 diabetes in chronic liver disease", [
    "hepatologia",
    "diabetes",
  ]),
  s("hepatologia", "no_abstract", "Cirrose hepática descompensada", ["hepatologia"], {
    abstract: null,
  }),
  s("hepatologia", "strong_title_weak_abstract", "Hepatic fibrosis therapy", ["hepatologia"], {
    abstract: "General outcomes.",
  }),
  s("hepatologia", "generic_title_strong_abstract", "Specialty cohort", ["hepatologia"], {
    abstract: "Patients had hepatocellular carcinoma.",
  }),
  s("hepatologia", "drug_other_indication", "Semaglutide for type 2 diabetes", ["diabetes"]),
];
