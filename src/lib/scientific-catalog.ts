/** Canonical V1 identities. UUID is persistence identity; slug is a stable human-readable key. */
export interface CatalogSpecialty {
  id: string;
  slug: string;
  name: string;
}
export interface CatalogTopic {
  id: string;
  slug: string;
  name: string;
  specialtyId: string | null;
}
export interface ScientificCatalog {
  specialties: CatalogSpecialty[];
  topics: CatalogTopic[];
}

export const SPECIALTY_V1 = [
  ["31000000-0000-4000-8000-000000000001", "cardiologia", "Cardiologia"],
  ["31000000-0000-4000-8000-000000000002", "endocrinologia", "Endocrinologia"],
  ["31000000-0000-4000-8000-000000000003", "nefrologia", "Nefrologia"],
  ["31000000-0000-4000-8000-000000000004", "infectologia", "Infectologia"],
  ["31000000-0000-4000-8000-000000000005", "pneumologia", "Pneumologia"],
  ["31000000-0000-4000-8000-000000000006", "hepatologia", "Hepatologia"],
  ["31000000-0000-4000-8000-000000000007", "medicina-interna", "Medicina Interna"],
  ["31000000-0000-4000-8000-000000000008", "medicina-intensiva", "Medicina Intensiva"],
  ["31000000-0000-4000-8000-000000000009", "geriatria", "Geriatria"],
  ["31000000-0000-4000-8000-000000000010", "neurologia", "Neurologia"],
] as const;

const specialtyId = (slug: string) => SPECIALTY_V1.find((x) => x[1] === slug)?.[0] ?? null;
export const TOPIC_V1 = [
  [
    "32000000-0000-4000-8000-000000000001",
    "insuficiencia-cardiaca",
    "Insuficiência cardíaca",
    specialtyId("cardiologia"),
  ],
  [
    "32000000-0000-4000-8000-000000000002",
    "obesidade-e-incretinas",
    "Obesidade e incretinas",
    specialtyId("endocrinologia"),
  ],
  [
    "32000000-0000-4000-8000-000000000003",
    "fibrilacao-atrial",
    "Fibrilação atrial",
    specialtyId("cardiologia"),
  ],
  [
    "32000000-0000-4000-8000-000000000004",
    "doenca-renal-cronica",
    "Doença renal crônica",
    specialtyId("nefrologia"),
  ],
  [
    "32000000-0000-4000-8000-000000000005",
    "prevencao-cardiovascular",
    "Prevenção cardiovascular",
    null,
  ],
  ["32000000-0000-4000-8000-000000000006", "diabetes", "Diabetes", specialtyId("endocrinologia")],
  ["32000000-0000-4000-8000-000000000007", "sepse-e-antibioticos", "Sepse e antibióticos", null],
  ["32000000-0000-4000-8000-000000000008", "lipidios", "Lipídios", null],
  ["32000000-0000-4000-8000-000000000009", "hipertensao", "Hipertensão", null],
  [
    "32000000-0000-4000-8000-000000000010",
    "doenca-coronariana",
    "Doença coronariana",
    specialtyId("cardiologia"),
  ],
  ["32000000-0000-4000-8000-000000000011", "vacinas-no-adulto", "Vacinas no adulto", null],
  [
    "32000000-0000-4000-8000-000000000012",
    "hepatologia",
    "Hepatologia",
    specialtyId("hepatologia"),
  ],
] as const;

export const LEGACY_SPECIALTY_SLUGS = Object.freeze(
  Object.fromEntries(SPECIALTY_V1.map(([, slug, name]) => [name, slug])),
) as Readonly<Record<string, string>>;
export const LEGACY_TOPIC_SLUGS = Object.freeze(
  Object.fromEntries(TOPIC_V1.map(([, slug, name]) => [name, slug])),
) as Readonly<Record<string, string>>;
export const legacySpecialtySlug = (label: string) => LEGACY_SPECIALTY_SLUGS[label];
export const legacyTopicSlug = (label: string) => LEGACY_TOPIC_SLUGS[label];

export type CanonicalStudyType = "randomized_trial" | "meta_analysis" | "guideline" | "cohort";
const STUDY_TYPE_MAP: Readonly<Record<string, CanonicalStudyType>> = Object.freeze({
  RCT: "randomized_trial",
  "Meta-análise": "meta_analysis",
  Guideline: "guideline",
  Coorte: "cohort",
});
export const legacyStudyType = (label: string): CanonicalStudyType | undefined =>
  STUDY_TYPE_MAP[label];
