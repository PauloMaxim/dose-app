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
    deck: "Um ensaio clínico de fase 2b testou se bloquear a mieloperoxidase poderia melhorar manifestações clínicas da doença. Em 711 pacientes, o tratamento não apresentou benefício nos dois principais desfechos avaliados.",
    openingSummary: [
      {
        id: "opening-population",
        text: "O estudo incluiu pessoas com insuficiência cardíaca e fração de ejeção acima de 40%, abrangendo a apresentação preservada ou levemente reduzida. O racional investigado olha além da medida da contração cardíaca: ele se concentra em uma via biológica que os autores relacionam aos sintomas e à limitação funcional nessa população.",
        factIds: requireFacts([
          fid("condition"),
          fid("ef-eligibility"),
          fid("endpoint-kccq"),
          fid("endpoint-6mwd"),
        ]),
      },
      {
        id: "opening-rationale",
        text: "O encadeamento proposto começa na mieloperoxidase, ou MPO: oxidantes derivados dessa enzima podem reduzir a disponibilidade de óxido nítrico e favorecer disfunção microvascular coronariana, rigidez dos cardiomiócitos e fibrose intersticial. Esse é o racional mecanístico apresentado pelos autores, não uma cadeia causal clínica já comprovada. A pergunta que conduz o ensaio é direta: se a atividade da MPO for inibida, os pacientes podem apresentar menos sintomas e melhor capacidade de exercício?",
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
              "A MPO é uma enzima relacionada à produção de oxidantes. No modelo apresentado pelos autores, o percurso de interesse pode ser lido assim: MPO → oxidantes derivados da MPO → menor disponibilidade de óxido nítrico.",
              "A menor disponibilidade de óxido nítrico aparece, nesse racional, ao lado de alterações potencialmente relevantes para a doença: disfunção microvascular coronariana, rigidez dos cardiomiócitos e fibrose intersticial. O abstract descreve essas relações como mecanismos implicados na fisiopatologia; ele não demonstra que essa sequência seja, por si só, uma causa clínica comprovada dos sintomas.",
              "Essa distinção é central. Uma via biologicamente plausível pode justificar um experimento, mas ainda é necessário testar se modificá-la produz uma diferença que o paciente perceba ou que possa ser medida funcionalmente.",
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
              "Mitiperstat é o medicamento investigado neste estudo. Ele atua como inibidor da MPO e foi usado para colocar o racional biológico à prova, não simplesmente como um tratamento dirigido ao alívio imediato de um sintoma.",
              "A estratégia pode ser resumida em duas etapas. Primeiro, o modelo dos autores: MPO → oxidantes → alterações associadas à doença. Depois, a hipótese experimental: inibir a MPO → tentar reduzir essas alterações → verificar se sintomas e capacidade funcional melhoram.",
              "O ensaio, portanto, não presumiu que bloquear a enzima necessariamente produziria benefício. Ele mediu se a interferência nessa via se traduziria em resultados clínicos observáveis.",
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
            id: "design-prose",
            kind: "prose" as const,
            paragraphs: [
              "O ensaio foi multicêntrico, randomizado, duplo-cego, controlado por placebo e conduzido em três grupos paralelos. Era um estudo de fase 2b: uma etapa voltada a explorar se o sinal biológico se converte em eficácia clínica e a observar segurança antes de decisões sobre investigações posteriores.",
              "Participaram 711 pacientes com insuficiência cardíaca e fração de ejeção acima de 40%; 45% eram mulheres. A randomização foi feita na proporção 1:1:1 entre mitiperstat 2,5 mg, mitiperstat 5 mg e placebo. O abstract não informa quantos participantes ficaram em cada braço, portanto esta Dose não estima esses números.",
              "O tratamento foi planejado para 48 semanas. Os dois desfechos coprimários — sintomas pelo KCCQ-TSS e capacidade funcional pela caminhada de seis minutos — foram avaliados em 16 semanas.",
            ],
            factIds: requireFacts([
              fid("design-multicenter"),
              fid("design-randomized"),
              fid("design-blinding"),
              fid("design-placebo"),
              fid("design-parallel"),
              fid("design-phase"),
              fid("sample-size"),
              fid("ef-eligibility"),
              fid("women"),
              fid("allocation"),
              fid("arm-low-dose"),
              fid("arm-high-dose"),
              fid("arm-placebo"),
              fid("treatment-duration"),
              fid("endpoint-kccq"),
              fid("endpoint-6mwd"),
            ]),
          },
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
              "Os dois desfechos coprimários medidos em 16 semanas olham para dimensões diferentes e complementares. O KCCQ-TSS é a pontuação total de sintomas do Kansas City Cardiomyopathy Questionnaire: ela organiza o relato do paciente sobre frequência e impacto dos sintomas da insuficiência cardíaca.",
              "A distância percorrida em seis minutos, ou 6MWD, é uma medida padronizada de capacidade funcional. Em vez de perguntar apenas como a pessoa se sente, ela registra quanto consegue caminhar durante um intervalo definido.",
              "Em conjunto, os desfechos permitiam perguntar tanto se o paciente se sentia melhor quanto se apresentava melhora mensurável da capacidade de exercício.",
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
              "A diferença média corrigida por placebo foi de −1,4 ponto: a estimativa pontual não favoreceu o mitiperstat. O IC95% foi de −3,9 a 1,2 e inclui zero, portanto o estudo não demonstrou benefício estatisticamente significativo nesse desfecho. O valor de P = 0,29 também não atingiu o limiar convencional de significância; ele não mede importância clínica e não prova ausência absoluta de efeito. Por isso, −1,4 não deve ser interpretado sem o intervalo que expressa sua incerteza.",
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
              "A estimativa pontual foi positiva: +3,8 m para as doses agrupadas de mitiperstat contra placebo. Isoladamente, porém, esse número seria uma leitura inadequada. O IC95% vai de −3,1 a 10,8 m e atravessa zero; dentro da incerteza estimada, os dados são compatíveis com pequena melhora, ausência de efeito ou pequena piora. Com P = 0,28, não houve demonstração de diferença estatisticamente significativa.",
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
              "O abstract relata que o mitiperstat não melhorou nenhum dos desfechos secundários. Essa é a extensão do que a fonte disponível permite afirmar.",
              "Sem os resultados numéricos detalhados de cada desfecho, esta Dose não pode comparar magnitudes, intervalos de confiança ou diferenças entre doses, nem acrescentar nomes de resultados que não estão representados na fonte estruturada.",
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
              "Para os principais objetivos clínicos deste estudo, não houve benefício demonstrado. Em 16 semanas, as doses de mitiperstat analisadas em conjunto não melhoraram os sintomas medidos pelo KCCQ-TSS nem a capacidade de exercício medida pela caminhada de seis minutos em comparação com placebo.",
              "A hipótese biológica era plausível o suficiente para ser testada, mas, neste ensaio de fase 2b, bloquear a MPO com mitiperstat não se traduziu em melhora dos resultados clínicos avaliados.",
              "Essa conclusão é específica. Ela não demonstra equivalência entre os grupos, não prova ausência absoluta de efeito, não estabelece ineficácia universal do medicamento e não refuta toda a biologia relacionada à MPO.",
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
              "O estudo acrescenta uma resposta clínica delimitada a uma hipótese mecanística: interferir nessa via com este medicamento, nessas doses e segundo estes desfechos não gerou o benefício esperado.",
              "Isso não significa automaticamente que a MPO não participe da fisiopatologia ou que toda futura estratégia contra essa via falhará. Significa que plausibilidade biológica e benefício clínico não são sinônimos — e que, nas condições testadas, a tradução clínica não foi demonstrada.",
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
