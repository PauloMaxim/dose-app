import { contextualScientificMaterialSchema } from "./contracts";

const articleId = "pmid:42717033";

export const PMID_42717033_CONTEXT_REFERENCE_IDS = [
  "fda:ddtcoa-000084:qualification:2020-04-09",
  "pubmed:3978515",
] as const;

/**
 * Manual, human-reviewed context authorized only for the controlled PMID 42717033 experiment.
 * These external references are not Scientific Facts of the Mitiperstat article. The repository
 * has no automatic context acquisition; allowlisting these auditable IDs authorizes only this run.
 */
export const pmid42717033ContextualMaterial = [
  contextualScientificMaterialSchema.parse({
    schemaVersion: "contextual-scientific-material.v2",
    id: "context:pmid:42717033:kccq-tss:v1",
    articleId,
    claims: [
      {
        id: "context:pmid:42717033:kccq-tss-description",
        statement:
          "The KCCQ Total Symptom Score is a patient-reported outcome measure of symptom experience in heart failure, covering symptom frequency and symptom burden/bothersomeness.",
        provenance: {
          sourceDocumentIds: [],
          evidenceAnchorIds: [],
          externalContextReferenceIds: [PMID_42717033_CONTEXT_REFERENCE_IDS[0]],
        },
      },
    ],
  }),
  contextualScientificMaterialSchema.parse({
    schemaVersion: "contextual-scientific-material.v2",
    id: "context:pmid:42717033:six-minute-walk:v1",
    articleId,
    claims: [
      {
        id: "context:pmid:42717033:six-minute-walk-description",
        statement:
          "The six-minute walk test is an objective measure of exercise capacity and a useful measure of functional exercise capacity in patients with chronic heart failure.",
        provenance: {
          sourceDocumentIds: [],
          evidenceAnchorIds: [],
          externalContextReferenceIds: [PMID_42717033_CONTEXT_REFERENCE_IDS[1]],
        },
      },
    ],
  }),
] as const;

export const pmid42717033AuthorizedExternalContextReferenceIds = [
  ...PMID_42717033_CONTEXT_REFERENCE_IDS,
];
