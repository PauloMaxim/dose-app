import type { Article, Edition, Specialty, StudyType } from "./types";
import { addDaysIso, todayIso } from "./utils";

/** Flip to true to restore the previous edition covers (first-article stills). */
export const USE_ORIGINAL_EDITION_COVERS = false;

export const ARTICLE_TAGS: Record<string, string[]> = {
  summit: ["tirzepatida","HFpEF","incretina","KCCQ","Lilly","Packer","insuficiência cardíaca","IC","GLP-1","GIP","NEJMoa2410027","obesidade"],
  surmount: ["tirzepatida","semaglutida","SURMOUNT-5","obesidade","peso","Aronne","40353578","incretina","Ozempic","Mounjaro","Wegovy"],
  select: ["semaglutida","SELECT","MACE","obesidade","prevenção secundária","Lincoff","37952131","GLP-1","DAC"],
  flow: ["semaglutida","FLOW","DRC","TFG","Perkovic","rim","diabetes","GLP-1","albuminúria"],
  "empa-kidney": ["empagliflozina","EMPA-KIDNEY","SGLT2","DRC","36331190","rim"],
  "esc-af": ["fibrilação atrial","FA","ESC","guideline","CHA2DS2-VA","DOAC","ablação","EAST-AFNET","AF-CARE"],
  aspree: ["aspirina","AAS","ASPREE","prevenção primária","idoso","sangramento","30221597","McNeil"],
  "danger-shock": ["Impella","DANGER-SHOCK","choque cardiogênico","IAMCSST","bomba microaxial","38587239","UTI"],
  orbita2: ["ORBITA-2","ICP","stent","angina","placebo","sham","Rajkumar","37984346","ISCHEMIA"],
  mash: ["semaglutida","MASH","NASH","fígado","hepatologia","33185364","Newsome","fibrose"],
  sprint: ["SPRINT","hipertensão","pressão","120","26551272","PAS"],
  balance: ["BALANCE","antibiótico","bacteremia","7 dias","stewardship","Daneman","hemocultura"],
  clear: ["bempedoico","CLEAR Outcomes","estatina","intolerância","LDL","Nissen","36876740","gota","PCSK9"],
  rsv: ["RSV","vacina","idoso","AReSVi","37018468","Papi","pré-F","LRTD"],
};

function editionCover(number: number): string {
  return USE_ORIGINAL_EDITION_COVERS
    ? `/covers/original-editions/${number}.jpg`
    : `/covers/editions/${number}.jpg`;
}

