# Dose — Product + Monetization Blueprint

**Status:** `STRATEGIC DRAFT — NOT APPROVED PRODUCT TRUTH`

Este documento é uma proposta estratégica para revisão. Ele **não substitui `AGENTS.md`**, não aprova
decisões finais de produto e não autoriza implementação, mudança de UI, ativação de pipeline, cobrança,
chamada de IA ou operação remota. Core Job, “uma Dose”, ativação, retenção, segmentação, Free/Pro,
Premium Value Thesis, métricas e roadmap abaixo permanecem propostas ou hipóteses até aprovação
explícita posterior.

## 0. Como ler este Blueprint

### Vocabulário de evidência

- **VERIFIED EXISTING DECISION** — regra ou limite explicitamente documentado no repositório.
- **VERIFIED EXISTING CAPABILITY** — implementação encontrada no código; não implica deploy, dados ou
  funcionamento em produção.
- **PROPOSED PRODUCT DECISION** — direção recomendada, ainda não aprovada.
- **HYPOTHESIS TO VALIDATE** — relação causal ou expectativa que exige evidência com usuários/dados.
- **NOT VERIFIED** — não foi possível demonstrar pelo repositório local.

A hierarquia de certeza deste documento é: **evidência verificada → princípio proposto → hipótese →
experimento → decisão explicitamente adiada**. Uma ideia persuasiva ou promissora não salta etapas e não
se torna requisito de arquitetura por estar escrita aqui.

### Baseline verificado no repositório

| Estado                           | Evidência local e consequência para este Blueprint                                                                                                                                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VERIFIED EXISTING CAPABILITY** | A Home atual monta uma “edição de hoje” e progresso a partir do catálogo estático em `src/lib/content.ts`; as telas de artigo e arquivo também consomem esse conteúdo local. Isso é uma experiência/protótipo existente, não prova uma Dose científica dinâmica.                                                                         |
| **VERIFIED EXISTING CAPABILITY** | O onboarding autenticado lê catálogo remoto de especialidades/tópicos e persiste interesses por fronteiras server-side. Esses interesses oferecem uma base técnica para personalização, sem provar a qualidade percebida dela.                                                                                                           |
| **VERIFIED EXISTING CAPABILITY** | Existe serviço server-only de feed autenticado, com seleção por interesses, ranking determinístico, cursor e componentes de score. A busca no código não encontrou consumidor desse serviço nas rotas/componentes de UI. Logo, não será tratado como produto conectado.                                                                  |
| **VERIFIED EXISTING DECISION**   | Relevância personalizada não equivale a qualidade científica; o ranking atual usa correspondência temática, tipo de estudo, recência, completude objetiva e preferência por salvo, sem fator de impacto ou alegação de “melhor estudo”.                                                                                                  |
| **VERIFIED EXISTING CAPABILITY** | Existe pipeline server-only de ingestão de metadata e abstract, sem representar ou buscar full text; há adapters para PubMed, Europe PMC e Crossref e uma rota de piloto controlada.                                                                                                                                                     |
| **VERIFIED EXISTING CAPABILITY** | Existe infraestrutura server-only de resumo estruturado, com schema, elegibilidade, proveniência `abstract_and_metadata`, validações, fake determinístico, adapter OpenAI injetável e configuração desabilitada por padrão. Não foi encontrado endpoint público de geração nem consumo pela UI.                                          |
| **VERIFIED EXISTING CAPABILITY** | Existem domínio e persistência de billing/entitlements, reconciliação transacional e fake provider offline. A UI de planos/pagamento é protótipo, informa que cobrança está indisponível, e gates visuais ainda consultam plano local. Não há gateway real instalado/ativado.                                                            |
| **VERIFIED EXISTING CAPABILITY** | Biblioteca, notas, coleções e progresso possuem persistência remota para sessão autenticada, com estado local como cache; a UI atual os associa aos IDs do conteúdo local. São possíveis sinais de continuidade, mas seu valor para literatura real não está demonstrado.                                                                |
| **VERIFIED EXISTING DECISION**   | Sessão Supabase validada é autoridade de identidade; onboarding remoto e entitlements server-side não podem ser substituídos por estado local.                                                                                                                                                                                           |
| **VERIFIED EXISTING DECISION**   | Metadata, abstract, full text, conteúdo editorial, classificação/ranking e resumo de IA devem permanecer distintos; demo não pode se passar por literatura real e o feed não pode disparar IA implicitamente.                                                                                                                            |
| **NOT VERIFIED**                 | Deploy saudável, migrations efetivamente aplicadas, catálogo populado, ingestão piloto executada, regras classificando dados reais, summaries reais gerados, feed retornando resultados reais, provider de pagamento, telemetria de produto, direitos de full text, qualidade clínica/editorial e comportamento de usuários em produção. |

Arquivos de migrations e runbooks são evidência de preparação versionada, não de aplicação remota. O
Blueprint, portanto, parte de **infraestrutura preparada + experiência local ainda desconectada**, e não
de um produto científico/monetizado validado.

---

## 1. Tese central do produto

**PROPOSED PRODUCT DECISION — problema:** o inimigo não é apenas outro software. É o conjunto de volume,
fragmentação, buscas repetitivas, inbox científico, favoritos dispersos, falta de priorização, “depois eu
vejo” e sensação de tarefa infinita. Os substitutos incluem PubMed manual, newsletters, alertas, grupos,
colegas, redes sociais, busca ocasional e não fazer nada. Nenhuma preferência de mercado entre essas
alternativas foi verificada.

**PROPOSED PRODUCT DECISION — promessa:** o Dose acompanha a literatura que corresponde aos interesses
declarados, reduz o conjunto, explica por que algo merece atenção e torna explícito o que mudou — sem
substituir a fonte nem prometer completude impossível.

A mudança de categoria proposta é de ferramenta reativa para serviço contínuo:

- **Ferramenta:** usuário lembra → abre → procura → filtra → lê.
- **Dose:** literatura aparece → Dose encontra → classifica → relaciona aos interesses → prioriza →
  prepara a experiência → usuário chega e encontra o trabalho adiantado.

**HYPOTHESIS TO VALIDATE:** parte importante do valor existe fora da sessão: saber que um serviço
delimitado estava acompanhando o escopo escolhido enquanto o usuário não estava no aplicativo. O usuário
não pagaria apenas pelo que acontece diante da tela, mas pelo trabalho recorrente preparado entre visitas.
“Saiba o que mudou na sua área sem precisar procurar” expressa essa delegação, mas não é tagline aprovada
e precisa sempre comunicar fontes, escopo e limitações.

O fluxo conceitual é:

> ciência nova → descoberta → classificação → personalização → priorização → apresentação →
> compreensão → ação do usuário → histórico → nova Dose

Cada seta exige observabilidade e fallback. Se descoberta ou classificação não estiver ativa, a
interface não deve fingir continuidade.

### One-Sentence Product Thesis — candidatas, não tagline final

1. **Serviço e operação:** “Um serviço de atualização científica personalizado que encontra, prioriza e
   organiza o que mudou nos temas que você acompanha.” É a opção mais concreta sobre o trabalho feito.
2. **Alívio:** “Uma forma de acompanhar sua área sem transformar atualização científica em outra tarefa
   infinita.” Lidera com carga mental, mas explica menos o mecanismo.
