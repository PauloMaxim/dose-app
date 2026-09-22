# Dose — Scientific Experience Experimentation

**Status: STRATEGIC EXPERIMENTATION DRAFT — NO EXPERIENCE SELECTED**

Este documento organiza um programa de aprendizagem. Ele **não define a experiência final do Dose**, não
aprova formato, arquitetura de leitura, mecanismo de retenção, modelo comercial ou implementação. Seu
objetivo é permitir que diferentes formas de apresentar literatura científica real sejam comparadas antes
de uma decisão de produto.

A pergunta não é “qual é o melhor formato de resumo de paper?”. A pergunta de produto é:

> **Qual experiência permite que um profissional permaneça atualizado com menos esforço, compreenda
> corretamente o que importa e escolha a profundidade que deseja?**

**HYPOTHESIS TO VALIDATE:** o Dose pode ser mais valioso como serviço de atualização científica
personalizada do que como simples ferramenta de resumo. Esta hipótese não é Product Truth.

## 1. Categorias de decisão

### INVARIANTS

Estes limites não dependem do resultado de um experimento de UX:

- **INVARIANT:** não inventar fatos, números, métodos, limitações, fontes ou conclusões.
- **INVARIANT:** conteúdo editorial nunca pode ser mais forte que a evidência disponível.
- **INVARIANT:** associação não pode ser convertida em causalidade.
- **INVARIANT:** ausência de dado deve poder permanecer ausência; não deve ser preenchida por criatividade.
- **INVARIANT:** conteúdo gerado ou editorial não pode ser apresentado como texto original.
- **INVARIANT:** provenance deve ser verificável e a fonte científica deve permanecer acessível quando
  houver link disponível.
- **INVARIANT:** metadata, abstract, full text, interpretação editorial, classificação, ranking e conteúdo
  gerado devem permanecer distinguíveis.
- **INVARIANT:** nível interno de classificação não se converte automaticamente em certeza metodológica,
  qualidade do estudo ou recomendação clínica.
- **INVARIANT:** tipos distintos de publicação exigem tratamento cientificamente apropriado.
- **INVARIANT:** relevância para interesses, força da evidência e capacidade de mudar prática são conceitos
  diferentes.
- **INVARIANT:** título não pode usar clickbait, exagero, causalidade indevida ou benefício clínico não
  sustentado.
- **INVARIANT:** a experiência não pode produzir recomendação clínica automática, diagnóstico, GRADE
  automático ou conclusão mais forte que a fonte.

### HYPOTHESES TO TEST

Nenhuma ideia desta lista está aprovada: duas profundidades; experiência progressiva única; resumo
convencional; briefing rápido; modo técnico; notícia científica; conversa; newsletter; Daily Dose; Weekly
Dose; cards finitos; numbers-first; leitura progressiva; áudio; explicação visual; Paper Q&A;
contextualização multipaper; “o que este estudo acrescenta?”; evidence timeline; guideline diff;
personalização explicável; transparência de cobertura; fechamento finito e acesso “Original + Dose”.

### PRODUCT DECISIONS

Nenhuma experiência foi selecionada. Esta categoria permanece deliberadamente vazia. Somente resultados
validados, revisados e explicitamente aprovados em decisão posterior podem migrar para cá.

## 2. Baseline verificado e limites desta análise

| Certeza                          | Observação local                                                                                                                                                                                                                                                              | Consequência para experimentação                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **VERIFIED EXISTING CAPABILITY** | O domínio reconhece `systematic_review`, `meta_analysis`, `guideline`, `randomized_trial`, `cohort`, `case_control`, `cross_sectional`, `case_report`, `editorial` e `other`.                                                                                                 | Há uma taxonomia técnica inicial; ela não comprova o desenho real nem a qualidade metodológica.        |
| **VERIFIED EXISTING CAPABILITY** | Metadata disponível no modelo inclui título, autores, periódico, publisher, data, DOI, PMID, PMCID, idioma, publication types, volume, fascículo, páginas, URLs, keywords, MeSH e timestamps, além de abstract opcional.                                                      | Protótipos devem trabalhar somente com campos realmente presentes e representar ausências.             |
| **VERIFIED EXISTING CONSTRAINT** | O pipeline representa metadata e abstract fornecido pela fonte; full text está deliberadamente ausente. PMCID ou flag open access não autoriza redistribuição.                                                                                                                | Nenhum teste pode insinuar análise de full text quando a base for metadata + abstract.                 |
| **VERIFIED EXISTING CAPABILITY** | A Home e a área de artigos consomem um feed científico autenticado, com estados loading, erro e vazio; cards exibem metadata, abstract quando disponível, tipo classificado, correspondência temática e links de fonte.                                                       | Existe uma superfície técnica para feed, mas este documento não altera nem valida sua UX.              |
| **VERIFIED EXISTING CAPABILITY** | O candidate set exige tópico ou especialidade de interesse; ranking determinístico considera correspondência temática, tipo classificado, recência, completude objetiva e item salvo, exclui lidos e publicações marcadas como retratadas e separa `recent`/`classics`.       | Score de relevância não deve ser apresentado como qualidade científica ou importância clínica.         |
| **VERIFIED EXISTING CAPABILITY** | A classificação de desenho usa somente `publicationTypes`, com regras ordenadas e versionadas; `other` é o fallback. A classificação temática usa regras determinísticas e registra evidências por campo, confidence, método e versão; associações editoriais também existem. | Rótulos são pistas classificatórias, não auditoria metodológica nem certeza de desenho.                |
| **VERIFIED EXISTING CAPABILITY** | A ingestão registra provenance por provider/external ID/source URL e metadata de origem. O feed limita seu catálogo a registros com fonte PubMed, Europe PMC ou Crossref e oferece URLs original/PubMed/PMC/DOI quando presentes.                                             | A experiência pode expor origem, mas não deve afirmar cobertura integral ou disponibilidade do texto.  |
| **VERIFIED EXISTING CAPABILITY** | Há infraestrutura server-only de summary estruturado com escopo fixo `abstract_and_metadata`, campos ausentes explícitos e configuração desabilitada por padrão; o feed não dispara geração.                                                                                  | Infraestrutura preparada não prova summary real, qualidade semântica, ativação ou valor para usuários. |
| **NOT VERIFIED**                 | Produção, deploy, estado remoto de migrations, corpus populado, cobertura/latência, precisão em literatura real, summaries reais, direitos de full text, qualidade editorial/clínica, analytics e comportamento de usuários.                                                  | Esses itens não podem ser tratados como capacidades operacionais nem resultados.                       |

