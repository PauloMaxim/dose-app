import { scientificEditorialDraftSchema } from "./contracts";
import {
  pmid42717033EvidenceSet,
  pmid42717033FactSet,
  pmid42717033Interpretation,
  pmid42717033SourceSet,
} from "../knowledge-representation/pmid-42717033.fixture";

const article = "pmid:42717033";
const fact = (id: string) => `${article}:${id}`;
const anchor = (id: string) => `${article}:abstract:${id}`;
const source = `${article}:abstract:v1`;
const empty = {
  factIds: [] as string[],
  interpretationClaimIds: [] as string[],
  evidenceAnchorIds: [] as string[],
  sourceDocumentIds: [] as string[],
  externalContextReferenceIds: [] as string[],
};
const grounded = (factIds: string[], evidenceAnchorIds: string[]) => ({
  ...empty,
  factIds,
  evidenceAnchorIds,
  sourceDocumentIds: [source],
});

/** Recorded fake-provider response. It uses only the canary's authorized article artifacts. */
export const pmid42717033ExperimentalDraft = scientificEditorialDraftSchema.parse({
  schemaVersion: "scientific-editorial-draft.v1",
  id: "editorial:pmid:42717033:pt-BR:experiment-v1",
  articleId: article,
  language: "pt-BR",
  inputLineage: {
    sourceSetId: pmid42717033SourceSet.id,
    evidenceSetId: pmid42717033EvidenceSet.id,
    factSetId: pmid42717033FactSet.id,
    interpretationArtifactId: pmid42717033Interpretation.id,
  },
  blocks: [
    {
      id: "experimental-headline",
      kind: "headline",
      disclosureLayer: "opening",
      claims: [
        {
          id: "headline-claim",
          text: "Bloquear a MPO não melhorou os dois desfechos coprimários avaliados neste ensaio",
          statementKind: "deterministic_interpretation",
          grounding: {
            ...grounded([fact("result-kccq"), fact("result-6mwd")], [anchor("results")]),
            interpretationClaimIds: [`${article}:interpretation:coprimary-results`],
          },
          epistemicStatus: "observed_clinical_result",
          conclusionIds: ["bounded-coprimary-result"],
        },
      ],
    },
    {
      id: "experimental-deck",
      kind: "deck",
      disclosureLayer: "opening",
      claims: [
        {
          id: "deck-claim",
          text: "A hipótese era biologicamente plausível; o teste clínico, porém, não mostrou melhora de sintomas ou capacidade de exercício na população e no horizonte avaliados.",
          statementKind: "deterministic_interpretation",
          grounding: {
            ...grounded(
              [fact("mitiperstat-mpo"), fact("result-kccq"), fact("result-6mwd")],
              [anchor("mechanism"), anchor("results")],
            ),
            interpretationClaimIds: [`${article}:interpretation:coprimary-results`],
          },
          epistemicStatus: "causality_not_demonstrated",
          conclusionIds: ["bounded-coprimary-result"],
        },
      ],
    },
    {
      id: "experimental-mechanism",
      kind: "mechanistic_context",
      disclosureLayer: "deep_dive",
      title: "Do racional biológico ao teste clínico",
      claims: [
        {
          id: "mechanism-chain",
          text: "No mecanismo proposto pelos autores, a MPO origina oxidantes, que reduzem a disponibilidade de óxido nítrico e promovem disfunção microvascular coronariana, rigidez dos cardiomiócitos e fibrose intersticial.",
          statementKind: "article_supported_fact",
          grounding: grounded(
            [
              fact("mpo-oxidants"),
              fact("mpo-no"),
              fact("mpo-microvascular"),
              fact("mpo-stiffening"),
              fact("mpo-fibrosis"),
            ],
            [anchor("mechanism")],
          ),
          epistemicStatus: "proposed_mechanism",
          conclusionIds: [],
        },
        {
          id: "mechanism-boundary",
          text: "Essa cadeia oferece um racional para o experimento, mas não demonstra que modificar a via produza benefício clínico.",
          statementKind: "deterministic_interpretation",
          grounding: grounded([fact("mitiperstat-mpo"), fact("mpo-no")], [anchor("mechanism")]),
          epistemicStatus: "causality_not_demonstrated",
          conclusionIds: ["mechanism-is-not-clinical-causality"],
        },
      ],
    },
    {
      id: "experimental-question",
      kind: "research_question",
      disclosureLayer: "opening",
      title: "A pergunta científica",
      claims: [
        {
          id: "question-claim",
          text: "A inibição da MPO com mitiperstat, comparada ao placebo, melhora sintomas e função de exercício mensurados pelos desfechos coprimários?",
          statementKind: "article_supported_fact",
          grounding: grounded(
            [
              fact("mitiperstat-mpo"),
              fact("arm-placebo"),
              fact("endpoint-kccq"),
              fact("endpoint-6mwd"),
            ],
            [anchor("design")],
          ),
          epistemicStatus: "hypothesis",
          conclusionIds: [],
        },
      ],
    },
    {
      id: "experimental-design",
      kind: "study_design",
      disclosureLayer: "core",
      title: "Como a hipótese foi colocada à prova",
      claims: [
        {
          id: "design-claim",
          text: "O ensaio foi multicêntrico, randomizado, duplo-cego, controlado por placebo e organizado em grupos paralelos.",
          statementKind: "article_supported_fact",
          grounding: grounded(
            [
              fact("design-multicenter"),
              fact("design-randomized"),
              fact("design-blinding"),
              fact("design-placebo"),
              fact("design-parallel"),
            ],
            [anchor("design")],
          ),
          conclusionIds: [],
        },
      ],
    },
    {
      id: "experimental-population",
      kind: "population",
      disclosureLayer: "core",
      title: "Quem participou",
      claims: [
        {
          id: "population-size",
          text: "Foram randomizadas centenas de pessoas, e mulheres representaram pouco menos da metade da população.",
          statementKind: "article_supported_fact",
          grounding: grounded([fact("sample-size"), fact("women")], [anchor("population")]),
          conclusionIds: [],
        },
        {
          id: "population-condition",
          text: "A população tinha insuficiência cardíaca com fração de ejeção preservada ou levemente reduzida.",
          statementKind: "article_supported_fact",
          grounding: grounded([fact("condition")], [anchor("design")]),
          conclusionIds: [],
        },
      ],
    },
    {
      id: "experimental-endpoints",
      kind: "endpoint_explanation",
      disclosureLayer: "core",
      title: "Duas dimensões da hipótese clínica",
      claims: [
        {
          id: "endpoint-claim",
          text: "O estudo combinou um escore de sintomas, o KCCQ-TSS, com a distância de caminhada, uma medida de função de exercício. Ambos foram coprimários e avaliados em 16 semanas.",
          statementKind: "article_supported_fact",
          grounding: grounded([fact("endpoint-kccq"), fact("endpoint-6mwd")], [anchor("design")]),
          conclusionIds: [],
          quantitativeClaims: [
            { value: 16, unit: "week", factId: fact("endpoint-kccq") },
            { value: 16, unit: "week", factId: fact("endpoint-6mwd") },
          ],
        },
      ],
    },
    {
      id: "experimental-results",
      kind: "primary_result",
      disclosureLayer: "core",
      title: "O que os resultados mostram",
      claims: [
        {
          id: "kccq-result",
          text: "No KCCQ-TSS, a diferença média corrigida pelo placebo foi de -1,4 ponto; o intervalo de confiança cruzou zero.",
          statementKind: "article_supported_fact",
          grounding: grounded([fact("result-kccq")], [anchor("results")]),
          epistemicStatus: "observed_clinical_result",
          conclusionIds: ["bounded-coprimary-result"],
          quantitativeClaims: [{ value: -1.4, unit: "point", factId: fact("result-kccq") }],
        },
        {
          id: "walk-result",
          text: "Na caminhada, a diferença foi de 3,8 m; novamente, o intervalo de confiança cruzou zero.",
          statementKind: "article_supported_fact",
          grounding: grounded([fact("result-6mwd")], [anchor("results")]),
          epistemicStatus: "observed_clinical_result",
          conclusionIds: ["bounded-coprimary-result"],
          quantitativeClaims: [{ value: 3.8, unit: "m", factId: fact("result-6mwd") }],
        },
      ],
    },
    {
      id: "experimental-interpretation",
      kind: "interpretation",
      disclosureLayer: "deep_dive",
      title: "Como ler a incerteza",
      claims: [
        {
          id: "ci-interpretation",
          text: "Os intervalos de confiança dos dois resultados incluem zero. Assim, as estimativas não sustentam melhora nos desfechos coprimários, mas também não autorizam concluir equivalência entre tratamento e placebo.",
          statementKind: "deterministic_interpretation",
          grounding: {
            ...grounded([fact("result-kccq"), fact("result-6mwd")], [anchor("results")]),
            interpretationClaimIds: [`${article}:interpretation:coprimary-results`],
          },
          epistemicStatus: "causality_not_demonstrated",
          conclusionIds: ["bounded-coprimary-result"],
        },
      ],
    },
    {
      id: "experimental-addition",
      kind: "what_this_adds",
      disclosureLayer: "deep_dive",
      title: "O que este estudo acrescenta",
      claims: [
        {
          id: "addition-claim",
          text: "O ensaio confronta uma cadeia mecanística proposta com desfechos de sintomas e função; nessa população e avaliação, plausibilidade biológica não se traduziu em melhora demonstrada.",
          statementKind: "deterministic_interpretation",
          grounding: {
            ...grounded(
              [
                fact("mpo-no"),
                fact("endpoint-kccq"),
                fact("endpoint-6mwd"),
                fact("result-kccq"),
                fact("result-6mwd"),
              ],
              [anchor("mechanism"), anchor("design"), anchor("results")],
            ),
            interpretationClaimIds: [`${article}:interpretation:coprimary-results`],
          },
          epistemicStatus: "causality_not_demonstrated",
          conclusionIds: ["mechanism-is-not-clinical-causality", "bounded-coprimary-result"],
        },
      ],
    },
    {
      id: "experimental-source-boundary",
      kind: "source_boundary",
      disclosureLayer: "deep_dive",
      title: "Limite da fonte",
      claims: [
        {
          id: "source-boundary-claim",
          text: "Esta narrativa usa somente o abstract autorizado; texto completo, tabelas, figuras e suplementos não foram revisados.",
          statementKind: "deterministic_interpretation",
          grounding: {
            ...grounded([fact("design-randomized")], []),
            interpretationClaimIds: [`${article}:interpretation:source-boundary`],
          },
          epistemicStatus: "source_coverage",
          conclusionIds: [],
        },
      ],
    },
  ],
  inferenceLimits: {
    supportedConclusions: [
      {
        id: "bounded-coprimary-result",
        statement: "Não houve melhora demonstrada nos desfechos coprimários avaliados.",
        factIds: [fact("result-kccq"), fact("result-6mwd")],
        interpretationClaimIds: [`${article}:interpretation:coprimary-results`],
        rule: "supported_by_inputs",
      },
      {
        id: "mechanism-is-not-clinical-causality",
        statement: "O mecanismo proposto não estabelece causalidade clínica.",
        factIds: [fact("mpo-no"), fact("mitiperstat-mpo")],
        interpretationClaimIds: [],
        rule: "do_not_infer_causality",
      },
    ],
    unsupportedConclusions: [
      {
        id: "equivalence",
        statement: "Intervenção e placebo são equivalentes.",
        factIds: [],
        interpretationClaimIds: [],
        rule: "do_not_infer_equivalence",
      },
      {
        id: "superiority",
        statement: "A intervenção é superior.",
        factIds: [],
        interpretationClaimIds: [],
        rule: "do_not_infer_superiority",
      },
      {
        id: "treatment-recommendation",
        statement: "O estudo autoriza recomendação terapêutica.",
        factIds: [],
        interpretationClaimIds: [],
        rule: "do_not_recommend_treatment",
      },
      {
        id: "full-text-reviewed",
        statement: "O texto completo foi revisado.",
        factIds: [],
        interpretationClaimIds: [],
        rule: "do_not_claim_full_text_review",
      },
    ],
  },
  requiresHumanReview: true,
  reviewStatus: "pending",
});
