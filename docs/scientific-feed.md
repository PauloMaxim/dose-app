# Feed científico — Fase 3B

A Fase 3B usa regras determinísticas configuradas em `topics.classification_rules`. Cada regra pode combinar termos preferenciais, sinônimos, MeSH, termos obrigatórios, exclusões, termos ambíguos, publication types e journals. O resultado automático registra confidence discreta, método, versão e evidências por campo; tipo de estudo/evidência permanece uma classificação independente.

`article_topics` é a fonte das associações. Registros antigos são editoriais por padrão. A reconciliação faz upsert apenas de automáticos da versão e nunca altera editoriais. O serviço de produção é server-only, usa a sessão autenticada e carrega interesses ativos, associações, salvos e leituras sob RLS.

O candidate set exige correspondência com topic ou specialty de interesse. A especialidade deriva do topic. O score explica relevância temática, evidência, recência, completude e salvo, com ordem estável `score DESC, published_at DESC, id ASC`. Cursor e page size apenas paginam: não removem candidatos. `recent` e `classics` separam as janelas temporais.

Ausência de abstract reduz completude, mas não impede o feed. `feedEligible` e `summaryEligible` são fronteiras distintas; nenhuma sumarização ou IA é executada. A progressão testável é ingestão/normalização, classificação temática, elegibilidade, ranking/seleção e elegibilidade futura para resumo.