A inspeção foi local e limitada ao necessário. Nenhuma operação remota em Supabase/Vercel, ingestão,
consulta a fontes científicas ou chamada de IA foi executada.

## 3. Unidade de valor e sucesso sem prolongamento

**PROPOSED PRODUCT PRINCIPLE:** “Uma publicação pode entregar todo o valor necessário daquela sessão.”

Caso de uso obrigatório: um profissional pode entrar no Dose, abrir **uma** publicação, entendê-la, talvez
aprofundar, talvez abrir a fonte original e sair. Isso deve poder ser uma sessão bem-sucedida. O produto
não deve exigir completar feed, ler vários artigos, fazer quiz, manter streak, cumprir meta, continuar
rolando ou realizar uma jornada artificial.

Mais minutos não equivalem automaticamente a mais valor. Obter em três minutos uma compreensão que antes
exigia trinta pode representar sucesso excepcional. Otimizar isoladamente session duration, número de
artigos, scroll, interações ou consumo contínuo pode premiar confusão, fricção, ansiedade ou compulsão.
Devem ter precedência relevância, compreensão, confiança, eficiência, retorno intencional, profundidade
escolhida, salvamento, acesso à fonte, utilidade percebida e disposição a pagar.

## 4. Atenção sem compulsão

Produtos de alta atenção oferecem mecanismos que podem ser estudados separadamente: entrada imediata no
conteúdo, personalização, curiosidade, novidade real, progressão compreensível, leitura escaneável, baixa
fricção, feedback rápido, continuidade, antecipação e relevância individual. O aprendizado desejável é
reduzir o custo de chegar ao entendimento — não copiar seus loops.

Não são desejáveis por padrão: infinite scroll, autoplay interminável, reward loops compulsivos, pressão
por streak, FOMO artificial, notificações excessivas, gamificação obrigatória, sensacionalismo ou
clickbait. A sequência candidata é:

> curiosidade → entendimento → sensação de domínio → fechamento

em vez de:

> estímulo → swipe → estímulo → swipe infinito

**HYPOTHESIS TO VALIDATE:** “A recompensa central do Dose pode ser a sensação de compreender e estar
atualizado, e não a continuidade do consumo.”

### Quiz e estudo

**DECISION DEFERRED — OPTIONAL EDUCATIONAL LAYER:** quiz, flashcards, spaced repetition e outros mecanismos
de estudo podem ser úteis futuramente, em uma área educacional ou quando pedidos explicitamente. Não são
assumidos como núcleo da leitura científica porque o usuário pode querer consumir uma única publicação
rapidamente.

## 5. Dois eixos independentes de experimentação

O formato editorial não deve ser confundido com a gramática científica. Um formato pode funcionar para
um desenho e falhar em outro. Os testes devem cruzar:

- **Eixo A — gramática científica:** quais perguntas, dados, limites e não inferências são próprios do tipo
  de evidência;
- **Eixo B — experiência de leitura:** como essa base é apresentada, navegada e aprofundada.

### Eixo A — gramáticas científicas candidatas

As gramáticas abaixo são hipóteses estruturais. Não exigem layouts completamente diferentes; buscam uma
linguagem reconhecível dentro do mesmo tipo, preservando a individualidade de cada publicação.

#### Randomized controlled trial (RCT)

- **Perguntas:** em qual população, intervenção e comparador; qual endpoint primário; em quanto tempo; com
  qual efeito e segurança?
- **Precedência:** população, critérios relevantes, N, randomização/cegamento quando informado,
  intervenção, comparador, follow-up, endpoint primário, effect estimate, intervalo, perdas, adverse
  events e limitações.
- **Armadilhas:** trocar significância por importância clínica; ignorar perdas; confundir surrogate com
  benefício clínico; generalizar além da população; concluir equivalência por ausência de significância.