3. **Delegação:** “O Dose acompanha seu escopo científico e prepara o que merece atenção antes de você
   precisar procurar.” Comunica trabalho entre visitas, mas exige qualificação forte de cobertura.
4. **Resultado:** “Literatura nova, reduzida a uma Dose verificável do que merece sua atenção agora.”
   Reforça finitude e confiança, mas pode soar editorialmente mais assertiva.

A formulação futura deve equilibrar desejo e precisão; nenhuma candidata foi validada ou aprovada.

### Arquitetura emocional e luxo funcional

A progressão proposta é **sobrecarga → redução → orientação → controle → confiança → continuidade →
orgulho profissional sereno**. O Dose pode converter uma tarefa infinita em curiosidade administrável:
alívio porque o universo foi reduzido; controle porque escopo e fim são claros; confiança porque tudo é
verificável; continuidade porque o contexto permanece; identidade porque o usuário pode pensar “sou um
profissional que acompanha minha área de maneira criteriosa”.

“Luxo”, como lente de produto e não promessa comercial, significa **esforço evitado**: antecipar uma
necessidade, preparar antes da chegada, selecionar com critério, organizar e devolver tempo. O equivalente
a concierge seria: “acompanhei isto dentro do escopo que você escolheu; aqui está o que merece atenção”.
Não é decoração ostensiva, status público ou magia opaca. A sensação de cuidado depende de o serviço ser
confiável, seletivo e honesto sobre o que não cobriu.

Status e vaidade profissional são forças humanas legítimas para análise, mas não autorizam ranking entre
médicos, badges de superioridade, comparação do tipo “à frente de 87%”, culpa ou ameaça.

### Utility → Desirability → Habit → Willingness to Pay

- **UTILITY:** “isso me ajuda” — um item relevante ou uma boa síntese pode resolver uma tarefa.
- **DESIRABILITY:** “quero isso na minha rotina” — a experiência reduz esforço de forma agradável,
  confiável e antecipada.
- **HABIT:** “volto porque existe mudança relevante para processar” — o gatilho é novidade real, não
  compulsão ou calendário artificial.
- **WILLINGNESS TO PAY:** “não quero voltar a fazer sozinho o trabalho que este serviço faz por mim” —
  continuidade e delegação justificam assinatura.

Essas frases não são copy final. Uma feature pode ser útil sem gerar desejo; um produto desejável pode
ser usado episodicamente; uso frequente pode não gerar pagamento. Cada transição é hipótese separada.

## 2. Psicologia de compra legítima

Os motivadores abaixo são possibilidades de valor, não evidência de demanda.

| Motivador                            | Dor ou desejo                                                        | Como o Dose pode atender                                                        | Limite ético: como não explorar                                                                       | Comportamento que provaria valor                                                    |
| ------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Comodidade e economia de tempo       | Repetir buscas e reconciliar fontes compete com trabalho e descanso. | Preparar uma seleção curta, com fonte e razão de inclusão.                      | Não inventar “horas economizadas” nem ocultar resultados para forçar upgrade.                         | Usuário abre prioridades e acessa a fonte com menos busca externa autorrelatada.    |
| Redução de esforço/carga mental      | A tarefa “preciso me atualizar” fica aberta e sem fim claro.         | Dar começo, fim, estado visto/salvo e próximo retorno baseado em novidade real. | Não usar streak, culpa ou tarefas artificiais para manter a pendência.                                | Conclui a Dose ou decide conscientemente adiar/descartar itens.                     |
| Medo legítimo de ficar desatualizado | Mudanças relevantes podem passar despercebidas.                      | Alertar apenas dentro do escopo e explicar cobertura e importância.             | Não fazer ameaça clínica, FOMO, “outros médicos estão à frente” ou insinuar cuidado inferior no Free. | Opta por alertas seletivos e os considera pertinentes.                              |
| Curiosidade                          | Descobertas novas alimentam aprendizagem.                            | Oferecer novidade real e conexão com temas acompanhados.                        | Não usar título clickbait ou inflar significância.                                                    | Explora a fonte/abstract de item não obrigatório e volta ao tema.                   |
| Domínio profissional                 | Quer construir entendimento contínuo, não consumir fatos isolados.   | Preservar, agrupar e reencontrar evidências ao longo do tempo.                  | Não criar score falso de competência ou certificado implícito.                                        | Retorna a itens/temas salvos para apoiar estudo ou discussão.                       |
| Identidade, orgulho e status sutil   | Valoriza ser criterioso e atualizado.                                | Reforçar organização e autonomia privada.                                       | Não criar ranking social, comparação entre médicos ou badge de superioridade.                         | Recomenda o serviço pela utilidade/confiança, não por status performático.          |
| Controle e previsibilidade           | Não sabe quanto há, o que importa ou quando terminou.                | Delimitar janela, universo coberto, prioridades e total restante.               | Não fabricar percentuais como “87% atualizado” sem denominador auditável.                             | Ajusta temas/frequência e entende por que recebe cada item.                         |
| Confiança                            | Resumos e rankings podem distorcer evidência.                        | Expor origem, metadata, transformação, limitações e link original.              | Não disfarçar ranking de relevância como qualidade nem resumo de IA como texto do estudo.             | Consulta proveniência/original e mantém uso após encontrar limitações explicitadas. |
| Continuidade                         | Alertas e salvos fragmentados perdem contexto ao longo do tempo.     | Mostrar o que mudou desde a última visita e manter histórico portátil.          | Não criar lock-in artificial nem reter exportação para ameaçar perda.                                 | Volta após novidade, retoma salvos e reconhece evolução de temas.                   |

### Rejeições explícitas

O Dose não deve usar escassez ou countdown falsos, fake activity, números inventados, “outros médicos
estão na sua frente”, ameaças clínicas, insinuação de que o usuário Free oferece cuidado inferior,
métricas falsas de competência, FOMO artificial, notificações excessivas, ciência escondida para gerar
ansiedade ou clickbait científico. A conversão deve resultar de valor demonstrado e limite honesto.

## 3. Jobs to Be Done

### Jobs centrais propostos

- **Core functional job — PROPOSED PRODUCT DECISION:** “Quando literatura relevante ao meu escopo é
  publicada, ajude-me a perceber o que mudou, priorizar o que merece atenção e chegar à evidência com
  menos busca e triagem manual.”
- **Core emotional job — PROPOSED PRODUCT DECISION:** “Ajude-me a sentir controle e confiança sobre uma
  tarefa recorrente que, de outra forma, parece aberta e infinita.”
- **Core identity/social job — PROPOSED PRODUCT DECISION:** “Ajude-me a sustentar, com discrição e sem
  competição, a identidade de profissional criterioso que acompanha sua área.”

### Decomposição e prioridade conceitual

