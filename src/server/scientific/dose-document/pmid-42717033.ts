import type { ScientificArticleDetail } from "../article-detail";
import { pmid42717033ScientificFacts } from "../knowledge-representation/pmid-42717033.fixture";
import { doseDocumentSchema, type DoseDocument } from "./contracts";

const articleId = "pmid:42717033";
const fid = (suffix: string) => `${articleId}:${suffix}`;

function requireFacts(ids: string[]) {
  const available = new Set(pmid42717033ScientificFacts.map((fact) => fact.id));
  for (const id of ids)
    if (!available.has(id)) throw new Error(`DoseDocument references unknown fact: ${id}`);
  return ids;
}

/** A deterministic editorial projection. Scientific facts remain unchanged and are linked by id. */
export function createPmid42717033DoseDocument(
  metadata: Pick<ScientificArticleDetail, "title" | "doi">,
): DoseDocument {
  const document = {
    schemaVersion: "dose-document.v1" as const,
    id: "dose:pmid:42717033:pt-BR:v1",
    articleId,
    language: "pt-BR" as const,
    label: "Edição editorial Dose" as const,
    headline:
      "Mitiperstat não melhorou sintomas nem capacidade de exercício na insuficiência cardíaca com fração de ejeção preservada ou levemente reduzida",
    deck: "Um ensaio clínico fase 2b testou se bloquear a MPO poderia melhorar manifestações clínicas da insuficiência cardíaca. Entre 711 pacientes, as duas doses de mitiperstat, analisadas em conjunto, não mostraram benefício nos dois principais desfechos em 16 semanas.",
    openingSummary: [
      {
        id: "opening-population",
        text: "O estudo incluiu pessoas com insuficiência cardíaca e fração de ejeção acima de 40%, abrangendo a apresentação preservada ou levemente reduzida. A pergunta clínica era se sintomas e capacidade de exercício poderiam melhorar com a intervenção.",
        factIds: requireFacts([
          fid("condition"),
          fid("ef-eligibility"),
          fid("endpoint-kccq"),
          fid("endpoint-6mwd"),
        ]),
      },
      {
        id: "opening-rationale",
        text: "Os autores partiram de um racional biológico: oxidantes derivados da mieloperoxidase, ou MPO, podem reduzir a disponibilidade de óxido nítrico e favorecer disfunção microvascular coronariana, rigidez dos cardiomiócitos e fibrose intersticial. O ensaio perguntou se interferir nessa via com mitiperstat se traduziria em melhora clínica — uma hipótese, não uma causalidade clínica já demonstrada.",
        factIds: requireFacts([
          fid("mpo-oxidants"),
          fid("mpo-no"),
          fid("mpo-microvascular"),
          fid("mpo-stiffening"),
          fid("mpo-fibrosis"),
          fid("mitiperstat-mpo"),
        ]),
      },
    ],
    chapters: [
      {
        id: "chapter-rationale",
        title: "Por que estudar a MPO na insuficiência cardíaca?",
        blocks: [
          {
            id: "rationale-prose",
            kind: "prose" as const,
            paragraphs: [
              "A MPO é uma enzima relacionada à produção de oxidantes. No racional apresentado pelos autores, esses oxidantes podem diminuir a disponibilidade de óxido nítrico e favorecer alterações microvasculares, rigidez das células musculares cardíacas e fibrose. Essas relações tornam a via uma candidata a estudo; por si só, não provam que bloqueá-la melhorará os pacientes.",
            ],
            factIds: requireFacts([
              fid("mpo-oxidants"),
              fid("mpo-no"),
              fid("mpo-microvascular"),
              fid("mpo-stiffening"),
              fid("mpo-fibrosis"),
            ]),
          },
        ],
      },
      {
        id: "chapter-treatment",
        title: "O que é o mitiperstat?",
        blocks: [
          {
            id: "treatment-prose",
            kind: "prose" as const,
            paragraphs: [
              "Mitiperstat é o medicamento investigado neste estudo e atua como inibidor da MPO. A proposta do ensaio foi testar se interferir nessa via biológica poderia produzir melhora perceptível nos sintomas e na função de exercício.",
            ],
            factIds: requireFacts([
              fid("mitiperstat-mpo"),
              fid("endpoint-kccq"),
              fid("endpoint-6mwd"),
            ]),
          },
        ],
      },
      {
        id: "chapter-design",
        title: "Como o estudo foi feito?",
        blocks: [
          {
            id: "design-flow",
            kind: "study_design" as const,
            label: "Diagrama editorial Dose, derivado dos fatos do abstract",
            steps: [
              { id: "participants", label: "711 pacientes" },
              { id: "allocation", label: "randomização 1:1:1" },
              { id: "arms", label: "Mitiperstat 2,5 mg · Mitiperstat 5 mg · Placebo" },
              { id: "duration", label: "48 semanas de tratamento" },
              { id: "timepoint", label: "principais desfechos em 16 semanas" },
            ],
            factIds: requireFacts([
              fid("sample-size"),
              fid("allocation"),
              fid("arm-low-dose"),
              fid("arm-high-dose"),
              fid("arm-placebo"),
              fid("treatment-duration"),
              fid("endpoint-kccq"),
              fid("endpoint-6mwd"),
            ]),
          },
        ],
      },
      {
        id: "chapter-endpoints",
        title: "O que os pesquisadores queriam melhorar?",
        blocks: [
          {
            id: "endpoints-prose",
            kind: "prose" as const,
            paragraphs: [
              "Os dois desfechos principais medidos em 16 semanas foram o KCCQ-TSS, uma pontuação sobre frequência e impacto dos sintomas de insuficiência cardíaca relatados pelo paciente, e a distância percorrida em seis minutos (6MWD), uma medida prática de capacidade funcional.",
            ],
            factIds: requireFacts([fid("endpoint-kccq"), fid("endpoint-6mwd")]),
          },
        ],
      },
      {
        id: "chapter-symptoms",
        title: "O que aconteceu com os sintomas?",
        blocks: [
          {
            id: "result-kccq",
            kind: "result" as const,
            endpoint: "KCCQ-TSS",
            estimate: "−1,4 ponto",
            confidenceInterval: "IC95% −3,9 a 1,2",
            pValue: "P = 0,29",
            comparison: "Duas doses de mitiperstat agrupadas, contra placebo",
            timepoint: "16 semanas",
            interpretation:
              "O intervalo de confiança inclui zero e o resultado não demonstrou diferença estatisticamente significativa. A estimativa pontual não deve ser lida sem sua incerteza.",
            factIds: requireFacts([fid("result-kccq")]),
          },
        ],
      },
      {
        id: "chapter-exercise",
        title: "E a capacidade de exercício?",
        blocks: [
          {
            id: "result-6mwd",
            kind: "result" as const,
            endpoint: "Caminhada de 6 minutos (6MWD)",
            estimate: "+3,8 m",
            confidenceInterval: "IC95% −3,1 a 10,8",
            pValue: "P = 0,28",
            comparison: "Duas doses de mitiperstat agrupadas, contra placebo",
            timepoint: "16 semanas",
            interpretation:
              "Também aqui, o intervalo inclui zero e não houve diferença estatisticamente significativa demonstrada.",
            factIds: requireFacts([fid("result-6mwd")]),
          },
        ],
      },
      {
        id: "chapter-secondary",
        title: "E os outros resultados?",
        blocks: [
          {
            id: "secondary-prose",
            kind: "prose" as const,
            paragraphs: [
              "Segundo o abstract, o mitiperstat também não melhorou nenhum desfecho secundário. Como a fonte disponível não traz os resultados detalhados de cada um, esta Dose não os quantifica nem os interpreta separadamente.",
            ],
            factIds: requireFacts([fid("result-kccq"), fid("result-6mwd")]),
          },
        ],
      },
      {
        id: "chapter-safety",
        title: "O tratamento pareceu seguro?",
        blocks: [
          {
            id: "safety-summary",
            kind: "safety" as const,
            summary:
              "Eventos adversos e eventos adversos graves, incluindo infecções, foram semelhantes entre os grupos segundo o abstract.",
            events: [
              { id: "rash-treatment", label: "Rash maculopapular · mitiperstat", value: "3,6%" },
              { id: "rash-placebo", label: "Rash maculopapular · placebo", value: "0,4%" },
            ],
            caveat: "O abstract não informa denominadores nem gravidade para esse evento.",
            factIds: requireFacts([
              fid("safety-general"),
              fid("rash-mitiperstat"),
              fid("rash-placebo"),
            ]),
          },
        ],
      },
      {
        id: "chapter-conclusion",
        title: "Então, o mitiperstat funcionou?",
        blocks: [
          {
            id: "conclusion-prose",
            kind: "prose" as const,
            paragraphs: [
              "Nos dois desfechos principais e no momento avaliados, o estudo não demonstrou benefício clínico do mitiperstat em comparação com placebo. Isso não estabelece equivalência, ausência absoluta de efeito ou ineficácia em toda população e contexto possíveis.",
            ],
            factIds: requireFacts([fid("result-kccq"), fid("result-6mwd")]),
          },
        ],
      },
      {
        id: "chapter-contribution",
        title: "O que este estudo acrescenta?",
        blocks: [
          {
            id: "contribution-prose",
            kind: "prose" as const,
            paragraphs: [
              "Na população estudada, nas doses avaliadas e nos desfechos definidos pelo ensaio, a inibição da MPO com mitiperstat não produziu benefício clínico demonstrável.",
              "O resultado não significa automaticamente que a MPO não participe da fisiopatologia nem que qualquer estratégia futura contra essa via falhará.",
            ],
            factIds: requireFacts([
              fid("mitiperstat-mpo"),
              fid("arm-low-dose"),
              fid("arm-high-dose"),
              fid("result-kccq"),
              fid("result-6mwd"),
            ]),
          },
        ],
      },
    ],
    keyNumbers: [
      {
        id: "number-participants",
        value: "711",
        label: "pacientes",
        context: "randomizados em três grupos",
        factIds: requireFacts([fid("sample-size")]),
      },
      {
        id: "number-kccq",
        value: "−1,4",
        label: "ponto no KCCQ-TSS",
        context: "doses agrupadas contra placebo, em 16 semanas",
        factIds: requireFacts([fid("result-kccq")]),
      },
      {
        id: "number-walk",
        value: "+3,8 m",
        label: "na caminhada de 6 minutos",
        context: "doses agrupadas contra placebo, em 16 semanas",
        factIds: requireFacts([fid("result-6mwd")]),
      },
    ],
    contextualExplainers: [
      {
        id: "explainer-mpo",
        title: "O que é MPO?",
        body: "Mieloperoxidase é uma enzima relacionada à produção de oxidantes. Neste paper, ela integra uma hipótese mecanística para alterações relevantes na insuficiência cardíaca.",
        factIds: requireFacts([fid("mpo-oxidants")]),
      },
      {
        id: "explainer-drug",
        title: "Como o mitiperstat age?",
        body: "É um inibidor da MPO. O estudo avaliou se bloquear essa via produziria uma melhora clínica mensurável.",
        factIds: requireFacts([fid("mitiperstat-mpo")]),
      },
      {
        id: "explainer-kccq",
        title: "O que é KCCQ-TSS?",
        body: "É a pontuação total de sintomas do Kansas City Cardiomyopathy Questionnaire. Ela ajuda a medir, pela perspectiva do paciente, frequência e impacto dos sintomas.",
        factIds: requireFacts([fid("endpoint-kccq")]),
      },
      {
        id: "explainer-walk",
        title: "Por que usar caminhada de 6 minutos?",
        body: "A distância percorrida em seis minutos oferece uma medida funcional padronizada e próxima da capacidade de realizar esforço cotidiano.",
        factIds: requireFacts([fid("endpoint-6mwd")]),
      },
      {
        id: "explainer-ci",
        title: "Como interpretar IC95%?",
        body: "O intervalo expressa a incerteza ao redor da estimativa. Nos dois resultados, ele atravessa zero; portanto, os dados são compatíveis com efeitos em direções diferentes.",
        factIds: requireFacts([fid("result-kccq"), fid("result-6mwd")]),
      },
      {
        id: "explainer-p",
        title: "O que significa P = 0,29 neste resultado?",
        body: "Neste teste, o valor não atingiu o limiar convencional de significância estatística. Ele não mede a importância clínica e não prova ausência absoluta de efeito.",
        factIds: requireFacts([fid("result-kccq")]),
      },
      {
        id: "explainer-phase",
        title: "O que significa fase 2b?",
        body: "É uma etapa de desenvolvimento que explora eficácia clínica e segurança para orientar decisões sobre estudos posteriores; não equivale a uma confirmação definitiva de benefício.",
        factIds: requireFacts([fid("design-phase")]),
      },
    ],
    sourceCoverage: {
      id: "source-coverage",
      basedOn: ["metadata", "abstract"] as Array<"metadata" | "abstract">,
      notCovered: [
        "critérios completos",
        "métodos estatísticos completos",
        "resultados detalhados por dose",
        "subgrupos",
        "limitações completas",
        "discussão completa",
      ],
      statement:
        "Esta Dose usa metadata bibliográfica e o abstract. Ela não representa uma leitura integral do paper.",
    },
    sourceReferences: [
      {
        id: "source-pubmed",
        kind: "pubmed" as const,
        label: "PubMed",
        value: "PMID 42717033",
        url: "https://pubmed.ncbi.nlm.nih.gov/42717033/",
      },
      {
        id: "source-registry",
        kind: "registry" as const,
        label: "ClinicalTrials.gov",
        value: "NCT04986202",
        url: "https://clinicaltrials.gov/study/NCT04986202",
      },
      ...(metadata.doi
        ? [
            {
              id: "source-doi",
              kind: "doi" as const,
              label: "DOI",
              value: metadata.doi,
              url: `https://doi.org/${metadata.doi}`,
            },
          ]
        : []),
    ],
  };

  // Metadata is carried by the article model; retaining the original title there avoids
  // turning bibliographic source text into editorial prose inside this document.
  void metadata.title;
  return doseDocumentSchema.parse(document);
}

const factories: Record<string, (article: ScientificArticleDetail) => DoseDocument> = {
  "42717033": createPmid42717033DoseDocument,
};

export function resolveDoseDocument(article: ScientificArticleDetail): DoseDocument | null {
  return article.pmid ? (factories[article.pmid]?.(article) ?? null) : null;
}
