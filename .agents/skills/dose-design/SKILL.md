---
name: dose-design
description: Autoridade especializada de UX/UI do Dose para pensar, construir ou revisar experiências, interfaces, conteúdo científico, responsividade, acessibilidade e motion. Usar em tarefas SHAPE, BUILD, CRITIQUE, AUDIT, MOTION ou POLISH do produto Dose, inclusive landing, Auth/onboarding, Home/feed científico, artigo/leitura, configurações, mobile e futuro comportamento do mascote.
---

# Dose Design

Projetar uma plataforma de atualização científica personalizada que organize complexidade sem apagar informação. Buscar calma, precisão, confiança, humanidade, clareza, sofisticação e credibilidade científica.

## Respeitar a autoridade

Aplicar, nesta ordem:

1. `AGENTS.md`, segurança e verdades verificadas do produto;
2. requisitos explícitos da tarefa atual;
3. decisões de produto/design já aprovadas no Dose;
4. tokens e padrões existentes deliberadamente aprovados;
5. esta Skill `dose-design`;
6. referências externas.

Nunca deixar uma preferência estética sobrescrever segurança, verdade científica, Auth, autorização, proveniência de dados ou comportamento aprovado. Nunca substituir silenciosamente uma decisão aprovada. Não transformar a UI atual, que pode ser protótipo ou dívida, em design system por inferência.

Classificar afirmações e decisões relevantes como:

- **VERIFIED EXISTING DECISION** — localizar evidência no repositório ou em decisão fornecida;
- **PROPOSED DESIGN DECISION** — explicitar escolha ainda sujeita a aprovação;
- **EXTERNAL REFERENCE / HEURISTIC** — citar a origem sem tratá-la como regra do Dose.

Não atribuir a Apple, Emil Kowalski ou Impeccable valores ou regras criados para o Dose. Depois de aprovada, reutilizar uma decisão consistentemente até que seja explicitamente revista.

## Escolher o modo

- **SHAPE:** entender fluxo, hierarquia, informação, estados e alternativas; produzir direção/brief, não código.
- **BUILD:** implementar somente a direção e o escopo autorizados; reutilizar padrões aprovados.
- **CRITIQUE:** avaliar uma interface existente; permanecer read-only quando a tarefa pedir análise.
- **AUDIT:** verificar acessibilidade, adaptação, estados, consistência e performance visual.
- **MOTION:** desenhar ou revisar interação, microinteração, transição e, futuramente, mascote.
- **POLISH:** refinar apenas depois de arquitetura, conteúdo e UX principal estarem corretos.

## Executar o processo

1. Ler `AGENTS.md` e as instruções aplicáveis.
2. Inspecionar a implementação e documentos existentes antes de afirmar fatos.
3. Definir objetivo, público, superfície e caminho principal.
4. Separar restrições verificadas de legado/protótipo e de propostas.
5. Mapear conteúdo real, hierarquia, densidade, estados e extremos.
6. Definir reflow e comportamento mobile antes de decorar.
7. Propor uma direção visual deliberada quando não houver decisão aprovada.
8. Propor motion somente quando comunicar algo útil.
9. Integrar acessibilidade desde a concepção.
10. Implementar somente quando autorizado e dentro do escopo.
11. Validar a alegação com evidência correspondente; registrar **NOT VERIFIED** quando não puder validar.

Não considerar uma experiência visual validada apenas porque TypeScript compilou, JSX existe, CSS parece correto ou um snapshot passou. Testar comportamento para alegar que funciona, viewports relevantes para alegar responsividade e movimento executado para alegar qualidade da animação.

## Carregar referências sob demanda

- Superfície e intenção: [product-surfaces.md](references/product-surfaces.md)
- Fundamentos, liberdade criativa e anti-padrões: [visual-foundations.md](references/visual-foundations.md)
- Layout, hierarquia e spacing: [layout-spacing.md](references/layout-spacing.md)
- Tipografia e leitura: [typography-reading.md](references/typography-reading.md)
- Cor, material e profundidade: [color-material-depth.md](references/color-material-depth.md)
- Componentes, estados e feedback: [components-states.md](references/components-states.md)
- Interação e motion: [interaction-motion.md](references/interaction-motion.md)
- Responsive e mobile: [responsive-mobile.md](references/responsive-mobile.md)
- Acessibilidade: [accessibility.md](references/accessibility.md)
- Conteúdo e proveniência científica: [scientific-content.md](references/scientific-content.md)
- Mascote e motion futuro: [mascot-motion.md](references/mascot-motion.md)
- Critique, audit e validação final: [review-checklist.md](references/review-checklist.md)
- Fontes, licenças e limites de atribuição: [sources.md](references/sources.md)

Ler apenas as referências pertinentes à tarefa, mas sempre ler `scientific-content.md` quando houver literatura, resumo, ranking ou conteúdo científico; `accessibility.md` em toda implementação/revisão de UI; e `review-checklist.md` antes de concluir uma mudança.
