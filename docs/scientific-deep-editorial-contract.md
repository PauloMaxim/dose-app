# ScientificEditorialDraft.v1 — contrato editorial profundo e grounded

## Decisão e fronteira de autoridade

Esta camada preserva a ordem de autoridade `SOURCE → EVIDENCE → FACTS → INTERPRETATION`.
O `ScientificEditorialDraft.v1` é uma transformação narrativa desses artefatos, nunca uma nova
fonte científica. O fluxo publicável futuro é `EDITORIAL DRAFT → validação independente → revisão
humana → DoseDocument`. O contrato não projeta o draft no DoseDocument e não muda o composer
determinístico existente.

Todo draft v1 nasce, por schema, com `requiresHumanReview: true` e `reviewStatus: pending`. Esses
campos são literais, portanto um gerador não consegue devolver `approved`. Não existe provider,
prompt, chamada HTTP ou integração de IA nesta implementação.

## Estrutura semântica e leitura progressiva

Os blocos disponíveis são `headline`, `deck`, `scientific_context`, `mechanistic_context`,
`research_question`, `study_design`, `population`, `intervention_comparator`,
`endpoint_explanation`, `primary_result`, `secondary_result`, `safety`, `interpretation`,
`limitations`, `what_this_adds`, `contextual_explainer` e `source_boundary`. Eles são opcionais e
repetíveis; a evidência, e não um template, decide quais existem.

Cada bloco declara `disclosureLayer`:

- `opening`: o que foi testado, em quem e qual foi o resultado principal;
- `core`: desenho, intervenção/comparador, endpoints e números;
- `deep_dive`: racional, mecanismo, interpretação, limites e cobertura.

Não há `minWords`, `targetWords`, SEO ou otimização por tempo de leitura. Profundidade significa
resolver as perguntas científicas pertinentes, sem transformar tudo em prosa contínua.

## Grounding por afirmação

Cada bloco contém afirmações individualizadas, classificadas como:

- `article_supported_fact` — afirmação sustentada pelo artigo representado;
- `deterministic_interpretation` — conclusão de regra explícita;
- `contextual_explanation` — explicação com proveniência contextual própria;
- `editorial_transition` — conexão linguística, sem autoridade factual.

Uma afirmação substantiva precisa referenciar ao menos um `factId`, `interpretationClaimId`,
`evidenceAnchorId`, `sourceDocumentId` ou `externalContextReferenceId`. Transições não podem usar
grounding para parecer científicas. Todos os IDs são resolvidos contra os inputs autorizados.
Valores quantitativos podem ser declarados em `quantitativeClaims`; o validador exige que valor e
unidade ocorram no fact indicado e que esse fact também esteja no grounding. Essa estrutura permite
uma checagem pós-geração sem promover o texto a autoridade.

## Contextual scientific material

`ContextualScientificMaterial.v1` é um input separado. Cada claim contextual tem status epistêmico
e proveniência própria em documento-fonte, âncora de evidência ou referência externa previamente
autorizada. Contexto vazio de proveniência é inválido. O composer não pode produzi-lo do nada.

Esta mudança não cadastra referências externas nem adiciona conhecimento científico. Em particular,
ela não preenche lacunas mecanísticas de Iptacopan ou Clopidogrel/DAPT. Uma futura aquisição de
contexto precisará ocorrer antes da geração, sob autorização e auditoria próprias.

## Status epistêmicos e limites de inferência

Claims podem declarar: resultado clínico observado, mecanismo proposto, associação, hipótese,
causalidade demonstrada ou não demonstrada, não inferioridade, equivalência, superioridade,
recomendação terapêutica e cobertura da fonte. O status torna verificáveis distinções que não podem
depender apenas de estilo — por exemplo, mecanismo proposto não é causalidade clínica.

O draft possui `supportedConclusions` e `unsupportedConclusions`. Cada claim aponta para conclusões
por ID; usar uma conclusão proibida invalida o draft. Regras tipadas registram, entre outras,
`do_not_infer_equivalence`, `do_not_infer_superiority`, `do_not_infer_causality`,
`do_not_recommend_treatment` e `do_not_claim_full_text_review`.

No escopo de rct.v1:

- equivalência é rejeitada: não inferioridade não significa tratamentos iguais;
- superioridade é rejeitada porque a gramática atual não representa uma decisão de superioridade;
- causalidade demonstrada exige contexto explicitamente grounded com esse mesmo status; relações
  mecanísticas do artigo não bastam;
- recomendação terapêutica é sempre não autorizada no Editorial Draft v1;
- claim de full text exige cobertura de full text licenciada no source set;
- `source_boundary` deve ser explicitamente classificado como cobertura da fonte.

## Validação pós-geração

O validador verifica schema/revisão obrigatória, lineage e artigo; existência de facts,
interpretations, anchors, documents e referências contextuais; proveniência contextual; grounding
de afirmações substantivas; compatibilidade de transições e source boundaries; uso de conclusão
proibida; valores quantitativos declarados; cobertura de full text; falsa equivalência; falsa
superioridade; causalidade indevida; e recomendação terapêutica.