- **Blocos candidatos:** PICO, desenho, números principais, segurança, aplicabilidade, limitações, fonte.
- **Não inferir:** concealment, cegamento, adherence, poder, análise ITT, causalidade para outcomes não
  testados ou força de recomendação quando não informados.

#### Coorte

- **Perguntas:** quem foi acompanhado, qual exposição, comparador, outcome, duração, perdas e ajustes?
- **Precedência:** fonte/população, N, exposição, baseline, follow-up, incidência, estimate bruto/ajustado,
  intervalos, covariáveis declaradas, perdas e limitações.
- **Armadilhas:** associação como causalidade; residual confounding; immortal time; seleção, aferição e
  attrition bias; misturar risco absoluto e relativo.
- **Blocos candidatos:** população/exposição, linha do tempo, outcome, estimativas, ajuste, vieses, fonte.
- **Não inferir:** causalidade, ausência de confusão, representatividade ou ajuste adequado sem relato.

#### Caso-controle

- **Perguntas:** como casos e controles foram definidos/selecionados, qual exposição prévia e quais ajustes?
- **Precedência:** definição do caso, origem e matching dos controles, N, janela de exposição, odds ratio,
  intervalos, ajustes e limitações.
- **Armadilhas:** recall/selection bias; interpretar odds ratio como risco relativo fora de condições
  apropriadas; temporalidade incerta; overmatching.
- **Blocos candidatos:** seleção, exposição, comparabilidade, estimativa, ajustes, vieses, fonte.
- **Não inferir:** incidência, risco absoluto, causalidade ou representatividade populacional.

#### Transversal

- **Perguntas:** qual população e momento, como exposição/outcome foram medidos e qual prevalência ou
  associação foi observada?
- **Precedência:** amostragem, N, período, definições, prevalência, associações, intervalos e não resposta.
- **Armadilhas:** causalidade e temporalidade; survival/prevalence bias; amostra de conveniência;
  generalização indevida.
- **Blocos candidatos:** retrato da amostra, medidas, prevalência, associações, limites, fonte.
- **Não inferir:** incidência, sequência temporal, risco futuro ou efeito de intervenção.

#### Revisão sistemática

- **Perguntas:** qual pergunta, protocolo/busca, critérios, desenhos incluídos, síntese e risco de viés?
- **Precedência:** bases/período quando informados, critérios, número e desenho dos estudos, população,
  síntese, risco de viés, consistência e limitações.
- **Armadilhas:** chamar revisão sistemática de meta-análise sem pooling; confiar só no número de estudos;
  ignorar busca, heterogeneidade clínica e qualidade dos incluídos.
- **Blocos candidatos:** pergunta, busca/seleção, corpus, síntese, risco de viés, lacunas, fonte.
- **Não inferir:** completude da busca, certeza da evidência, magnitude combinada ou ausência de publication
  bias se não reportados.

#### Meta-análise

- **Perguntas:** qual pergunta, quantos/quais desenhos, N total, qual effect estimate, heterogeneidade,
  sensibilidade e risco de viés?
- **Precedência:** critérios, estudos e população total, modelo, estimate e intervalo, heterogeneidade,
  sensibilidade/subgrupos, risco de viés reportado, consistência e limitações.
- **Armadilhas:** tratar pooling como garantia de qualidade; ignorar heterogeneidade; confundir efeito
  relativo/absoluto; cherry-picking de subgrupo; assumir ausência de publication bias.
- **Blocos candidatos:** corpus, forest-style numbers quando sustentados, heterogeneidade, robustez, vieses,
  aplicabilidade, fonte.
- **Não inferir:** certeza/GRADE, qualidade uniforme, causalidade além dos desenhos incluídos ou benefício
  individual.

#### Guideline/diretriz

- **Perguntas:** quem emitiu, para qual escopo/população, qual recomendação e como força/certeza foram
  reportadas?
- **Precedência:** organização, versão/data, escopo, população, recomendação fiel, força somente quando
  informada, framework/certeza somente quando informado, exceções e fonte.
- **Armadilhas:** confundir guideline com estudo primário; esconder contexto; universalizar; inventar
  força; declarar mudança sem comparar versões confiáveis.
- **Blocos candidatos:** autoridade/versão, para quem, recomendação, força/certeza rotuladas, condições,
  implementação, fonte.
- **Não inferir:** independência, consenso, força, GRADE, atualização ou mudança de prática não explícitos.

#### Relato de caso

- **Perguntas:** qual observação clínica, sequência temporal, intervenção/curso e por que merece atenção?
- **Precedência:** contexto anonimizado fornecido, timeline, achados, intervenção, desfecho, explicações
  alternativas e mensagem dos autores.
- **Armadilhas:** generalizar; estimar frequência; provar causalidade/eficácia; sensacionalizar raridade.
- **Blocos candidatos:** caso, timeline, observação, alternativas, aprendizado limitado, fonte.
- **Não inferir:** incidência, risco, eficácia, causalidade ou recomendação generalizável.

#### Editorial/commentary

- **Perguntas:** quem argumenta, qual tese, em resposta a qual evidência/contexto e quais conflitos/limites
  foram informados?