| Job                                                     | Classe                | Razão                                                                                                                                |
| ------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Descobrir literatura nova dentro do escopo declarado    | **CORE**              | Sem descoberta real, não existe promessa proativa.                                                                                   |
| Evitar pesquisar manualmente múltiplas fontes           | **CORE**              | É a redução de trabalho que sustenta delegação. Cobertura deve ser delimitada.                                                       |
| Distinguir sinal de ruído por relevância pessoal        | **CORE**              | Um feed amplo reproduz o problema original.                                                                                          |
| Decidir o que merece leitura primeiro                   | **CORE**              | Prioridade, explicação e finitude tornam o volume acionável.                                                                         |
| Perceber o que mudou desde a última visita              | **CORE**              | Cria valor recorrente e diferencia atualização de catálogo.                                                                          |
| Abrir metadata/abstract/fonte original com proveniência | **CORE**              | É condição de confiança, não acessório.                                                                                              |
| Entender rapidamente um estudo                          | **SUPPORTING**        | Pode acelerar valor, mas não deve mascarar falta de descoberta/priorização nem depender de IA no MVP.                                |
| Guardar e voltar depois                                 | **SUPPORTING**        | Resolve a transição entre descoberta e leitura; infraestrutura local/remota existe, integração científica real não está demonstrada. |
| Acompanhar um tema ao longo do tempo                    | **SUPPORTING**        | Fortalece continuidade, mas requer histórico e classificação confiáveis.                                                             |
| Receber alerta de evento realmente relevante            | **FUTURE / OPTIONAL** | Pode ampliar retenção, porém exige calibração, consentimento, quiet hours e operação confiável.                                      |
| Comparar evolução temporal de evidências                | **FUTURE / OPTIONAL** | Alto valor potencial e alto risco científico; depende de dados, método e revisão adequados.                                          |
| Personalização automática além de escolhas explícitas   | **FUTURE / OPTIONAL** | Pode melhorar relevância, mas introduz opacidade e precisa de controle/explicabilidade.                                              |

“CORE” aqui indica dependência lógica da tese, não escopo aprovado de MVP.

## 4. Momento mágico e ativação

### Aha moment proposto

Após declarar especialidade e poucos interesses, o usuário vê uma pequena seleção de literatura **real,
recente e reconhecivelmente alinhada** e pensa: “é exatamente isso que eu acompanho”. O momento não é o
cadastro concluído; é reconhecer relevância e confiança em um item concreto.

**Antes:** consentimento e expectativa de cobertura claros; catálogo disponível; preferências remotas
confirmadas; literatura real ingerida/classificada; seleção possível sem conteúdo fictício.

**O que ver:** título científico preservado; fonte/periódico, data e identificador quando existente;
tema correspondente; razão de prioridade em linguagem compreensível; tipo de conteúdo; disponibilidade
de abstract/original; marcação inequívoca se houver transformação editorial ou de IA.

**Atrito aceitável:** pedir apenas o mínimo necessário para gerar uma primeira seleção relevante. Uma
área + interesses explícitos pode ser justificável; questionários longos, metas e preferências finas
devem vir depois do primeiro valor. O usuário precisa poder corrigir escolhas.

**Erros que destroem o momento:** item fora de tema; publicação antiga apresentada como nova; demo
tratada como real; link quebrado; guideline importante omitida sem explicar cobertura; score parecendo
qualidade científica; resumo sem proveniência; vazio disfarçado; promessa de completude; conteúdo local
hardcoded usado como prova de personalização.

**Demonstrar inteligência honestamente:** “priorizado porque corresponde a [tema], foi publicado em
[data] e tem [tipo de estudo]”, quando esses fatores forem verificáveis. Não dizer “escolhido por IA”,
“mais importante” ou “vai mudar sua prática” sem base e revisão compatíveis.

### Eventos candidatos (sem metas numéricas)

- **Activation Event:** recebe uma primeira seleção de literatura real baseada em preferências remotas
  e encontra nela ao menos um item que reconhece como pertinente. A pertinência precisa de sinal
  observável (abrir detalhes/original, salvar ou feedback explícito), não apenas impressão de tela.
- **First Value Event:** toma uma ação informada sobre um item priorizado — ler abstract/detalhes,
  acessar a fonte, salvar ou marcar como não relevante — entendendo por que entrou na seleção.
- **Repeat Value Event:** retorna depois de haver literatura nova e age sobre outra seleção sem refazer
  a busca manual.
- **Retention Event:** repete esse ciclo em janelas distintas ou retoma um tema/salvo porque o histórico
  do Dose preservou continuidade.

Essas definições são **HYPOTHESES TO VALIDATE**; ainda faltam instrumentação, baseline e pesquisa para
escolher o melhor sinal e sua janela.

## 5. O que pode significar “uma Dose”

Uma Dose deve ser uma **quantidade administrável de mudança científica que merece atenção agora** — uma
unidade finita de atenção, não sinônimo de artigo nem alegação de “toda a ciência”. Ela contém um conjunto
delimitado por escopo e tempo, uma ordem explicável e ações de decisão. O nome só é útil se responder:
“qual universo foi considerado?”, “por que estes itens?”, “o que já processei?” e “quando haverá outra?”.

| Modelo                              | Definição                                                                             | Força                                                                | Risco                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A. Seleção diária                   | Pequeno conjunto prioritário por dia.                                                 | Ritmo previsível e fácil de entender.                                | Força cadência artificial quando nada mudou; pode atrasar evento importante ou incentivar hábito vazio.        |
| B. Desde a última visita            | Atualização de tudo que entrou no escopo desde o último corte.                        | Faz continuidade e mudança explícitas.                               | Volume varia; ausência longa pode gerar sobrecarga e “última visita” não equivale a última busca bem-sucedida. |
| C. Seleção periódica por relevância | Curadoria por uma janela comunicada (por exemplo, semanal).                           | Mais tempo para classificação e rotina menos intrusiva.              | Pode ser lenta para temas de alta urgência e inadequada a diferentes segmentos.                                |
| D. Combinação contextual            | Prioridades finitas + demais atualizações, com cadência base e exceções justificadas. | Preserva finitude sem esconder cobertura; adapta-se a novidade real. | É mais complexa de explicar e medir; requer regras de corte e alertas confiáveis.                              |

**PROPOSED PRODUCT DECISION para teste, não escolha final:** começar a pesquisa com D e duas camadas:
**PRIORITIZED LAYER + RELEVANT UNIVERSE FOUND WITHIN THE COVERED SCOPE**. Em linguagem de produto:
“Prioridades da sua Dose” + “Outras atualizações encontradas no seu escopo”. Exemplo somente: se o
sistema encontrar 17 publicações relevantes, mostrar “3 prioritárias + 14 outras atualizações”. Esses
números **não são regra**.

A arquitetura resolve uma tensão central: mostrar pouco demais pode omitir valor; mostrar tudo com a mesma
hierarquia recria PubMed ou feed infinito. A camada priorizada oferece finitude psicológica; a camada do
universo encontrado evita invisibilidade artificial. “Prioritária” precisa de motivo verificável, e
“universo” significa somente o que as fontes e a janela declaradas efetivamente cobriram.

“Terminei minha Dose” deve significar “decidi o que fazer com esta seleção”, nunca “li toda a ciência
existente”.

### Anatomia conceitual

1. **Escopo:** interesses/fontes/janela que a Dose conseguiu consultar.
2. **Prioridades:** conjunto curto ordenado, com razão de relevância.
3. **Outras atualizações:** cobertura visível e escaneável, quando houver.
4. **Decisão:** abrir, ler original, salvar, adiar ou dispensar como não relevante.
5. **Conclusão:** todos os itens receberam uma decisão; “concluir” não exige ler tudo.
6. **Próximo retorno:** condicionado a nova literatura ou cadência escolhida, nunca a countdown falso.

Loop: **descobrir → entender o suficiente → decidir → salvar/ler → concluir a Dose → retornar quando
houver novidade**. Não há feed infinito: paginação pode existir para cobertura, mas a unidade mantém
fim e progresso reais.