export const SPECIALTIES: Specialty[] = [
  "Cardiologia",
  "Endocrinologia",
  "Nefrologia",
  "Infectologia",
  "Pneumologia",
  "Hepatologia",
  "Medicina Interna",
  "Medicina Intensiva",
  "Geriatria",
  "Neurologia"
];
export const TOPIC_OPTIONS = [
  "Insuficiência cardíaca",
  "Obesidade e incretinas",
  "Fibrilação atrial",
  "Doença renal crônica",
  "Prevenção cardiovascular",
  "Diabetes",
  "Sepse e antibióticos",
  "Lipídios",
  "Hipertensão",
  "Doença coronariana",
  "Vacinas no adulto",
  "Hepatologia"
];
export const ARTICLES: Article[] = [
  {
    id: "summit",
    title: "A balança agora pesa no ventrículo",
    subtitle: "Tirzepatida reduz desfechos em HFpEF com obesidade — SUMMIT",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Cardiologia",
    journal: "N Engl J Med",
    year: 2024,
    publishedAt: "2024-11-16",
    minutes: 8,
    cover: "/covers/summit.jpg",
    sourceUrl: "https://www.nejm.org/doi/full/10.1056/NEJMoa2410027",
    sourceLabel: "NEJM · SUMMIT",
    pmid: "39555826",
    confidence: "alta",
    learned: "em HFpEF com obesidade, tirzepatida não é só um emagrecedor: reduziu o composto de morte cardiovascular ou piora da IC (HR 0,62) e melhorou o KCCQ.",
    tldr: "Em 731 pacientes com HFpEF e obesidade, tirzepatida vs placebo por mediana de 104 semanas reduziu morte CV ou piora da IC (9,9% vs 15,3%; HR 0,62; IC95% 0,41–0,95) e melhorou qualidade de vida (+6,9 pontos no KCCQ-CSS em 52 semanas). O benefício foi puxado por menos descompensações, não por mortalidade isolada.",
    study: "SUMMIT foi um ensaio randomizado, duplo-cego, multicêntrico (Packer et al.). Pacientes com IC com fração de ejeção preservada e obesidade receberam tirzepatida (dose alvo 15 mg/semana) ou placebo. Desfecho primário hierárquico: composto de morte cardiovascular ou evento de piora da IC, e mudança no KCCQ-CSS. Acompanhou mediana de 104 semanas.",
    results: "Morte CV ou piora da IC: 36/364 (9,9%) vs 56/367 (15,3%), HR 0,62 (0,41–0,95), P=0,026. Eventos de piora da IC: HR 0,54 (0,34–0,85). Morte CV isolada não diferiu (HR 1,58; IC amplo). KCCQ-CSS: diferença de +6,9 pontos (3,3–10,6). Distância de 6 minutos: +18,3 m. Descontinuação por eventos adversos (principalmente GI) 6,3% vs 1,4%.",
    limitations: "Amostra moderada para mortalidade; IC da morte CV cruza 1. População selecionada (obesidade + HFpEF). Open-label de alguns desfechos de sintomas é mitigado pela adjudicação do composto, mas KCCQ é subjetivo. Financiamento da indústria (Lilly).",
    practice: "Em paciente com HFpEF e IMC elevado, incretina (tirzepatida; o STEP-HFpEF já havia sinalizado semaglutida) entra no rol de terapias que mudam trajetória — não só cintura. Continua-se a base (SGLT2, diurético, PA, FA). Não substitui investigação de amiloidose, HAP ou isquemia quando o fenótipo pedir. Checar cobertura, titulação GI e massa magra.",
    synopsis: "Os autores mostram que tirzepatida, em HFpEF com obesidade, reduz o risco de morte cardiovascular ou piora da insuficiência cardíaca e melhora o status de saúde medido pelo KCCQ, com o benefício concentrado nas descompensações."
  },
  {
    id: "surmount",
    title: "Dois agonistas, um pódio",
    subtitle: "Tirzepatida supera semaglutida na obesidade sem diabetes — SURMOUNT-5",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Endocrinologia",
    journal: "N Engl J Med",
    year: 2025,
    publishedAt: "2025-05-11",
    minutes: 7,
    cover: "/covers/surmount.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/40353578/",
    sourceLabel: "PubMed · PMID 40353578",
    pmid: "40353578",
    confidence: "alta",
    learned: "em obesidade sem diabetes, tirzepatida (dose máxima tolerada) perdeu 20,2% do peso em 72 semanas contra 13,7% da semaglutida — diferença clínica, não só estatística.",
    tldr: "Ensaio aberto de fase 3b, 751 adultos com obesidade sem DM2, 1:1 para dose máxima tolerada de tirzepatida (10 ou 15 mg) ou semaglutida (1,7 ou 2,4 mg), 72 semanas. Variação ponderal: −20,2% vs −13,7% (P<0,001). Cintura −18,4 vs −13,0 cm. Mais pacientes no braço tirzepatida cruzaram os limiares de 10, 15, 20 e 25%. Eventos GI semelhantes em tipo, na titulação.",
    study: "SURMOUNT-5 (Aronne et al.) comparou cabeça-a-cabeça os dois agonistas mais usados, em regime de máxima dose tolerada, sem diabetes. Desfecho primário: variação percentual de peso. Desfechos-chave: cintura e categorias de perda ponderal. Desenho aberto — vieses de expectativa existem, mas a balança é objetiva.",
    results: "N=751. Δ peso 72 sem: −20,2% (IC95% −21,4 a −19,1) vs −13,7% (−14,9 a −12,6). Cintura: −18,4 vs −13,0 cm. Proporções com perdas ≥10/15/20/25% favoreceram tirzepatida. EA mais comuns: gastrointestinais, leves a moderados, na escalada. Conclusão dos autores: superioridade em peso e cintura.",
    limitations: "Aberto. Sem desfecho CV (isso é SELECT/SURMOUNT-MMO etc.). Sem DM2 — não generalizar para o paciente com insulina e nefropatia. Adesão e acesso no mundo real diluem a diferença de 6,5 pontos percentuais. Não responde qual droga escolher quando o alvo é IC, DRC ou MASH especificamente.",
    practice: "Se o alvo é perda ponderal em obesidade sem diabetes, tirzepatida ganha o comparativo direto. A escolha real continua a ser: comorbidade-guia (HFpEF, DRC, MASH, CV), tolerância GI, estoque, custo e preferência. Não trocar quem já está bem e aderente só porque o pódio mudou.",
    synopsis: "Comparativo direto em obesidade sem diabetes: tirzepatida foi superior à semaglutida em perda de peso e circunferência abdominal aos 72 semanas, com perfil gastrointestinal familiar às duas classes."
  },
  {
    id: "select",
    title: "O inimigo agora é a inércia",
    subtitle: "Semaglutida 2,4 mg reduz MACE em obesidade com doença CV — SELECT",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Cardiologia",
    journal: "N Engl J Med",
    year: 2023,
    publishedAt: "2023-11-11",
    minutes: 8,
    cover: "/covers/select.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37952131/",
    sourceLabel: "PubMed · PMID 37952131",
    pmid: "37952131",
    confidence: "alta",
    learned: "semaglutida 2,4 mg semanal reduziu MACE em 20% em pessoas com sobrepeso/obesidade e doença CV estabelecida, sem diabetes — o peso deixou de ser só um fator de risco e virou alvo terapêutico.",
    tldr: "SELECT randomizou 17.604 adultos ≥45 anos com IMC ≥27 e doença cardiovascular, sem diabetes, para semaglutida 2,4 mg ou placebo. Seguimento médio 39,8 meses. MACE (morte CV, IAM ou AVC não fatais): 6,5% vs 8,0%, HR 0,80 (0,72–0,90), P<0,001. Efeito aparente cedo, não explicado só pela curva de peso.",
    study: "Ensaio de desfecho CV, duplo-cego, event-driven (Lincoff et al.). População de prevenção secundária clássica, mas sem DM2 — o buraco que faltava para a classe. Titulação padrão até 2,4 mg. Desfecho primário: composto de 3 pontos de MACE.",
    results: "HR 0,80 (IC95% 0,72–0,90). Morte CV: HR 0,85 (0,71–1,01) — tendência. IAM não fatal favoreceu a droga. Perda de peso média ~9% vs ~1%. EA GI mais frequentes; descontinuação maior no braço ativo. Não houve sinal de retinopatia como no SUSTAIN-6 (população sem diabetes).",
    limitations: "Não estabelece dose mínima cardioprotetora. Poucos muito idosos frágeis. Custo e desabastecimento limitam a implementação. O mecanismo (peso vs efeito vascular direto) segue em debate — a curva de MACE separa antes do nadir ponderal.",
    practice: "Paciente com DAC/AVC/PAD, IMC ≥27, sem diabetes: semaglutida 2,4 mg entra na conversa de prevenção secundária junto com estatina de alta intensidade, antiagregante, IECA/BRA, betabloqueador quando indicado. Inércia (“vamos tentar dieta mais um ano”) é o inimigo. Checar contraindicações (MECT, gravidez) e plano de titulação.",
    synopsis: "Em prevenção secundária sem diabetes, semaglutida 2,4 mg reduziu o composto de morte cardiovascular, infarto e AVC em 20% — evidência que desloca a obesidade de ‘contexto’ para alvo."
  },
  {
    id: "flow",
    title: "O rim que o comprimido salvou",
    subtitle: "Semaglutida reduz o composto renal em DM2 com DRC — FLOW",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Nefrologia",
    journal: "N Engl J Med",
    year: 2024,
    publishedAt: "2024-05-24",
    minutes: 7,
    cover: "/covers/kidney.jpg",
    sourceUrl: "https://www.nejm.org/doi/full/10.1056/NEJMoa2403347",
    sourceLabel: "NEJM · FLOW",
    confidence: "alta",
    learned: "semaglutida 1,0 mg semanal, em DM2 com DRC, reduziu o composto de falência renal, queda ≥50% do TFG e morte renal/CV (HR 0,76) — o GLP-1 entra de fato na prateleira do rim, ao lado do SGLT2.",
    tldr: "FLOW (Perkovic et al.) randomizou 3.533 pacientes com DM2 e DRC para semaglutida 1 mg/semana ou placebo. Interrompido por eficácia. Desfecho primário (falência renal, queda ≥50% da TFGe, morte renal ou CV): HR 0,76 (0,66–0,88). Morte CV: HR 0,71. TFGe declinou mais devagar no braço ativo.",
    study: "Ensaio renal dedicado da semaglutida na dose de diabetes (1 mg), não a de obesidade. População com TFGe 25–75 e albuminúria, ou TFGe 25–50 independentemente da albumina. Padrão contemporâneo: muitos já em SGLT2 — o benefício é adicional, não substitutivo.",
    results: "HR 0,76 para o composto primário. Confirmação de benefício em morte CV e em declínio de TFGe. EA GI esperados. Hipoglicemia não aumentou de forma relevante (agonista de incretina, não secretagogo).",
    limitations: "Dose 1 mg — não extrapolar automaticamente 2,4 mg. Predominância de DM2; DRC não diabética continua território do SGLT2 (EMPA-KIDNEY, DAPA-CKD). Interrompido precocemente pode inflar o efeito. Acesso e via subcutânea.",
    practice: "DM2 + DRC: a tríade vira SGLT2 + (ns)MRA quando indicado + GLP-1 (semaglutida com desfecho renal). Não escolha um e esqueça o outro. Ajuste para TFGe, hipercalemia do MRA e titulação GI. O ‘comprimido que salvou o rim’ no título é metáfora — aqui a dose é semanal injetável.",
    synopsis: "FLOW fecha a lacuna renal do GLP-1 no diabetes: menos falência de órgão, menos queda de TFG e menos morte CV em quem já deveria estar em SGLT2."
  },
  {
    id: "empa-kidney",
    title: "O SGLT2 que não pergunta o diabetes",
    subtitle: "Empagliflozina reduz progressão da DRC com ou sem DM — EMPA-KIDNEY",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Nefrologia",
    journal: "N Engl J Med",
    year: 2023,
    publishedAt: "2023-01-12",
    minutes: 6,
    cover: "/covers/kidney.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/36331190/",
    sourceLabel: "PubMed · PMID 36331190",
    pmid: "36331190",
    confidence: "alta",
    learned: "empagliflozina 10 mg reduz progressão da DRC ou morte CV em amplo espectro de TFGe (20–45 sem albuminúria; 45–90 com albuminúria), com ou sem diabetes — a classe é terapia renal, não ‘antidiabético com bônus’.",
    tldr: "N=6.609. Desfecho primário (progressão de doença renal ou morte CV): 13,1% vs 16,9%, HR 0,72 (0,64–0,82). Benefício consistente nos subgrupos com e sem DM. Incluiu TFGe até 20. Infecção genital aumentada; cetoacidose rara.",
    study: "EMPA-KIDNEY Collaborative Group. Ensaio pragmaticamente amplo: DRC com TFGe 20–45, ou 45–90 com relação A/C ≥200 mg/g. Empagliflozina 10 mg vs placebo. Interrompido por eficácia. Complementa DAPA-CKD (albuminúria mais alta).",
    results: "HR 0,72 no primário. Hospitalização por IC também cai. O efeito na TFGe tem o típico dip inicial e depois a curva se achata. Segurança alinhada à classe.",
    limitations: "Poucos transplanteados e pouca doença policística grave. Dip inicial da TFGe ainda assusta quem não foi avisado. Volume depletion no idoso em diurético de alça.",
    practice: "TFGe 20–45? SGLT2 mesmo sem diabetes e mesmo com pouca albumina. Avise o dip de 3–5 mL/min, suspenda em jejum prolongado/desidratação (sick-day), e não use a classe como desculpa para abandonar IECA/BRA.",
    synopsis: "Empagliflozina reduz progressão da DRC independentemente do diabetes e numa faixa de TFGe mais baixa do que os ensaios antigos ousavam incluir."
  },
  {
    id: "esc-af",
    title: "Fibrilação: o protocolo que envelheceu o CHA₂DS₂ solitário",
    subtitle: "Diretriz ESC 2024 de FA — AF-CARE e o fim da pontuação como fetiche",
    studyType: "Guideline",
    evidenceLevel: "1A",
    specialty: "Cardiologia",
    journal: "Eur Heart J",
    year: 2024,
    publishedAt: "2024-08-30",
    minutes: 9,
    cover: "/covers/af.jpg",
    sourceUrl: "https://doi.org/10.1093/eurheartj/ehae176",
    sourceLabel: "ESC · Eur Heart J 2024",
    confidence: "alta",
    learned: "a ESC 2024 troca o mantra ‘antocoagula se CHA₂DS₂-VASc ≥2’ por AF-CARE: tratar comorbidades, evitar AVC com decisão compartilhada, reduzir sintomas e estimar risco dinamicamente — o escore é ferramenta, não sentença.",
    tldr: "Van Gelder et al. reorganizam o cuidado da FA em quatro pilares (CARE). Anticoagulação: CHA₂DS₂-VA (sem o ‘Sc’ de sexo como item que sozinho decide). Ablação sobe na linha do tempo, especialmente em IC com FE reduzida e FA recente. Controle de ritmo precoce ganha corpo. Álcool, sono, obesidade e PA saem da nota de rodapé.",
    study: "Diretriz da Sociedade Europeia de Cardiologia 2024 para fibrilação atrial, endossada pela EHRA. Não é ensaio — é síntese com graus de recomendação. Substitui a de 2020. O documento é longo; o que muda a terça-feira na sala é CARE + reclassificação do risco + ablação mais cedo em fenótipos certos.",
    results: "Recomendações-chave: (1) CHA₂DS₂-VA, sexo não pontua isoladamente; (2) DOAC padrão, não warfarina, salvo válvula mecânica/estenose mitral moderada-grave; (3) ablação como primeira linha em selecionados (IC FER + FA, ou preferência após informação); (4) ‘early rhythm control’ inspirado no EAST-AFNET 4; (5) rastreio oportunista, não de toda a população.",
    limitations: "Guideline europeu — SBC/AHA podem divergir em matizes. Graus de recomendação misturam RCTs e consenso. Implementar ablação precoce esbarra em fila, operador e custo. AF-CARE é mnemônico útil, não protocolo de UTI.",
    practice: "Na próxima FA nova: não abra só o CHA₂DS₂. Feche o loop de PA, sono, álcool, tireoide, peso. Antocoagule com DOAC se o risco de AVC não for baixo, independentemente do sexo. Discuta ablação cedo se FER ou se o paciente recusa viver em lençol de betabloqueador. Reavalie o risco — ele não é tatuagem.",
    synopsis: "A ESC 2024 reposiciona a FA como doença de sistema: comorbidade, anticoagulação inteligente, sintomas e avaliação contínua — o escore deixa de ser o centro do universo."
  },
  {
    id: "aspree",
    title: "A aspirina da farmácia já não é o que era",
    subtitle: "ASPREE — aspirina em primária no idoso aumenta sangramento sem ganho CV",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Geriatria",
    journal: "N Engl J Med",
    year: 2018,
    publishedAt: "2018-09-16",
    minutes: 6,
    cover: "/covers/aspirin.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/30221597/",
    sourceLabel: "PubMed · PMID 30221597",
    pmid: "30221597",
    confidence: "alta",
    learned: "em idosos saudáveis, AAS 100 mg não prolongou sobrevida livre de incapacidade e aumentou hemorragia maior — a caixa de aspirina na bolsa da paciente de 74 anos, sem DAC, é inércia, não prevenção.",
    tldr: "ASPREE (McNeil et al.): 19.114 pessoas ≥70 anos (≥65 se negro/hispânico nos EUA), sem DCV, demência ou incapacidade, AAS 100 mg vs placebo. Desfecho primário (morte, demência ou incapacidade persistente) idêntico (HR 1,01). Hemorragia maior: HR 1,38. Análise de mortalidade chegou a favorecer o placebo (sinal de câncer — interpretação cautelosa).",
    study: "Ensaio de prevenção primária contemporâneo, quando estatina, controle de PA e não-tabagismo já eram o pano de fundo. Por isso o ‘benefício residual’ da AAS encolheu e o dano ficou visível. Complementa ARRIVE e ASCEND (este último em diabetes).",
    results: "Sem redução do composto de incapacidade. Mais sangramento clinicamente significativo (digestivo, intracraniano). Qualquer leitura de ‘AAS previne câncer’ neste dataset é especulativa e, no ASPREE, o sinal foi na direção oposta em mortalidade — não use isso em consultório.",
    limitations: "População relativamente sadia; não responde sobre AAS em DAC silenciosa, stent antigo ou escores de risco muito altos. Dose 100 mg. Seguimento ~4,7 anos pode ser curto para câncer.",
    practice: "Idoso sem doença aterosclerótica clínica: não inicie AAS. Se já usa ‘porque o clínico mandou em 2009’, discuta desprescrição — o risco de sangramento cresce com a idade, o benefício não. Em prevenção secundária, AAS (ou outro antiagregante conforme o cenário) permanece.",
    synopsis: "ASPREE enterrou a aspirina universal do idoso saudável: mesmo composto de sobrevida livre de incapacidade, mais hemorragia."
  },
  {
    id: "danger-shock",
    title: "O motorzinho que disputa a UTI",
    subtitle: "Bomba microaxial em IAMCSST + choque — DANGER-SHOCK",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Medicina Intensiva",
    journal: "N Engl J Med",
    year: 2024,
    publishedAt: "2024-04-07",
    minutes: 8,
    cover: "/covers/shock.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/38587239/",
    sourceLabel: "PubMed · PMID 38587239",
    pmid: "38587239",
    confidence: "alta",
    learned: "em IAMCSST com choque cardiogênico, a bomba microaxial (Impella) reduz mortalidade em 180 dias (45,8% vs 58,5%) — e aumenta complicações hemorrágicas e vasculares. Não é protocolo de todo choque; é ferramenta de centro que faz volume.",
    tldr: "DANGER-SHOCK (Møller et al.): 355 pacientes com IAMCSST e choque, randomizados para padrão ± bomba microaxial. Morte em 180 dias: 45,8% vs 58,5%, HR 0,74 (0,55–0,99). Mais sangramento moderado/grave e isquemia de membro no braço do dispositivo.",
    study: "Ensaio dinamarquês, aberto, em rede de centros experientes. População: choque cardiogênico no contexto de IAM com supradesnível, com critérios específicos (lactato, pressão, necessidade de vasopressor). Não é o choque misto da enfermaria, nem a PCR em AESP.",
    results: "Redução absoluta de mortalidade ~13 pontos em 180 dias. Custo: hemorragia e complicação vascular. IABP, historicamente, não mostrou isso (IABP-SHOCK II). A diferença de dispositivo e de seleção importa.",
    limitations: "Amostra pequena para um desfecho tão duro — o IC toca 0,99. Externalidade: operador, tempo porta-Impella, seleção. Não generalizar para choque não isquêmico, noradrenalina alta por sepse, ou hospital sem cirurgia vascular de retaguarda.",
    practice: "Se você está no centro de choque: discuta Impella cedo no IAMCSST + choque, não como último rito depois de três horas de noradrenalina. Se você não está: o dado não autoriza improvisar o dispositivo. Continue o básico (reperfusão, SCAI staging, evitar excesso de volume e de vasopressor).",
    synopsis: "Primeiro RCT positivo de suporte mecânico no choque isquêmico em décadas — com o ônus hemorrágico que o motorzinho cobra."
  },
  {
    id: "orbita2",
    title: "A angina que o placebo não calou",
    subtitle: "ORBITA-2 — ICP vs procedimento placebo em angina estável sem antiangénicos",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Cardiologia",
    journal: "The Lancet",
    year: 2023,
    publishedAt: "2023-11-11",
    minutes: 7,
    cover: "/covers/orbita.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37984346/",
    sourceLabel: "PubMed · PMID 37984346",
    pmid: "37984346",
    confidence: "alta",
    learned: "quando se retira o véu da medicação antianginosa, a ICP em doença estável reduz escore de sintomas vs um procedimento placebo — o vaso não era inocente; o teatro do cateterismo, em parte, era.",
    tldr: "ORBITA-2 (Rajkumar et al.): pacientes com angina estável e pelo menos uma estenose grave, sem antiangénicos de base, randomizados para ICP ou procedimento placebo, cegos. O escore de sintomas de angina melhorou mais com ICP. Sem pretensão de reduzir morte/IAM — o alvo era sintoma.",
    study: "Sucessor do ORBITA-1, que havia decepcionado a ICP em pacientes já medicados. Aqui o desenho isola o efeito da desobstrução sobre o sintoma, com sham e cegamento rigorosos (o paciente e a equipe de avaliação não sabem).",
    results: "Melhora sintomática superior no braço ICP. Confirma que isquemia epicárdica trata-se, sim, com stent — quando o alvo é angina e não o ego do laudo. Não contradiz ISCHEMIA no que diz respeito a desfechos duros em estáveis.",
    limitations: "Não é ensaio de mortalidade. Seleção britânica, anatomia específica. O placebo é eticamente e logisticamente difícil de replicar. Não autoriza stentar tudo que o FFR ‘quase’ fecha.",
    practice: "Angina estável: otimize medicação. Se o paciente continua limitado e a anatomia é clara, ICP é terapia de sintoma com evidência agora mais limpa. Não venda stent como seguro de vida. ISCHEMIA continua no mural dos desfechos duros.",
    synopsis: "Com sham e sem antiangénicos, a ICP prova o que os clínicos suspeitavam: alivia angina. Não prova o que os comerciais prometiam: alongar a vida do estável."
  },
  {
    id: "mash",
    title: "O fígado que derreteu a gordura",
    subtitle: "Semaglutida em NASH/MASH — fase 2 NEJM e o que isso muda (e o que não)",
    studyType: "RCT",
    evidenceLevel: "2A",
    specialty: "Hepatologia",
    journal: "N Engl J Med",
    year: 2021,
    publishedAt: "2021-03-18",
    minutes: 6,
    cover: "/covers/mash.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/33185364/",
    sourceLabel: "PubMed · PMID 33185364",
    pmid: "33185364",
    confidence: "média",
    learned: "semaglutida 0,4 mg/dia (fase 2) resolveu NASH sem piora de fibrose em 59% vs 17% do placebo — sinal biológico forte, ainda sem o desfecho de cirrose/descompensação que o hepatologista realmente quer.",
    tldr: "Newsome et al., fase 2, 320 pacientes com NASH confirmada por biópsia. Semaglutida subcutânea diária em três doses vs placebo, 72 semanas. Resolução de NASH sem piora da fibrose: 40–59% vs 17%. Melhora de fibrose não atingiu significância. Perda de peso dose-dependente. Confiança do resumo: média (fase 2; dose diferente da comercial semanal).",
    study: "Ensaio de histologia, não de eventos. A dose diária 0,4 mg não é a caneta de 2,4 mg semanal da obesidade — extrapolação fisiológica é razoável, formal não. Programas de fase 3 (ESSENCE) vieram depois; este texto permanece ancorado no paper publicado e revisado por pares de 2021.",
    results: "Resolução de NASH dose-relacionada. Fibrose: tendência, sem P significativo no primário de fibrose. EA GI clássicos. Enzimas caem com o peso.",
    limitations: "Fase 2. Surrogate histológico. Dose não comercial. Sem dados de descompensação, CHC ou morte. MASH é heterogênea; biópsia tem variabilidade interobservador.",
    practice: "Paciente com MASH e obesidade/DM: GLP-1 já faz sentido por peso, glicemia e (agora) histologia. Não substitua álcool-zero, rastreio de varizes quando a elastografia pedir, nem o manejo de HA e dislipidemia. Não prometa ‘cura de cirrose’ com caneta.",
    synopsis: "Sinal histológico convincente de que a semaglutida trata o fígado gorduroso inflamado — ainda um degrau abaixo da evidência que muda diretriz de desfecho duro."
  },
  {
    id: "sprint",
    title: "120 não é o novo 140 — e nunca foi tão simples",
    subtitle: "SPRINT: meta <120 mmHg em alto risco sem diabetes, relida uma década depois",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Medicina Interna",
    journal: "N Engl J Med",
    year: 2015,
    publishedAt: "2015-11-09",
    minutes: 6,
    cover: "/covers/sprint.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26551272/",
    sourceLabel: "PubMed · PMID 26551272",
    pmid: "26551272",
    confidence: "alta",
    learned: "meta sistólica <120 vs <140, medida com método rigoroso, reduziu o composto CV e morte em hipertensos de alto risco sem diabetes — mas o consultório de 7 minutos com esfigmomanômetro de corredor não é o SPRINT.",
    tldr: "9.361 pacientes ≥50 anos, PAS 130–180, alto risco CV, sem diabetes e sem AVC prévio. Média de PAS atingida ~121 vs ~136. Composto primário (IAM, SCA, AVC, IC, morte CV): HR 0,75. Morte total: HR 0,73. Mais hipotensão, síncope, eletricidade renal e hiponatremia no braço intensivo.",
    study: "Medição de PA com aparelho automático, paciente sozinho, média de leituras — isso sozinho já baixa 5–10 mmHg vs o corredor. Interrompido precocemente. A população exclui diabetes (ACCORD não replicou o mesmo desenho) e AVC (SPS3).",
    results: "NNT baixo para um ensaio de PA. Insuficiência cardíaca foi um dos componentes mais beneficiados. Idosos do SPRINT SENIOR também ganharam, com mais eventos adversos.",
    limitations: "Método de medida não reproduzido na APS brasileira. Sem DM, sem AVC. Interrupção precoce. Lesão renal aguda ‘de laboratório’ vs desfecho renal duro. Não é licença para 110 em frágil com queda.",
    practice: "Hipertenso de alto risco, autônomo, sem diabetes: busque PAS mais baixa do que 140, medida direito (sentado, 5 min, 3 medidas). No frágil, no desnutrido e no que já caiu, o alvo é outro. Não copie o número 120 sem copiar o método.",
    synopsis: "SPRINT continua o marco da meta intensiva — e o lembrete de que a forma de medir a pressão é parte do tratamento."
  },
  {
    id: "balance",
    title: "O antibiótico que não deveria ter sido prescrito — os 7 dias que bastam",
    subtitle: "BALANCE: 7 vs 14 dias em bacteremia, não inferior para morte em 90 dias",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Infectologia",
    journal: "N Engl J Med",
    year: 2024,
    publishedAt: "2024-11-20",
    minutes: 7,
    cover: "/covers/abx.jpg",
    sourceUrl: "https://www.nejm.org/doi/full/10.1056/NEJMoa2404991",
    sourceLabel: "NEJM · BALANCE",
    confidence: "alta",
    learned: "em bacteremia (excluídos Staphylococcus aureus e alguns focos especiais), 7 dias de antibiótico não foram inferiores a 14 dias para mortalidade em 90 dias — a segunda semana é, muitas vezes, hábito.",
    tldr: "Ensaio multicêntrico (Daneman et al.) comparando 7 vs 14 dias em pacientes hospitalizados com hemocultura positiva. Desfecho primário: morte em 90 dias, margem de não inferioridade pré-especificada. 7 dias foi não inferior. Relapsos e readmissões não explodiram.",
    study: "Pergunta clássica de stewardship levada a desfecho duro. Exclui cenários em que a tradição (e a biologia) pedem mais: S. aureus, Candida, endocardite, osteomielite não drenada, prótese não retirada. O resto da bacteremia ‘de foco controlado’ cabe aqui.",
    results: "Não inferioridade em mortalidade a 90 dias. Sem sinal claro de prejuízo em infecção recorrente. Implicação ecológica: menos exposição, menos C. difficile, menos AVEs.",
    limitations: "Não é licença para 7 dias com foco não controlado. S. aureus continua de fora. Adesão ao braço curto em quem ‘está malzinho no D6’ exige juízo. Definir ‘foco controlado’ no mundo real é a arte.",
    practice: "Bacteremia por enterobactéria de ITU ou de cateter já retirado, paciente bom no D5–D7: pare. Não estenda ‘por garantia’. Documente o foco. Se for S. aureus, endocardite ou abscesso residual, ignore este parágrafo.",
    synopsis: "Sete dias bastam para a maior parte das bacteremias de foco controlado — a segunda semana precisa de indicação, não de inércia."
  },
  {
    id: "clear",
    title: "Quando a estatina é o inimigo",
    subtitle: "Ácido bempedoico reduz MACE em intolerantes a estatina — CLEAR Outcomes",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Cardiologia",
    journal: "N Engl J Med",
    year: 2023,
    publishedAt: "2023-03-04",
    minutes: 6,
    cover: "/covers/clear.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/36876740/",
    sourceLabel: "PubMed · PMID 36876740",
    pmid: "36876740",
    confidence: "alta",
    learned: "ácido bempedoico reduziu o MACE de 4 pontos (HR 0,87) em pacientes intolerantes a estatina — finalmente um oral com desfecho CV para quem jura que ‘estatina não me serve’.",
    tldr: "CLEAR Outcomes (Nissen et al.): 13.970 pacientes intolerantes a estatina, bempedoico 180 mg vs placebo. Seguimento mediano 40,6 meses. MACE-4 (morte CV, IAM, AVC, revascularização): 11,7% vs 13,3%, HR 0,87 (0,79–0,96). LDL −21% médio. Mais gota e colelitíase; menos diabetes novo.",
    study: "Intolerância relatada pelo paciente, o cenário da vida real. Muitos em prevenção primária de alto risco e secundária. Não é substituto de PCSK9 quando o LDL alvo é 40; é a peça oral que faltava entre ezetimiba e a injeção.",
    results: "HR 0,87 no primário. IAM mais claramente reduzido. Efeito no LDL modesto comparado a PCSK9, suficiente para desfecho. Ácido úrico sobe — gota é o preço.",
    limitations: "Efeito menor que estatina de alta intensidade (que continua primeira linha). Intolerância é um espectro; muitos ‘intolerantes’ toleram rosuvastatina 5 mg 2x/semana. Gota e vesícula. Custo e disponibilidade no SUS/convênio.",
    practice: "Antes de rotular intolerância: tente outra estatina, dose baixa, posologia alternativa. Se for real, ezetimiba + bempedoico é um par oral racional; PCSK9 se o risco residual e o LDL pedirem. Hidrate a gota.",
    synopsis: "Bempedoico entrega desfecho cardiovascular em quem não toma estatina — oral, efeito moderado, gota no radar."
  },
  {
    id: "rsv",
    title: "O vírus que o idoso para de ignorar",
    subtitle: "Vacina RSV pré-F em adultos ≥60 — AReSVi-006",
    studyType: "RCT",
    evidenceLevel: "1B",
    specialty: "Geriatria",
    journal: "N Engl J Med",
    year: 2023,
    publishedAt: "2023-02-16",
    minutes: 5,
    cover: "/covers/rsv.jpg",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/37018468/",
    sourceLabel: "PubMed · PMID 37018468",
    pmid: "37018468",
    confidence: "alta",
    learned: "a vacina de proteína F em pré-fusão contra RSV reduziu a infecção do trato inferior em idosos com eficácia >80% na análise de temporada — RSV deixou de ser ‘o vírus da pediatria’.",
    tldr: "Papi et al.: adultos ≥60 anos, vacina RSVPreF3 OA vs placebo. Eficácia contra RSV-LRTD: 82,6% (57,9–94,1) na temporada 1. Perfil reatogênico aceitável (dor no local, fadiga). Não é ensaio de mortalidade.",
    study: "Ensaio de eficácia vacinal clássico, desfecho de doença respiratória inferior confirmada. Complementa os dados da vacina de Pfizer (RENOIR) — duas plataformas, mesma conclusão qualitativa: idosos se beneficiam.",
    results: "Alta eficácia contra LRTD por RSV. Proteção presente em 70–79 e ≥80, com IC mais largo nos mais velhos (menos eventos). Segurança sem sinal de Guillain-Barré neste paper índice (vigilância pós-marketing é outro capítulo).",
    limitations: "Eficácia ≠ efetividade em fração muito idosa institucionalizada. Desfecho não é morte. Sazonalidade brasileira (RSV não copia o inverno do Hemisfério Norte). Custo e calendário ainda em acomodação no SUS.",
    practice: "≥60 anos, especialmente cardiopata, DPOC, frágil: ofereça vacina de RSV na temporada, junto com influenza e COVID atualizada. Não substitua pneumococo. Documente a plataforma usada.",
    synopsis: "RSV ganhou vacina de verdade para o idoso: menos doença respiratória inferior, pergunta agora é implementação e calendário."
  }
];
export const EDITION_DEFS: Omit<Edition, "id">[] = [
  {
    daysAgo: 0,
    number: 247,
    title: "O coração que recusou o destino",
    kicker: "Edição de hoje",
    cover: editionCover(247),
    articleIds: [
      "summit",
      "surmount",
      "esc-af"
    ],
    learned: "incretinas saíram da balança e sentaram na mesa da insuficiência cardíaca — e a FA deixou de ser um escore tatuado."
  },
  {
    daysAgo: 1,
    number: 246,
    title: "O inimigo agora é a inércia",
    kicker: "Edição de ontem",
    cover: editionCover(246),
    articleIds: ["select", "flow"],
    learned: "prevenção secundária sem diabetes tem GLP-1 com desfecho, e o rim do diabético também."
  },
  {
    daysAgo: 2,
    number: 245,
    title: "Sete dias e uma bomba",
    kicker: "Arquivo",
    cover: editionCover(245),
    articleIds: ["danger-shock", "balance"],
    learned: "o choque isquêmico ganhou um dispositivo que muda mortalidade — e a bacteremia, uma segunda semana que sobra."
  },
  {
    daysAgo: 3,
    number: 244,
    title: "O vaso, o placebo e a pílula que faltava",
    kicker: "Arquivo",
    cover: editionCover(244),
    articleIds: ["orbita2", "clear"],
    learned: "stent trata angina de verdade quando o teatro é controlado, e intolerância a estatina deixou de ser um beco."
  },
  {
    daysAgo: 4,
    number: 243,
    title: "Pressão, fígado, vírus",
    kicker: "Arquivo",
    cover: editionCover(243),
    articleIds: [
      "sprint",
      "mash",
      "rsv"
    ],
    learned: "meta de PA continua um método, MASH responde à caneta, e RSV não é só de berçário."
  },
  {
    daysAgo: 5,
    number: 242,
    title: "O rim amplo e a aspirina aposentada",
    kicker: "Arquivo",
    cover: editionCover(242),
    articleIds: ["empa-kidney", "aspree"],
    learned: "SGLT2 não pergunta se há diabetes, e a AAS do idoso saudável já deveria ter saído da bolsa."
  }
];

export function getEditions(): Edition[] {
  const today = todayIso();
  return EDITION_DEFS.map((e) => ({
    ...e,
    id: addDaysIso(today, -e.daysAgo),
  }));
}

export function getTodayEdition(): Edition {
  return getEditions()[0]!;
}

export function getArticle(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}

export function editionById(id: string): Edition | undefined {
  return getEditions().find((e) => e.id === id);
}

export function editionMinutes(ed: Edition): number {
  return ed.articleIds.reduce((sum, id) => sum + (getArticle(id)?.minutes ?? 0), 0);
}

export function editionForArticle(articleId: string): Edition | undefined {
  return getEditions().find((e) => e.articleIds.includes(articleId));
}

export function editionHasStudyType(ed: Edition, type: StudyType): boolean {
  return ed.articleIds.some((id) => getArticle(id)?.studyType === type);
}

export const WEEK_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;