- **Precedência:** autoria, gênero, tese, evidências citadas quando disponíveis, contexto, contrapontos e
  conflitos declarados.
- **Armadilhas:** apresentar opinião como resultado original, recomendação formal ou consenso; omitir que
  não é estudo primário.
- **Blocos candidatos:** natureza do texto, argumento, suporte, contraponto, limites, fonte.
- **Não inferir:** método, estimate, certeza, consenso ou recomendação institucional.

#### Outros

- **Perguntas:** que gênero a fonte realmente declara e quais alegações podem ser sustentadas?
- **Precedência:** publication type original, metadata, objetivo declarado, conteúdo disponível e fonte.
- **Armadilhas:** forçar gramática errada; transformar fallback técnico em categoria científica; inventar
  método para preencher layout.
- **Blocos candidatos:** “tipo não determinado”, o que está disponível, o que falta, fonte.
- **Não inferir:** desenho, nível de evidência, causalidade, qualidade ou aplicabilidade.

### Eixo B — famílias de experiência de leitura

|   # | Família candidata          | Definição e pergunta do teste                                                                    | Dependência/risco principal                         |
| --: | -------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
|   1 | Resumo convencional        | Síntese científica objetiva. Testar se resumir já entrega valor suficiente.                      | Pode virar commodity ou apagar nuances.             |
|   2 | Dose / briefing            | Curto e escaneável: o que aconteceu, por que interessa, resultado, limitação, população e fonte. | “Por que interessa” pode exceder a fonte.           |
|   3 | Notícia científica         | Lead → contexto → estudo → resultado → ressalva → fonte, com responsabilidade científica.        | Narrativa pode dramatizar ou ocultar método.        |
|   4 | Conversa                   | Perguntas profissionais: o que estudaram, encontraram, importância, em quem e ressalva.          | Informalidade excessiva pode reduzir rigor.         |
|   5 | Numbers first              | Começar por números relevantes quando interpretáveis e sustentados.                              | Número sem denominador/contexto engana.             |
|   6 | Technical / evidence sheet | Alta densidade, estrutura informacional, pouca narrativa.                                        | Sobrecarga e falsa precisão.                        |
|   7 | Journal club               | Pergunta → método → resultado → interpretação → crítica.                                         | “Crítica” exige material e competência adequados.   |
|   8 | Newsletter                 | Artigo dentro de edição finita de atualização.                                                   | Cadência pode fabricar urgência.                    |
|   9 | Daily Dose                 | Poucos itens relevantes, conjunto finito.                                                        | Temas lentos podem gerar vazio ou ruído.            |
|  10 | Weekly Dose                | Curadoria restrita e contextualizada.                                                            | Pode atrasar novidade ou misturar relevâncias.      |
|  11 | Cards / finite swipe       | Leitura visual rápida em conjunto explicitamente finito.                                         | Swipe pode favorecer superficialidade/compulsão.    |
|  12 | Visual explainer           | Números, diagramas, timelines, efeito, comparação e estrutura do estudo.                         | Visual pode insinuar dado ausente ou certeza.       |
|  13 | Audio brief                | Versão curta para consumo sem tela.                                                              | Provenance e números são mais difíceis de conferir. |
|  14 | Paper Q&A                  | Perguntas sobre uma publicação, grounded no material disponível.                                 | Resposta pode extrapolar cobertura.                 |
|  15 | Topic Q&A                  | Exploração sustentada por múltiplas publicações.                                                 | Exige corpus, recuperação e síntese mais maduros.   |
|  16 | “What this adds”           | O que já sabíamos versus o que este estudo acrescenta. Hipótese futura.                          | Exige conhecimento longitudinal confiável.          |
|  17 | Evidence timeline          | Evolução verificável de um tema no tempo.                                                        | Cobertura incompleta distorce trajetória.           |
|  18 | Guideline diff             | O que mudou entre duas versões confiáveis. Potencial comercial a testar.                         | Só é possível com versões comparáveis e completas.  |
|  19 | Multi-paper synthesis      | Síntese de vários trabalhos sobre uma pergunta.                                                  | Seleção, conflitos e certeza exigem governança.     |
|  20 | Original + Dose            | Conteúdo Dose com acesso extremamente claro à evidência original.                                | Link não prova direito, acesso nem full text.       |

Nenhuma família é vencedora. Formatos podem ser combinados somente após testes isolarem sua contribuição.

## 6. Profundidade de leitura

**HIGH-PRIORITY HYPOTHESIS TO TEST:** uma mesma publicação pode possuir duas densidades:

- **“Dose” (nome provisório):** rápida, editorial, escaneável, atraente e suficiente para compreensão em
  pouco tempo;
- **“Aprofundar” (nome provisório):** técnica, densa, estruturada e orientada a método, números e
  limitações.

Os nomes não estão aprovados e dois modos não estão selecionados. Esta arquitetura deve ser comparada com:

### Experiência progressiva única

Uma única página começa simples e revela profundidade progressivamente. O teste deve comparar:

- **A — dois modos distintos:** fronteira clara e escolha explícita, com risco de duplicação ou perda de
  contexto na troca;