Uma Dose vazia também pode entregar valor: “nenhuma atualização relevante encontrada desde sua última
Dose”, acompanhado de escopo, janela e estado da atualização. Isso reduz a necessidade de conferir fontes
manualmente e pode aumentar confiança. O produto nunca fabrica atividade para sustentar engagement.

## 6. Free versus Pro: modelos para validar

Princípio derivado do Core Job:

- **Free:** experimentar repetidamente descoberta real, personalização, priorização, proveniência e a
  sensação de concluir uma Dose — não ver uma demo mutilada.
- **Pro:** delegar uma parcela maior do acompanhamento, de modo mais amplo, contínuo e ajustável — não
  “pagar para ter ciência” nem acumular features.

Formulação conceitual para avaliar, não copy aprovada: **“Free demonstra a inteligência do Dose; Pro
transforma essa inteligência em acompanhamento.”** O limite futuro pode estar em cobertura, quantidade,
temas, continuidade, automação, profundidade, histórico, summaries ou alertas; esta etapa não escolhe a
dimensão.

O valor Pro pode ser entendido em três camadas: **COVERAGE** (quanto do escopo coberto é acompanhado e
apresentado), **CONTINUITY** (mudança, retomada, histórico e alertas) e **COMPREHENSION** (ajuda estruturada
para decidir o que aprofundar). IA pode amplificar a terceira camada; não constitui categoria de assinatura.

Nenhum modelo abaixo é vencedor.

### Modelo 1 — Amostra prioritária por Dose

- **Lógica:** limitar a seleção entregue, não apenas features periféricas.
- **Free:** vê um pequeno número de prioridades reais por Dose e a existência, sem conteúdo escondido
  de modo ansioso, de outras atualizações.
- **Pro:** acessa a cobertura relevante completa e controles de triagem.
- **Vantagem:** demonstra diretamente o núcleo e torna o limite compreensível.
- **Risco:** 2–3 itens podem ser excelentes, insuficientes ou arbitrários; um erro consome grande parte
  do valor Free. Ocultar detalhes importantes pode ferir confiança.
- **Hipótese:** poucas prioridades têm relevância alta o bastante para provar valor e cobertura adicional
  é motivo de pagamento.

### Modelo 2 — Um tema completo, acompanhamento amplo no Pro

- **Lógica:** limitar amplitude de delegação, mantendo profundidade dentro de um escopo escolhido.
- **Free:** acompanha uma área/tema com prioridades, fonte e continuidade básicas.
- **Pro:** acompanha múltiplos temas, com filtros e alertas personalizados.
- **Vantagem:** Free continua útil e permite avaliar qualidade longitudinal.
- **Risco:** usuários com um único tema podem nunca precisar pagar; seleção inicial do tema pode limitar
  a descoberta do valor.
- **Hipótese:** amplitude e coordenação entre temas elevam o valor para os segmentos mais intensos.

### Modelo 3 — Descoberta aberta, continuidade Pro

- **Lógica:** conteúdo descoberto e proveniência ficam amplamente acessíveis; automação continuada é paga.
- **Free:** prioridades atuais e acesso ao original; histórico/biblioteca limitados e alertas não contínuos.
- **Pro:** histórico ampliado, biblioteca/organização, acompanhamento e alertas calibrados.
- **Vantagem:** monetiza conveniência e continuidade, não a existência da ciência.
- **Risco:** o valor pago demora a aparecer; limites de histórico podem parecer lock-in se exportação e
  destino dos salvos não forem honestos.
- **Hipótese:** usuários sentem a ausência do serviço longitudinal e pagam para mantê-lo.

### Modelo 4 — Compreensão assistida com cota transparente

- **Lógica:** descoberta/priorização são base; processamento custoso e profundo tem cota.
- **Free:** vê seleção, metadata, abstract disponível e poucas transformações claramente rotuladas.
- **Pro:** mais resumos estruturados elegíveis e ferramentas de compreensão, sem geração implícita.
- **Vantagem:** alinha custo variável com plano e permite provar utilidade do resumo.
- **Risco:** transforma IA no produto, cria frustração se a elegibilidade variar e pode incentivar resumo
  sem fonte. A infraestrutura existente não prova ativação nem qualidade semântica.
- **Hipótese:** summaries aumentam disposição a pagar depois que relevância já foi estabelecida.

### Hipótese específica: 2–3 atualizações Free por dia/Dose

**Benefícios possíveis:** unidade curta, valor rapidamente consumível, custo previsível e contraste com
cobertura Pro. **Riscos:** número sem relação com novidade; Free inútil em nichos; omissão de evento
importante; falsa sensação de completude; frustração se a prioridade errar; otimização para quantidade.

**Comportamento esperado a observar:** conclusão sem compulsão, pertinência dos itens, procura espontânea
por cobertura adicional e retorno quando há novidade. Conversão só seria interpretação plausível se
ocorresse depois de valor, e não por ansiedade criada.

**Como validar antes de codificar:** protótipos com lotes reais previamente revisados, randomizando
apresentação de 2, 3 e conjunto variável; entrevistas pós-tarefa; medir decisão útil por item, percepção
de suficiência, confiança e interesse em cobertura. Não expor limite como escassez real durante teste.

## 7. Guidelines e conteúdo excepcionalmente relevante

**Questão aberta:** guidelines/diretrizes importantes devem ser Premium? A recomendação para teste é
**não usar a descoberta de um evento excepcional como isca bloqueada**. Quando uma diretriz pertence ao
escopo Free e foi legitimamente descoberta, mostrá-la pode ser a prova mais forte de que o Dose funciona.
A mensagem conceitual poderia ser “algo importante aconteceu em um tema que você acompanha”. Free pode
ser o lugar onde essa competência é provada; Premium pode monetizar o sistema ao redor: cobertura maior,
acompanhamento, alerta personalizado, contexto, relações com outros eventos, organização, histórico,
resumo estruturado elegível e, apenas futuramente, comparação temporal confiável.

Isso não equivale a promessa de detectar toda guideline, classificá-la corretamente ou fornecer seu
texto. Eventos excepcionalmente importantes exigem critérios editoriais/científicos definidos e
auditáveis; publication type isolado não prova importância clínica.

### Camadas que não podem ser confundidas

| Camada                   | Tratamento de produto                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Descoberta               | Registro de que um item existe e entrou no escopo; cobertura/fontes devem ser declaradas.                      |
| Metadata                 | Título, autores, periódico, data, identificadores e links conforme fonte, com proveniência.                    |
| Abstract                 | Texto fornecido pela fonte, sujeito a disponibilidade e licença; não é resumo de IA.                           |
| Acesso ao original       | Link/rota ao detentor; metadado de open access não concede redistribuição.                                     |
| Full text                | Não representado pelo pipeline verificado; direitos e disponibilidade são **NOT VERIFIED**.                    |
| Resumo de IA             | Transformação de metadata + abstract elegível, rotulada e rastreável; não é original nem verdade independente. |
| Análise editorial        | Camada humana distinta, com autoria/processo explícitos; capacidade operacional é **NOT VERIFIED**.            |
| Funcionalidades ao redor | Priorizar, alertar, salvar, organizar e manter histórico; podem ser monetizadas sem vender acesso à ciência.   |

## 8. Papel da IA

“Pague porque temos IA” é fraco: IA é copiável, não garante relevância, pode errar, adiciona custo e
desloca confiança para uma tecnologia em vez do resultado. “Pague porque o Dose cuida continuamente da
sua atualização científica” descreve o trabalho recorrente; IA é um meio opcional e visível.