Ele não tenta resolver semanticamente toda linguagem natural. O status epistêmico, as conclusões e
os números precisam ser declarados pelo gerador; validação automática é uma barreira adicional, não
substitui revisão humana.

## Interface futura de geração

`ScientificEditorialDraftGenerator` define somente:

```ts
generateEditorialDraft({
  sourceSet,
  evidenceSet,
  factSet,
  interpretationArtifact,
  contextualMaterial,
}): Promise<ScientificEditorialDraft>
```

Uma implementação futura deverá receber apenas esses materiais, devolver um draft ainda pendente e
submetê-lo ao validador independente. A interface não escolhe provider, não contém prompt, credencial
ou transporte e não autoriza publicação.

## Golden gap analysis — PMID 42717033 (Mitiperstat)

Esta análise compara estruturalmente o DoseDocument manual aprovado com a projeção produzida pelo
composer genérico. Não usa contagem de palavras como proxy de qualidade.

### A. Conteúdo presente em ambos

Ambos preservam população, intervenção e placebo, desenho randomizado, braços, duração, endpoints,
resultados principais com estimativas/intervalos/P, segurança disponível, limites de cobertura do
abstract, referências e vínculo a facts. Ambos mantêm o documento como draft com revisão humana.

### B. Conteúdo científico presente apenas, ou desenvolvido apenas, no golden

O golden encadeia MPO → oxidantes → disponibilidade de óxido nítrico → alterações microvasculares,
rigidez e fibrose → hipótese clínica. Ele explica a função complementar de KCCQ-TSS e 6MWD, separa
estimativa pontual de incerteza e delimita o resultado negativo às doses, população, tempo e
desfechos testados. Os facts mecanísticos existem no conjunto do Mitiperstat, mas o composer genérico
não os seleciona nem organiza como cadeia explicativa.

### C. Conteúdo editorial presente apenas no golden

O golden constrói uma pergunta científica, converte o desenho em experimento compreensível, alterna
visão rápida e aprofundamento, explica por que cada medida responde a uma dimensão diferente e cria
uma seção própria de contribuição. Também faz a transição pedagógica entre plausibilidade biológica
e benefício clínico observado, sem confundi-los.

### D. Conteúdo dependente de contexto científico adicional

No caso Mitiperstat, parte relevante do mecanismo está no próprio abstract e já foi atomizada em
facts; portanto não deve ser rotulada como conhecimento externo. Explicações além do que esses facts
e anchors sustentam — por exemplo, história da via, fisiologia adicional, significado clínico externo
de escalas ou estágio de desenvolvimento — exigiriam `ContextualScientificMaterial.v1` com
proveniência própria. Nada disso foi acrescentado nesta mudança.

### E. Conteúdo puramente estilístico

Títulos em forma de pergunta, ritmo entre frases, analogias não científicas, ordem de apresentação e
transições são decisões editoriais. Podem melhorar compreensão, mas não criam facts. Quando uma
transição introduz conteúdo material, deixa de ser transição e passa a exigir grounding.

### F. Conteúdo que não deve ser produzido automaticamente

Não devem surgir sem suporte: causalidade clínica a partir do mecanismo; ausência universal de
efeito; refutação da participação da MPO na doença; inutilidade de futuras inibições; equivalência;
superioridade; recomendação de tratamento; mudança de prática; nomes ou números ausentes; revisão de
full text; ou contexto científico não fornecido.

### G. Inputs necessários para reproduzir corretamente a profundidade

Uma futura geração precisa dos source/evidence/fact sets completos, claims de interpretação e suas
proibições, cadeia mecanística atomizada, definições grounded dos endpoints, limites de cobertura,
conclusões suportadas e não suportadas e, quando necessário, material contextual proveniente de
fontes separadas. Também precisa de estrutura editorial tipada e do gate humano — não de uma meta de
tamanho.

## Lacunas estruturais dos outros casos do laboratório

Estas listas são requisitos de material, não afirmações científicas novas.

### Iptacopan (PMID 41910396)

Uma narrativa profunda precisaria receber: contexto da doença; mecanismo e racional da intervenção;
definições e significado dos endpoints renal e composto; relação entre medidas intermediárias e
eventos; horizonte temporal; interpretação clínica calibrada; contexto de segurança; e limites de
generalização. Cada item precisaria ser extraído dos artefatos existentes ou fornecido como contexto
com proveniência. Esta mudança não preenche nenhum deles.

### Clopidogrel/DAPT (PMID 42670964)

Uma narrativa profunda precisaria receber: contexto da estratégia antitrombótica; população e marco
temporal após stent; composição e direção do endpoint; lógica, margem e regra de não inferioridade;
material grounded para explicar o trade-off entre eventos isquêmicos e sangramento; segurança; e
limites explícitos contra equivalência, superioridade e preferência terapêutica. O resultado de não
inferioridade sozinho não autoriza essas conclusões. Esta mudança registra a necessidade, mas não a
supre com conhecimento externo.