- **B — experiência progressiva única:** continuidade e menos decisão inicial, com risco de página longa,
  hierarquia ambígua ou profundidade escondida.

Medir compreensão, tempo até entendimento, descoberta de detalhes, confiança, retorno à camada anterior,
esforço percebido e escolha autônoma — não apenas cliques em “aprofundar”.

## 7. Uma verdade subjacente, múltiplas apresentações

**PROPOSED EDITORIAL PRINCIPLE:** “A apresentação pode mudar. A verdade subjacente não.”

Arquitetura conceitual candidata:

> SOURCE → NORMALIZED FACTS → SCIENTIFIC INTERPRETATION → PRESENTATION A / B / C

Evitar pipelines independentes nos quais uma IA cria notícia, outra cria técnico e outra cria conversa sem
base factual comum. Formatos devem herdar os mesmos fatos, ausências e limites, ainda que selecionem ordem,
densidade ou linguagem diferentes.

### Representação factual antes da experiência

Antes de experimentar linguagem em escala, considerar uma representação estruturada **sem definir schema
nesta tarefa**:

- **RCT:** tipo, população, N, intervenção, comparador, follow-up, outcome, effect estimate, intervalos,
  adverse events, limitações e fonte disponível;
- **meta-análise:** pergunta, estudos, N total, critérios, estimate, heterogeneidade, sensibilidade, risco de
  viés reportado e limitações;
- **guideline:** autoridade, escopo, população, recomendação, força quando reportada, framework de certeza
  quando reportado, versão e data.

Campos ausentes permanecem ausentes. A representação deve distinguir fato da fonte, transformação,
interpretação e apresentação; não deve prometer fact-checking sem processo verificável.

## 8. Confiança, cobertura e personalização

### Transparência de cobertura

**HYPOTHESIS TO VALIDATE:** informar a base da análise pode aumentar confiança, responsabilidade,
diferenciação e compreensão dos limites. Exemplos conceituais:

- “Base desta análise: metadata + abstract.”
- “Base desta análise: texto completo.” — somente se isso for futuramente verificado e autorizado.
- “Não foi possível verificar esta informação no material disponível.”

Testar se usuários compreendem a diferença e se a transparência melhora decisões, sem interpretar um selo
como garantia de correção. A baseline atual permite afirmar somente metadata + abstract quando o abstract
existe; full text é **VERIFIED EXISTING CONSTRAINT: não representado no pipeline atual**.

### Personalização explicável

**HIGH-PRIORITY HYPOTHESIS TO TEST:** uma camada “Por que isto apareceu para mim?” pode explicar tema,
especialidade, tipo de publicação, intervenção acompanhada ou recência. Cada razão só pode aparecer se
sustentada por dados.

Separar sempre:

- “relevante para seus interesses”;
- “evidência forte”;
- “deve mudar prática”.

A primeira não prova as outras. “Nova guideline”, “nova meta-análise” ou “intervenção acompanhada” só
podem ser mostradas quando classificação e correspondência forem verificáveis.

### Títulos e headlines

Testar título original, título editorial informativo, título narrativo, pergunta e finding-first. Manter:

- **INVARIANT:** sem clickbait, exagero, causalidade indevida ou termos como “cura”, “revoluciona”, “muda
  tudo” e “chocante”;
- **INVARIANT:** surrogate não vira benefício clínico; significância não vira importância clínica;
  ausência de significância não vira equivalência;
- **INVARIANT:** o título original deve continuar identificável quando outro headline for usado.

Metáforas e trocadilhos não são proibidos definitivamente, mas devem ser comparados quanto à precisão,
compreensão e percepção de rigor. Se exigirem explicar a piada ou enfraquecerem confiança, devem ser
abandonados.

### Interesse sem sensacionalismo

Fontes legítimas de interesse incluem pergunta relevante, surpresa verdadeira, contraste, novidade,
contexto, magnitude, população/intervenção nova, safety signal, inconsistência com evidência anterior,
nova guideline e atualização relevante. Cada uma requer suporte; nem toda publicação é novidade.

**PROPOSED PRODUCT PRINCIPLE:** “O Dose deve poder concluir que não há nada importante para mostrar.”

## 9. Finitude, hábito e retorno intencional

Testar experiências finitas como “3 publicações novas correspondem aos seus temas”, “Você viu as
atualizações desta semana” ou “Não houve novidades relevantes neste tema desde sua última visita”. O
fechamento informa estado do monitoramento; não exige ler tudo nem premia consumo compulsivo.

Uma contagem precisa de universo, cobertura ou novidade só pode ser exibida quando seu denominador,
janela e fontes forem verificáveis. Fechamento pode significar “fim deste conjunto”, não “toda a ciência
foi coberta”. Hábito desejável é retorno porque algo relevante mudou ou porque o usuário escolheu retomar,
não retorno por culpa.

### Gamificação

**DECISION DEFERRED:** streak, metas, badges, mascote, progresso, conquistas, quiz, flashcards e spaced
repetition serão avaliados, se houver autorização futura, separadamente. Cada mecanismo deve responder:

1. melhora aprendizagem?
2. melhora compreensão?
3. melhora confiança?
4. reduz fricção?
5. cria valor real?
6. ou apenas aumenta tempo de tela?

“Aumenta consumo” não é razão suficiente para adoção.

## 10. Métricas de experimentação

Nenhuma North Star é selecionada. Combinar observação, tarefa de compreensão, comportamento e entrevista;
nenhuma métrica isolada demonstra valor.

| Grupo            | Métricas candidatas                                                                                              | Interpretação/guardrail                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Relevância**   | pertinência avaliada; abertura voluntária; compreensão do “por que apareceu”; descarte justificado               | Abertura pode refletir headline, não relevância real.                         |
| **Compreensão**  | explica o achado principal; interpretação correta; distingue resultado e limitação; identifica população/desenho | Autoavaliação não substitui tarefa objetiva; não avaliar memória irrelevante. |
| **Eficiência**   | tempo até entender; esforço percebido; informação útil por minuto; tempo evitado autorrelatado                   | Tempo baixo com interpretação errada é falha.                                 |
| **Confiança**    | identifica fonte; distingue original/editorial/gerado; reconhece material disponível; calibra confiança          | Clique na fonte pode indicar confiança ou desconfiança; perguntar contexto.   |
| **Profundidade** | aprofunda quando deseja; encontra números, método, limitações e original; escolhe encerrar sem penalidade        | Mais abertura não é sempre melhor; medir adequação à intenção.                |
| **Retorno**      | retorno voluntário; frequência adequada ao perfil; alertas úteis; continuidade temática                          | DAU sem novidade ou necessidade pode ser ruído/compulsão.                     |
| **Valor**        | sentiria falta; recomendaria; usaria na rotina; substituiu trabalho manual; sessão unitária resolveu o job       | Intenção declarada não prova retenção nem pagamento.                          |
| **Comercial**    | disposição a pagar; por qual resultado; recurso valorizado; commodity; diferencial percebido; troca real         | Clique ou elogio não equivale a pagamento.                                    |

### Métricas que não devem dominar

Tempo de tela, pageviews, papers consumidos, scroll depth isolado, DAU sem contexto, streak length e cliques
por sessão podem ser observados como diagnóstico, mas não são proxies automáticos de valor. Session
duration maior pode significar pior scanability; mais papers pode significar priorização ruim; mais scroll
pode significar conteúdo enterrado; mais cliques pode significar fricção.

## 11. Matriz conceitual de experimentos

`Resultado` e `decisão` permanecem **NOT VERIFIED**. Critérios numéricos serão pré-registrados após piloto
de mensuração; não são inventados neste documento.

| experiment_id | Tipo de evidência | Formato                                   | Profundidade       | Hipótese                                                                    | Material necessário                                       | Risco científico                     | Risco de UX                  | Métrica principal                       | Métrica secundária            | Critério de sucesso                                                      | Critério de abandono                                            | Estágio | Resultado        | Decisão               |
| ------------- | ----------------- | ----------------------------------------- | ------------------ | --------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------ | ---------------------------- | --------------------------------------- | ----------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- | ------- | ---------------- | --------------------- |
| SX-01         | RCT               | metadata + abstract vs resumo vs briefing | única curta        | briefing reduz esforço sem perder interpretação                             | mesmo RCT real, material permitido, gabarito revisado     | omitir endpoint/limitação            | simplificação excessiva      | interpretação correta                   | esforço percebido             | não inferior em correção e claramente mais eficiente no segmento testado | erro material recorrente ou eficiência sem compreensão          | Fase 1  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-02         | RCT               | numbers-first vs technical sheet          | curta vs densa     | números primeiro aceleram orientação quando há denominador/contexto         | RCT com estimates e intervalos disponíveis                | destacar número secundário/surrogate | intimidar leitor             | tempo até entendimento correto          | confiança calibrada           | ganho de tempo sem aumento de erro ou falsa certeza                      | confusão entre efeito relativo/absoluto ou endpoint             | Fase 1  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-03         | Meta-análise      | briefing vs journal club                  | curta vs densa     | gramática específica melhora leitura de heterogeneidade/limites             | meta-análise real com dados suficientes                   | pooling parecer certeza              | carga cognitiva              | compreensão de efeito + heterogeneidade | utilidade                     | mais usuários identificam resultado e ressalva relevante                 | formato encobre desenhos incluídos ou risco de viés             | Fase 2  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-04         | Guideline         | notícia vs evidence sheet                 | curta vs densa     | estrutura por recomendação melhora localização sem inventar força           | guideline com versão, recomendação e framework declarados | parafrasear mudando força            | densidade/escaneabilidade    | fidelidade da recomendação              | tempo para localizar condição | recomendação e qualificadores recuperados corretamente                   | força/certeza confundida ou condição perdida                    | Fase 2  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-05         | Observacional     | conversa vs resumo                        | curta              | perguntas profissionais ajudam a separar associação e causalidade           | coorte/caso-controle real, revisão de resposta            | causalidade indevida                 | tom pouco profissional       | interpretação causal correta            | preferência                   | melhora ou preserva correção com menor esforço                           | linguagem induz causalidade ou reduz confiança                  | Fase 2  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-06         | Múltiplos         | dois modos vs página progressiva          | dupla/progressiva  | usuários escolhem profundidade sem perder contexto                          | mesmos artigos e conteúdo factual nas duas arquiteturas   | versões divergirem                   | modo escondido/decisão extra | compreensão adequada à intenção         | descoberta de detalhes        | escolha compreendida e detalhe encontrado com menos fricção              | verdade diverge entre camadas ou detalhes essenciais somem      | Fase 3  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-07         | Múltiplos         | explicação de cobertura                   | qualquer           | declarar metadata + abstract calibra confiança                              | protótipos com base real e ausências                      | selo virar garantia                  | ruído visual                 | identificação da cobertura              | confiança calibrada           | melhora reconhecimento de fonte/limites sem bloquear tarefa              | não é compreendido ou cria certeza indevida                     | Fase 3  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-08         | Múltiplos         | “por que apareceu”                        | feed finito        | explicação de personalização aumenta relevância percebida sem sugerir força | matches reais/auditáveis                                  | confundir relevância e evidência     | excesso de labels            | distinção entre conceitos               | pertinência                   | maioria distingue interesse de força e entende razão                     | mensagem induz recomendação clínica/importância                 | Fase 4  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-09         | Múltiplos         | edição finita vs lista contínua           | lote               | fechamento aumenta controle sem obrigar conclusão                           | lote real, janela/fontes delimitadas                      | claim de cobertura excessivo         | pressão para completar       | controle percebido                      | retorno intencional           | menos carga sem queda de itens pertinentes encontrados                   | usuários sentem omissão ou obrigação sistemática                | Fase 4  | **NOT VERIFIED** | **DECISION DEFERRED** |
| SX-10         | Guidelines        | guideline diff                            | técnica/contextual | mudança verificável gera valor diferenciado                                 | duas versões confiáveis e completas, revisão especialista | falso diff/contexto perdido          | comparação complexa          | precisão das mudanças                   | disposição a pagar            | mudanças e invariantes identificados corretamente e considerados úteis   | qualquer mudança material errada/omitida ou corpus insuficiente | Fase 5  | **NOT VERIFIED** | **DECISION DEFERRED** |