### Onde pode criar valor

- Estruturar, quando sustentado pelo abstract, pergunta, desenho, população, intervenção/exposição,
  comparador, resultados, limitações e implicações cautelosas.
- Explicar termos ou reorganizar apresentação para reduzir tempo, sempre preservando a fonte.
- Personalizar **forma e ordem** de apresentação sem alterar alegações científicas.
- Declarar campos indisponíveis em vez de inferi-los.

### Onde não deve substituir produto ou julgamento

- Não descobrir relevância apenas por texto gerado sem pipeline e critérios observáveis.
- Não inferir full text, desfechos ou recomendações ausentes do abstract.
- Não declarar qualidade, mudança de conduta ou completude.
- Não gerar automaticamente em feed/navegação, sem elegibilidade, intenção, orçamento e controle.
- Não misturar texto gerado com abstract/editorial.

Qualquer ativação futura exige proveniência, schema/versão, fonte de entrada, fidelidade, elegibilidade,
latência, fallback, custo e transparência. A infraestrutura local atende parte desses limites, mas
qualidade semântica com dados reais e operação permanecem **NOT VERIFIED**.

## 9. Perguntas que a futura Home deve responder

Sem desenhar UI, sua hierarquia informacional deve permitir responder:

1. O que mudou desde minha última Dose bem-sucedida?
2. O que merece atenção primeiro e por quê?
3. Quantos itens novos foram realmente encontrados dentro do escopo consultado?
4. Em quais temas houve novidade — e em quais não houve?
5. O que salvei ou deixei para depois?
6. Existe evento excepcional, segundo qual critério?
7. Qual é a cobertura, a atualização e o estado dos dados?
8. Esta Dose acabou? Existe mais conteúdo relevante encontrado caso eu queira aprofundar?

### Indicadores

- **Verificáveis e úteis:** timestamp da busca/atualização bem-sucedida; janela considerada; quantidade
  encontrada; quantidade decidida; tema/fonte; indisponibilidade; itens salvos/pendentes reais.
- **Potencialmente motivadores:** “3 de 5 itens avaliados” ou “2 salvos para depois”, se derivados de
  ações reais e sem julgamento moral.
- **Perigosos/enganosos:** “87% atualizado”, score de competência, “cobertura total”, horas poupadas sem
  medida, “artigo mais importante” ou “mudará sua prática”. Sem denominador e universo auditáveis,
  porcentagem de atualização é ficção matemática.

A Home deve ser uma resposta preparada, não um dashboard de vaidade. Ao abrir, o usuário deveria sentir
“alguém já organizou isso para mim”: o que mudou, o que vem primeiro, por que apareceu, o que foi adiado e
se existe mais profundidade. Métricas de streak/minutos existentes não são automaticamente parte desta
direção.

## 10. Retenção e hábito

O gatilho saudável é **mudança verdadeira no universo acompanhado**, não obrigação diária.

### Loop recorrente proposto

Preferências explícitas → monitoramento delimitado → novidade real → Dose finita → decisão → histórico
e feedback → próxima seleção. Alertas só antecipam o retorno quando novidade e preferência justificarem.

- **DAILY VALUE:** em temas com volume suficiente, entender rapidamente se algo novo merece atenção.
  Em dias sem novidade, dizer isso honestamente; não fabricar conteúdo.
- **WEEKLY VALUE:** revisar mudança acumulada, retomar salvos e ajustar temas com base em utilidade.
- **LONG-TERM VALUE:** manter memória pesquisável/portátil do que foi visto, lido, descartado ou salvo e
  acompanhar linhas temáticas sem reconstruir contexto.

**O que começa a fazer falta ao parar:** saber o que surgiu e por onde começar; a sensação delimitada de
cobertura; prioridades, alertas pertinentes, organização, histórico, ritual de atualização e tempo poupado.
Acima de tudo, deixa de existir a confiança de que há um sistema acompanhando o tema. Voltam a verificação
de fontes, a reconciliação de alertas, a decisão de prioridade e a reconstrução de contexto.

Esse “absence value” é legítimo somente quando decorre do trabalho prestado. Nunca pode vir de dados
presos, ameaça, perda artificial, conteúdo retido, dificuldade de cancelar ou interoperabilidade
intencionalmente ruim.

**HYPOTHESIS TO VALIDATE — confiança como retenção:** proveniência não é só guardrail; pode ser parte do
motivo de voltar. O usuário deve entender de onde veio, quando saiu, por que apareceu, o que é metadata,
abstract, original ou interpretação e quais são as limitações. Quanto mais importante a decisão
científica, menos o Dose deve parecer mágico e mais deve parecer verificável.

## 11. Paywall e conversão

**PROPOSED PRODUCT DECISION para teste:** **VALUE → RECOGNITION OF VALUE → NATURAL LIMIT → UPGRADE
OPPORTUNITY**. Um paywall por mera abertura de página ou imediatamente após cadastro impede reconhecer
relevância e força compra baseada em promessa.

### Momentos naturais

- Concluiu a seleção Free e quer ver cobertura adicional realmente existente.
- Quer acompanhar mais temas ou uma janela/frequência diferente.
- Tenta ativar alerta contínuo e entende frequência, controle e escopo.
- Quer mais summaries elegíveis depois de experimentar um resumo rotulado e útil.
- Precisa retomar histórico/biblioteca ou organização avançada sem perder acesso aos próprios dados.

Não mostrar upgrade quando o sistema falhou, não há conteúdo elegível ou o limite não foi atingido.
Falha operacional não é oportunidade de venda.

### Microcopy conceitual, não final

- “Sua seleção gratuita terminou. Encontramos outras atualizações dentro dos seus temas; veja o que a
  cobertura ampliada inclui.”
- “Acompanhe também [tema] continuamente com Pro.”
- “Este artigo tem abstract elegível para resumo estruturado. Pro inclui mais resumos; a fonte original
  continua disponível.”

Evitar “não fique para trás”, urgência, contagem regressiva e importância clínica não demonstrada.

### Funil conceitual, não analytics implementados

> **ACQUISITION** (promessa compreensível) → **ONBOARDING** (especialidade + interesses suficientes) →
> **ACTIVATION** (primeira Dose real e reconhecidamente relevante) → **FIRST VALUE** (ação útil) →
> **REPEAT VALUE** (nova literatura → nova Dose) → **RETENTION** (parte do processo de atualização) →
> **MONETIZATION** (desejo de ampliar/delegar mais trabalho)

Cada passagem exige evidência própria. Cadastro não é ativação; abertura não é valor; frequência não é
retenção se não houver novidade; clique em upgrade não é willingness-to-pay.

## 12. Why would someone pay for Dose?

**HYPOTHESIS TO VALIDATE:** alguém poderia pagar porque o Dose executa repetidamente um trabalho que hoje
exige atenção manual: acompanhar um escopo, encontrar mudanças, organizar o universo encontrado,
priorizar, preservar contexto e facilitar a decisão de aprofundar. O benefício não depende de dashboard,
IA, gráficos, estética ou quantidade de controles.

- **Trabalho recorrente:** a preparação acontece entre visitas, não apenas durante o uso.
- **Cobertura delimitada e personalização:** mais do escopo escolhido é acompanhado com relevância pessoal.
- **Continuidade:** o usuário sabe o que mudou, onde parou e o que deixou para depois.
- **Economia de esforço:** busca, triagem e organização deixam de ser reconstruídas a cada sessão.
- **Redução de carga mental:** a atualização ganha começo, prioridade, fim e próximo retorno.
- **Compreensão:** ferramentas estruturadas ajudam a decidir o que merece leitura; IA é um meio possível.

