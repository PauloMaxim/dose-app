# Componentes, estados e feedback

Projetar componentes como comportamento completo, não somente aparência ideal.

## Estados mínimos pertinentes

Considerar: default, hover quando o dispositivo suporta hover, press, focus visível, disabled, loading, sucesso, erro, vazio, sem resultados, sem permissão, offline/timeout, conteúdo parcial e overflow. Incluir apenas estados que a tarefa e a arquitetura real comportem; não inventar APIs ou dados.

- Dar feedback imediato à ação sem afirmar sucesso antes da confirmação adequada.
- Manter rótulos e consequências claros; ícone sozinho exige significado conhecido e nome acessível.
- Evitar múltiplas ações visualmente primárias no mesmo contexto.
- Distinguir disabled de loading e explicar bloqueios importantes.
- Preservar entrada do usuário em erros quando a implementação permitir com segurança.
- Fazer skeleton refletir aproximadamente a estrutura esperada, sem simular conteúdo científico inexistente.
- Em vazio, explicar o estado e a recuperação disponível. Estado vazio é preferível a dado fabricado.
- Em listas densas, usar superfície/card apenas quando ela representar uma unidade ou affordance real.

Nunca fazer estado local parecer autoridade de Auth, onboarding, Premium ou entitlement. Consultar `AGENTS.md` e a implementação antes de desenhar feedback para esses estados.
