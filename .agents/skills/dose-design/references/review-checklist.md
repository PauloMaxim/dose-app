# Critique, audit e entrega

## Critique

Começar pelo objetivo e caminho principal, não por gosto pessoal. Separar achados de fatos verificados, heurísticas e propostas. Priorizar por impacto em compreensão, segurança, ciência, conclusão da tarefa e acessibilidade. Quando pedido apenas análise, não editar arquivos.

## Audit

Verificar, conforme o escopo:

- hierarquia, densidade, scanability e consistência;
- conteúdo real, proveniência e estados científicos;
- teclado, focus, semântica, labels, contraste, zoom e reduced motion;
- reflow, touch, teclado virtual, safe areas e orientação;
- loading, vazio, erro, sucesso, permissões, offline e conteúdo extremo;
- motion: propósito, frequência, origem, saída, interrupção e custo;
- performance visual: layout instável, trabalho por frame e mídia excessiva;
- aderência a decisões aprovadas sem promover legado acidental a padrão.

## Polish

Executar somente após arquitetura, fluxo, conteúdo e estados principais estarem corretos. Refinar alinhamento, ritmo, tipografia, contraste, affordance, microcopy e motion sem ampliar escopo nem ocultar problemas estruturais.

## Evidência de validação

Associar alegação ao método:

- “funciona” → testar o comportamento e a recuperação;
- “responsivo” → inspecionar/testar viewports e conteúdo relevantes;
- “acessível” → registrar dimensões e ferramentas verificadas;
- “animação está suave” → observar execução em contexto, não apenas CSS;
- “produção está saudável” → exigir evidência remota autorizada, não mocks locais.

Antes de concluir, reler `AGENTS.md`, revisar o diff inteiro, confirmar o escopo e listar o que permaneceu **NOT VERIFIED**. Nunca reinterpretar falha como sucesso.