### Premium Value Thesis revisada

**PROPOSED PRODUCT DECISION:** Pro não é um pacote de “mais features”. É a delegação de uma parcela maior
da atualização científica: cobertura mais ampla dentro de limites explícitos, continuidade entre mudanças
e ajuda verificável para compreender e decidir. Seu valor funcional é trabalho poupado; o emocional é
alívio e controle; o recorrente é o acompanhamento entre visitas; e o valor de ausência é a volta do
trabalho manual — nunca lock-in artificial.

O comportamento que sustentaria “eu pagaria para continuar” é confiar repetidamente em “pode deixar que
o Dose acompanhe isso para mim”, receber itens pertinentes e perceber o custo de reconstruir o processo
sem o serviço. Isso permanece hipótese, não evidência de demanda.

## 13. Segmentação provisória orientada à dor

Não são personas, ICP final, demografia nem estimativas de mercado. `HIGH / MEDIUM / LOW PAIN` são
hipóteses qualitativas a investigar, não pontuação ou fato.

| Segmento comportamental                                    | Dor aparente                    | Job e comportamento provável                                                          | Razão potencial para pagar                  | Risco de baixo valor                                                        |
| ---------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Pouco tempo + alto compromisso com atualização             | **HIGH PAIN — hipótese**        | Quer prioridade pronta, fonte rápida e ritual curto.                                  | Delegação, seletividade e tempo recuperado. | Frequência baixa ou seleção imprecisa elimina confiança.                    |
| Academicamente ativo ou usando múltiplos mecanismos        | **HIGH PAIN — hipótese**        | Reconcilia buscas, newsletters, alertas e salvos; precisa de cobertura e recuperação. | Coordenação, histórico e filtros.           | Ferramentas especializadas atuais podem resolver melhor.                    |
| Acompanha tema que muda rápido ou em fase decisiva         | **HIGH/MEDIUM PAIN — hipótese** | Quer novidade pertinente e alerta seletivo durante uma janela.                        | Continuidade e sinal oportuno.              | Necessidade pode ser temporária; alerta ruidoso destrói valor.              |
| Sente atraso ou tarefa infinita com literatura             | **MEDIUM PAIN — hipótese**      | Busca redução, orientação e um fim alcançável.                                        | Alívio e rotina sustentável.                | Culpa não pode ser usada comercialmente; baixa prioridade pode impedir uso. |
| Aprende de forma estruturada, mas sem urgência de novidade | **MEDIUM/LOW PAIN — hipótese**  | Explora explicações, estudos-chave e salvos.                                          | Organização e compreensão.                  | Job educacional pode não sustentar monitoramento ou assinatura.             |
| Já possui rotina simples e satisfatória                    | **LOW PAIN — hipótese**         | Consulta poucas fontes e não sente fragmentação.                                      | Pouca razão evidente.                       | Dose acrescenta outra ferramenta e mais trabalho.                           |

Pesquisa deve encontrar onde dor, frequência, confiança e capacidade de pagar coincidem; esta tarefa não
escolhe ICP.

## 14. Diferenciação e categoria como hipótese

O Dose não pretende ser PubMed com interface bonita, chatbot de artigos, feed infinito, gerador de
resumo, dashboard de produtividade, rede social médica, prontuário nem clone de UpToDate. Ele também não
deve prometer suporte à decisão clínica no ponto de cuidado sem outro escopo e validação.

A diferença conceitual entre substitutos é:

- **SEARCH TOOL:** “encontre algo quando você procura”.
- **SUMMARY TOOL:** “explique algo que você trouxe”.
- **CONTINUOUS UPDATE SERVICE:** “acompanhe um escopo e prepare mudanças relevantes antes de você
  procurar”.

**HYPOTHESIS TO VALIDATE:** a terceira categoria é o território desejável do Dose. Sua combinação seria
**discovery + personalização + priorização + compreensão + continuidade + confiança científica**. Nenhum
elemento isolado é vantagem comprovada; a possível diferenciação está na orquestração, sobretudo no
trabalho entre visitas, na seleção finita e na memória do que mudou.

Não há pesquisa competitiva, preferência declarada ou vantagem defensável verificadas. A categoria pode
ser incompreendida, pouco desejada ou já resolvida pelos substitutos.

## 15. Métricas candidatas

Instrumentação ainda não foi verificada. Definições, eventos, privacidade, denominadores e janelas devem
ser aprovados antes de metas. Não definir objetivos numéricos sem baseline.

| Categoria        | Métrica candidata orientada a valor                                                                                                             | Cuidado de interpretação                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **ACTIVATION**   | Preferências remotas → primeira Dose real → ação de relevância em item priorizado.                                                              | Abrir tela sozinho não prova valor; validar pertinência qualitativamente.              |
| **RETENTION**    | Retorno após novidade real e nova decisão; retorno a tema/salvo em outra janela.                                                                | Não premiar abertura sem conteúdo nem usar calendário arbitrário para temas lentos.    |
| **ENGAGEMENT**   | Abrir item priorizado, acessar original, salvar, adiar, descartar com feedback, concluir triagem.                                               | Mais tempo e cliques podem significar fricção, não sucesso.                            |
| **VALUE**        | Taxa de itens considerados relevantes; Doses com ao menos uma ação útil; busca manual evitada autorrelatada; prioridade aceita/corrigida.       | Feedback explícito tem viés; combinar observação e entrevista.                         |
| **MONETIZATION** | Interesse/upgrade após experimentar valor; motivo de upgrade; retenção/cancelamento por modelo; uso do benefício pago.                          | Conversão por ansiedade não é sucesso; receita sem retenção/trust pode ocultar dano.   |
| **TRUST**        | Abertura de fonte, correções/feedback de irrelevância, identificação de proveniência em teste, falhas/indisponibilidade mostradas corretamente. | Muitos cliques na fonte podem refletir confiança ou desconfiança; investigar contexto. |

Guardrail candidates: notificações desativadas, irrelevância reportada, resumo contestado, links falhos,
latência/falha de atualização, cancelamento por baixa confiança e confusão entre abstract/IA/editorial.

## 16. Experimentos antes de codificar paywall

