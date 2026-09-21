# Interação e motion

Motion deve comunicar causa, consequência, estado, continuidade espacial, hierarquia, orientação, feedback ou personalidade. Caso contrário, provavelmente não deve existir.

## Gate antes de animar

Responder:

1. Isto deve animar?
2. Qual finalidade concreta serve?
3. Qual propriedade precisa mudar?
4. CSS/time-based ou spring/physics-based corresponde melhor ao comportamento?
5. Já existe token Dose aprovado?
6. Pode ser interrompida e retomada sem salto?
7. De onde entra?
8. Para onde sai?
9. Qual alternativa em reduced motion?
10. Com que frequência o usuário verá isso?

## Heurísticas operacionais

- Fazer feedback de press parecer imediato e não atrasar a ação real.
- Em gesto, manter conteúdo conectado ao ponteiro/toque, respeitar origem, destino e cancelamento.
- Preservar continuidade ao interromper ou inverter; não bloquear interação apenas para terminar uma transição.
- Fazer entrada e saída explicarem a mesma geografia quando representam o mesmo objeto.
- Preferir `transform` e `opacity` quando apropriado, mas medir custo e não sacrificar semântica/layout.
- Usar transição temporal simples para mudança discreta previsível; considerar spring para interação física, retargeting ou gesto. Não usar bounce sem causa física ou expressiva clara.
- Não usar `scale(0)` como entrada genérica: ele apaga origem e costuma parecer artificial.
- Manter interações frequentes rápidas e discretas; reservar expressão para momentos que suportem atenção.
- Substituir deslocamento, parallax e elasticidade por feedback não vestibular em `prefers-reduced-motion`; não remover informação necessária.
- Escolher tokens Dose deliberadamente. Timings e springs externos são referências, nunca universais.

Validar animação executando-a em contexto, incluindo interrupção, saída, repetição, reduced motion e dispositivo/engine relevantes. Se apenas o código foi lido, registrar **NOT VERIFIED** quanto à fluidez.