### Regra para manter, combinar ou abandonar

- **Manter:** formato atinge o job pré-registrado, respeita invariants, não piora compreensão/confiança e
  apresenta benefício claro para segmento/tipo definido.
- **Combinar:** componentes diferentes trazem benefícios complementares demonstrados, a base factual
  permanece única e a combinação supera cada parte sem complexidade desproporcional.
- **Abandonar:** produz erro material, falsa certeza, confusão de provenance, causalidade indevida,
  benefício apenas em métricas de consumo, ausência consistente de ganho ou custo/complexidade maior que
  o valor observado.
- **Iterar antes de decidir:** resultado inconclusivo, amostra/material inadequado, problema de copy ou
  instrumentação. Inconclusivo não é sucesso.

## 12. Sequência dos primeiros testes

### Fase 1 — offline/controlada

Usar o mesmo paper real e o mesmo conjunto factual em: A) metadata + abstract original; B) summary
convencional; C) Dose/briefing; D) notícia científica; E) conversa; F) numbers-first; G) técnico
estruturado. Randomizar ordem, usar tarefas equivalentes, registrar base disponível e revisão científica.
Objetivo: eliminar rapidamente formatos fracos, não declarar vencedor universal.

### Fase 2 — entre tipos de evidência

Repetir com RCT, meta-análise, guideline, observacional e revisão sistemática. Objetivo: testar se a
gramática por tipo melhora compreensão e evita armadilhas. Não comparar formatos com materiais de
dificuldade radicalmente diferente sem controle.

### Fase 3 — combinações

Comparar Dose + Aprofundar, briefing progressivo, notícia + technical sheet, conversa + evidence e
newsletter + aprofundamento. Isolar contribuição dos componentes e verificar consistência factual.

### Fase 4 — protótipo de produto

Usuários reais usam por dias/semanas com conjuntos finitos, estados de ausência e opção de fonte. Avaliar
sessão unitária, retorno intencional, confiança e adequação da frequência. Protótipo não prova operação em
produção.

### Fase 5 — monetização

Somente após valor observado, testar o que é commodity e pelo que haveria troca real: summary,
monitoramento, curadoria, aprofundamento, guidelines, contexto longitudinal, multipaper synthesis ou
combinação. Não definir preço, plano ou paywall nesta fase documental.

### Disciplina comum aos testes

1. pré-registrar hipótese, segmento, material, métrica principal, guardrails e critério de abandono;
2. usar publicações reais e legalmente utilizáveis, sem chamar protótipo de pipeline operacional;
3. manter fatos constantes entre variantes e revisar outputs antes da exposição;
4. testar compreensão com perguntas que detectem exagero, causalidade e limite, não trivia;
5. registrar erros e efeitos por tipo de evidência e experiência profissional;
6. não inferir retenção de teste curto nem disposição a pagar de preferência declarada;
7. publicar resultado negativo/inconclusivo no registro interno e não promover hipótese por entusiasmo.

## 13. Dataset editorial de laboratório