| Experimento                   | Pergunta e hipótese                                             | Método barato                                                                                                           | Sinal positivo                                                                             | Sinal negativo                                                      | Limitação                                                             |
| ----------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Entrevista de processo atual  | O monitoramento é dor recorrente e delegável?                   | Entrevistar por segmento; reconstruir última busca/alerta e alternativas reais, sem apresentar solução primeiro.        | Dor frequente, workaround e custo concreto; pedido espontâneo de acompanhamento.           | Problema raro, resolvido satisfatoriamente ou não prioritário.      | Relato não prova uso nem pagamento.                                   |
| Concierge com literatura real | Uma Dose finita economiza trabalho e mantém confiança?          | Com revisão adequada, montar manualmente seleções reais e revelar processo/limites.                                     | Itens reconhecidos como pertinentes e ações úteis repetidas.                               | Irrelevância, dúvida de cobertura ou preferência por busca própria. | Curadoria manual não escala e pode superestimar qualidade.            |
| Teste de proposta             | Delegação supera “IA/resumos” como mensagem?                    | Protótipos equivalentes e entrevistas/tarefas, alternando formulações sem falsas capacidades.                           | Melhor compreensão, confiança e intenção qualificada para acompanhamento.                  | IA/resumo ou outra promessa resolve job distinto.                   | Intenção declarada não é retenção.                                    |
| Limite Free                   | 2, 3 ou quantidade contextual demonstra valor sem inutilidade?  | Mesmos lotes reais, diferentes cortes transparentes; medir suficiência e ação.                                          | Pequena seleção gera valor e desejo espontâneo de cobertura.                               | Sensação de amostra arbitrária, ansiedade ou ausência de valor.     | Ordem/qualidade do lote influencia mais que quantidade.               |
| Temas versus cobertura        | Usuário prefere um tema completo ou vários parcialmente?        | Protótipo comparativo e escolha com trade-off explícito.                                                                | Preferência estável alinhada ao job/segmento.                                              | Confusão ou rejeição a ambos.                                       | Escolha hipotética não mostra comportamento longitudinal.             |
| Interesse em alertas          | Alerta resolve retorno sem gerar ruído?                         | Opt-in para simulação/concierge com frequência e canal controlados.                                                     | Alertas abertos por pertinência e mantidos ativos.                                         | Silenciamento, irritação ou ausência de ação.                       | Operação manual e novidade da experiência enviesam.                   |
| Summary assistido             | Resumo aumenta decisão/compreensão além de metadata + abstract? | Comparar tarefa com/sem resumo real rotulado; checagem de compreensão/proveniência.                                     | Decisão mais rápida sem perda de compreensão/confiança.                                    | Dependência, confusão de origem ou erro material.                   | Amostra pequena não valida fidelidade geral.                          |
| Fake-door ético Pro           | Há intenção quando o limite surge após valor?                   | Botão “Conhecer acompanhamento Pro”; antes do clique explicar que não há cobrança e pedir consentimento para interesse. | Interesse qualificado + motivo consistente; nenhum usuário enganado sobre disponibilidade. | Cliques baixos ou motivados apenas por curiosidade.                 | Clique não é willingness-to-pay.                                      |
| Willingness-to-pay            | Qual resultado e faixa sustentam compra?                        | Entrevista com escolha/trade-off e, depois, oferta não vinculante claramente identificada.                              | Compromisso consistente após explicar limites.                                             | Elogio sem troca ou recusa em qualquer estrutura.                   | Viés hipotético; pagamento real só após autorização e infraestrutura. |
| Teste de ausência             | O trabalho delegado faz falta?                                  | Após uso concierge recorrente e consentido, pausar uma janela e entrevistar/observar workaround.                        | Usuário retoma busca e pede continuidade.                                                  | Nenhuma mudança ou falta percebida.                                 | Pausa deve ser ética e não ocorrer em expectativa de alerta crítico.  |

Nenhum resultado deve ser chamado de validação antes de coleta e análise reais.

## 17. Estrutura para pricing futuro

Não há preço proposto. A futura decisão deve cruzar:

- resultado percebido e frequência de uso, não contagem arbitrária de features;
- esforço/tempo realmente poupado e confiabilidade de cobertura;
- custo variável de IA, ingestão e operação sem repassá-lo como valor por si só;
- amplitude de temas/fontes e profundidade de organização/compreensão;
- diferenças entre segmentos, uso profissional individual e alternativas atuais;
- elasticidade observada em escolhas/comportamento, não apenas perguntas abertas;
- Brasil primeiro: poder de compra, impostos, meios de pagamento e linguagem;
- internacional depois: cobertura científica, localização, regulação e suporte ainda não verificados;
- mensal/anual, teste/cancelamento e transparência total do compromisso.

Os preços já presentes na UI/README são parte do protótipo existente e **não são adotados por este
Blueprint como decisão final**. Antes de preço, definir unidade de valor e custo confiável; depois testar
arquiteturas de oferta com consentimento, sem cobrar até a infraestrutura real estar autorizada.

## 18. Marketing e monetização: persuasão sem manipulação

**PROPOSED PRODUCT PRINCIPLE:** persuasão é permitida; manipulação não. O Dose pode vender com convicção
a conveniência, tempo recuperado, controle, continuidade, profissionalismo, confiança, domínio,
tranquilidade e trabalho realizado em segundo plano. Ética não exige linguagem tímida; exige que uma
promessa desejável seja verdadeira, delimitada e demonstrável.

Não monetizar medo fabricado, culpa profissional, risco clínico exagerado, falsa competência, comparação
social, ciência falsificada, urgência/FOMO/escassez artificiais, falha do sistema ou lock-in de dados.
Pode monetizar personalização, cobertura delimitada, automação consentida, profundidade, continuidade,
organização, operação confiável e esforço poupado.

### Product Principles Candidates

São candidatos para futura aprovação, **não PRODUCT TRUTH**:

1. **Ciência real antes de conteúdo convincente:** vazio é melhor que demonstração disfarçada.
2. **Relevância antes de volume:** mais itens não significam mais valor.
3. **Finitude sem invisibilidade:** priorizar sem esconder o universo encontrado no escopo coberto.
4. **Fonte antes de interpretação:** origem, tipo de conteúdo e limitações permanecem verificáveis.
5. **Confiança compõe o produto:** não é apenas compliance; sustenta desejo e retorno.
6. **Valor antes do paywall:** upgrade responde a valor reconhecido e limite natural.
7. **Free experimenta a mágica:** descoberta, personalização, prioridade, proveniência e conclusão reais.
8. **Pro vende delegação:** coverage, continuity e comprehension, não escassez artificial.
9. **Ausência de novidade é informação:** nunca fabricar atividade para engagement.
10. **IA amplifica compreensão:** não substitui evidência, descoberta confiável nem julgamento.

## 19. Top Product Hypotheses to Validate

Ordenadas por dependência lógica, não por confiança.

1. **Problema recorrente:** segmentos específicos sentem custo relevante e frequente ao acompanhar
   literatura. **Importa:** sem dor recorrente não há hábito ou assinatura. **Teste:** entrevistas sobre
   comportamento passado + diário. **Se errada:** estreitar segmento/job ou abandonar monitoramento.
2. **Desejo de delegação:** usuários confiarão parte do acompanhamento a um serviço delimitado que trabalha
   entre visitas. **Importa:** é o núcleo Premium. **Teste:** concierge recorrente. **Se errada:** assumir
   produto pontual de busca/organização.
3. **Capacidade científica real:** fontes, ingestão e classificação conseguem oferta suficiente e
   confiável no escopo inicial. **Importa:** sem supply real não há promessa. **Teste:** piloto autorizado
   e auditoria clínica. **Se errada:** revisar fontes/temas antes da UX.
4. **Personalização relevante:** preferências explícitas geram prioridade mais útil que um feed amplo.
   **Importa:** reduz ruído. **Teste:** comparação cega de listas e explicações. **Se errada:** investir em
   curadoria temática/consulta, não personalização individual.
5. **Finitude com cobertura visível:** Dose priorizada + universo encontrado produz controle sem sensação
   de omissão. **Importa:** resolve o paradoxo central. **Teste:** lotes reais com duas camadas. **Se errada:**
   testar inbox/filtros sem ritual de conclusão.
6. **Confiança gera retorno:** proveniência e explicação da prioridade aumentam confiança e uso qualificado.
   **Importa:** confiança é parte do valor, não só guardrail. **Teste:** tarefas de identificação de origem,
   abertura da fonte e entrevistas. **Se errada:** rever linguagem/hierarquia, nunca ocultar proveniência.
7. **Continuidade faz falta:** mudança, histórico e contexto poupados geram retorno e valor de ausência.
   **Importa:** sustenta assinatura. **Teste:** concierge longitudinal e teste de ausência ético. **Se
   errada:** produto pode ser episódico e inadequado a assinatura.
8. **Free demonstra a mágica:** uma experiência Free completa do Core Job gera valor antes do limite.
   **Importa:** sustenta aquisição ética. **Teste:** variar dimensão do limite e medir suficiência/retorno.
   **Se errada:** ampliar Free ou mudar onde limitar.
9. **Delegação gera willingness-to-pay:** ampliar coverage, continuity e comprehension vale uma troca real.
   **Importa:** separa desejo de elogio. **Teste:** fake-door ético, trade-offs e compromisso progressivo.
   **Se errada:** revisar oferta/unidade comercial ou não monetizar por assinatura.
10. **IA é amplificador, não produto:** summaries melhoram compreensão, mas não são o principal motivo de
    assinar. **Importa:** evita proposta copiável e dependência de custo. **Teste:** experiência com/sem
    summary após relevância estabelecida. **Se errada:** reavaliar tese, custo e risco sem esconder fonte.

## 20. Why would they not pay?

Razões comerciais reais, ainda **NOT VERIFIED**, que podem invalidar a tese:

- a dor é fraca, rara ou atualização científica não é prioridade;
- a literatura do escopo tem frequência baixa ou relevância inconsistente;
- busca, newsletter, alerta, colega ou rotina atual já resolve o problema satisfatoriamente;
- a priorização não inspira confiança ou exige mais conferência do que economiza;
- o produto adiciona triagem, notificações e configuração em vez de remover trabalho;
- Free satisfaz completamente e Pro não amplia um resultado valorizado;
- coverage, continuity e comprehension não justificam assinatura recorrente;
- summaries/IA são facilmente substituíveis e não criam valor diferencial;
- alertas incomodam, chegam tarde ou não são acionáveis;
- ausência de novidade torna o serviço esquecível em temas lentos;
- qualidade científica, proveniência ou disponibilidade variam a ponto de quebrar confiança;
- o segmento pode desejar o produto, mas não priorizar orçamento para ele.

A tese falha comercialmente se o usuário achar o Dose interessante, porém dispensável. Não se deve
compensar baixa disposição a pagar com ansiedade, retenção de conteúdo ou mais features sem job.

## 21. Decisões que não devem ser tomadas ainda

- Número exato de artigos/atualizações no Free, inclusive “2–3”.
- Frequência diária, semanal, por evento ou híbrida da Dose.
- Definição algorítmica/editorial final de “prioritário” ou “excepcional”.
- Modelo vencedor de Free/Pro e features finais de cada plano.
- Preço, descontos, trial, periodicidade comercial e mercados internacionais.
- Tratamento definitivo de guidelines/diretrizes.
- Quantidade, cota, modelo/provedor ou lugar de summaries.
- Política, canal, frequência e gatilhos finais de alertas.
- Segmento inicial e expansão para outras profissões/especialidades.
- Design/copy final da Home, paywall, dashboard ou indicador de progresso.
- Uso de IA em personalização, comparação temporal ou análise editorial.
- Claims de cobertura, economia de tempo, qualidade ou vantagem competitiva.
- Momento exato de conectar pagamento ou aplicar/ativar infraestrutura remota.

O documento no repositório não converte nenhum desses itens em arquitetura aprovada.

## 22. Roadmap conceitual condicionado a evidência

1. **Validar proposta de valor:** entrevistas por segmento e reconstrução do comportamento atual.
2. **Validar literatura real:** em operação separadamente autorizada, confirmar fontes, metadata,
   proveniência, volume e direitos; infraestrutura local não basta.
3. **Validar relevância/priorização:** auditar classificação e listas com critérios clínicos; o ranking
   server-side existente é ponto de partida técnico, não resultado validado.
4. **Validar primeira Dose e confiança:** concierge/protótipo com dados reais, finitude, explicações,
   proveniência e estados vazios.
5. **Validar uso repetido:** observar nova literatura → nova Dose e se continuidade passa a fazer falta.
6. **Conectar UX real:** somente após aprovação, substituir consumidores hardcoded por fronteiras
   autenticadas sem enfraquecer Auth/onboarding/RLS; incluir erro, vazio, loading e proveniência.
7. **Validar summaries:** amostra elegível, fidelidade e utilidade; manter geração explícita, server-side
   e custo controlado. A infraestrutura preparada continua desativada até autorização.
8. **Testar Free/Pro:** comparar os modelos deste documento sem tratar preços/features atuais como
   verdade aprovada.
9. **Testar disposição a pagar:** fake-door ético e compromisso progressivamente mais real, sem cobrança.
10. **Somente depois conectar pagamento real:** escolher provider, revisar segurança/operação, ativar
    entitlement server-side e testar sandbox antes de qualquer produção.

### Critério de avanço

Cada etapa deve registrar evidência, falhas, segmento e o que permaneceu **NOT VERIFIED**. Testes locais
com fake/mocks provam contratos, não integração externa. Nenhuma etapa autoriza a seguinte por simples
existência de código.

## 23. Principais riscos e perguntas abertas

1. **Oferta vazia ou irregular:** pipeline preparado sem dados reais suficientes produz uma Home sem
   valor. Qual volume e latência existem por tema?
2. **Relevância confundida com evidência:** score pode parecer recomendação clínica. Usuários entendem a
   explicação e seus limites?
3. **Cobertura implícita:** “acompanhar” pode soar universal. Quais fontes, janelas e falhas serão
   comunicadas?
4. **Conteúdo protótipo:** a experiência atual contém títulos e resumos locais; como impedir que sejam
   percebidos como saída do pipeline real durante validação?
5. **Finitude versus omissão:** um corte curto alivia carga, mas pode ocultar item importante. Como tornar
   o restante visível sem recriar feed infinito?
6. **Cadência inadequada:** diária pode gerar vazio/ruído; semanal pode atrasar. A resposta varia por
   tema e segmento?
7. **IA e confiança:** validações estruturais não garantem fidelidade semântica. Quem audita e como
   corrigir/retirar um summary?
8. **Monetização prematura:** UI/pricing protótipo pode cristalizar uma oferta antes do Core Job. Como
   impedir preço e benefícios atuais de virarem compromisso acidental?
9. **Direitos:** acesso a original, abstract e eventual full text têm limites diferentes. Quais licenças
   permitem cada apresentação?
10. **Notificações e ansiedade:** o que é suficientemente relevante para interromper o usuário?

## 24. Registro final de não-verificação

Este Blueprint **não verificou** ambiente remoto, produção, Supabase, Vercel, estado aplicado de
migrations, dados científicos persistidos, execução do piloto, qualidade de regras sobre corpus real,
geração real por OpenAI, custo real de IA, checkout/webhook real, entitlement ativo, analytics,
acessibilidade/UX da futura experiência, direitos de redistribuição, mercado, concorrência,
willingness-to-pay, retenção ou qualquer métrica de usuário. Essas lacunas são entradas do roadmap, não
evidência negativa nem permissão para inventar respostas.