**HYPOTHESIS TO VALIDATE / proposta conceitual:** montar futuramente um conjunto pequeno, diverso e
versionado de publicações reais: alguns RCTs, meta-análises, revisões sistemáticas, coortes, casos-controle,
transversais, guidelines, relatos de caso, editoriais e exemplos `other`. O objetivo é qualidade do teste,
não escala.

Critérios futuros: variedade de populações/outcomes, presença e ausência intencional de campos, efeitos
nulos/positivos, segurança, abstracts estruturados/não estruturados, diferentes níveis de complexidade e
fontes/licenças documentadas. Cada item precisa de base de cobertura, provenance e gabarito de
interpretação revisado. **Nesta tarefa não houve seleção de papers, ingestão nem chamada a PubMed, Europe
PMC ou Crossref.**

## 14. Hipóteses comerciais

Todas as linhas são **HYPOTHESIS TO VALIDATE**, sem preço ou plano:

- summaries podem se tornar commodity;
- monitoramento personalizado pode gerar mais valor que um summary isolado;
- curadoria pode gerar valor pela redução responsável do universo;
- contexto longitudinal pode gerar valor por preservar o que mudou;
- guideline updates e “o que mudou” podem gerar valor quando verificáveis;
- aprofundamento técnico pode gerar valor para decisões de leitura e discussão profissional;
- multipaper synthesis pode gerar valor, mas exige maturidade científica maior;
- explicabilidade e personalização podem gerar confiança, não apenas engagement;
- a combinação de coverage, continuity e comprehension pode valer mais que cada feature;
- uma sessão de um único paper pode gerar alto valor mesmo sem frequência diária.

Willingness-to-pay deve identificar **pelo quê** o usuário pagaria e exigir compromisso progressivamente
mais real; elogio, tempo de tela ou clique em fake door não bastam.

## 15. O que o Dose não deve se tornar

Não assumir como objetivo: TikTok científico; feed infinito; portal de manchetes; agregador de abstracts;
chatbot genérico; resumidor de PDF; plataforma educacional gamificada obrigatória; ferramenta de
diagnóstico; recomendação clínica automática; substituto de leitura crítica; avaliação automática de
certeza; GRADE automático; gerador de conclusões mais fortes que as fontes.

Esta lista limita objetivos, mas não afirma que a experiência final já foi escolhida.

## 16. Decisões que continuam adiadas

**DECISION DEFERRED:** formato vencedor; número final de modos; nomes finais; Daily versus Weekly;
gamificação; quiz; streak; áudio; formato final de cards; design final; IA/provider/modelo; prompt runtime;
preço; Free/Pro; paywall; limite de summaries; recursos premium; estratégia definitiva de full text;
número de itens por edição; sistema definitivo de notificações.

Também permanecem abertas: segmento inicial; cadência por tema; combinação de famílias; definição
operacional de “importante”; governança editorial; quem revisa; limiares métricos; tamanho amostral;
direitos por fonte; arquitetura factual; estratégia de correção/retirada; e se a experiência deve ser
primariamente feed, edição, busca, artigo ou uma combinação.

## 17. Registro de certeza e não-verificação

Vocabulário obrigatório deste programa:

- **VERIFIED EXISTING CAPABILITY:** encontrado na implementação local; não implica produção saudável.
- **VERIFIED EXISTING CONSTRAINT:** limite encontrado e relevante ao desenho.
- **INVARIANT:** limite científico/editorial que experimento não pode negociar.
- **PROPOSED PRODUCT PRINCIPLE:** princípio candidato, ainda não Product Truth.
- **PROPOSED EDITORIAL PRINCIPLE:** princípio editorial candidato, ainda sujeito a aprovação.
- **HYPOTHESIS TO VALIDATE:** expectativa a testar.
- **HIGH-PRIORITY HYPOTHESIS TO TEST:** hipótese priorizada, não decisão.
- **DECISION DEFERRED:** escolha explicitamente adiada.
- **NOT VERIFIED:** sem evidência suficiente nesta tarefa.

**NOT VERIFIED:** qual formato vence; se duas profundidades superam progressão única; se users compreendem
os rótulos; se a gramática melhora decisões; se personalização é relevante; se finitude gera retorno; se
transparência aumenta confiança; se qualquer formato reduz tempo com correção; se existe disposição a
pagar; se summaries são commodity; se Daily/Weekly, áudio, visual, Q&A, guideline diff, timeline ou
multipaper synthesis criam valor; se gamificação ajuda; e todas as métricas/resultados futuros.

**NOT VERIFIED:** produção, Supabase/Vercel remotos, migrations aplicadas, dados persistidos, ingestão,
cobertura, full text/direitos, execução de IA, custos, qualidade clínica/editorial, telemetria, retenção,
mercado e integração externa. O documento não converte existência de código em saúde operacional.

## 18. Guardrail final para decisão

Uma experiência só pode avançar se facilitar compreensão correta e escolha de profundidade sem violar os
invariants. Ganho de abertura, scroll, duração, frequência ou consumo não compensa erro científico,
provenance opaca, falsa certeza ou pressão compulsiva. A melhor experiência pode terminar cedo, terminar
sem novidade ou entregar todo o valor em uma única publicação.
