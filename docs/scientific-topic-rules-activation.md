# Ativação e rollback das regras temáticas V1

Este documento é um runbook operacional. Nenhum comando descrito aqui é executado automaticamente.

## Ordem segura de ativação

1. Aplicar, em janela controlada, somente a migration `202609260001_activate_topic_rules_v1.sql`.
2. Confirmar que os 12 tópicos possuem `classification_rules.version = catalog-v1-topic-rules-v1`.
3. Executar o backfill em modo `dry_run` e arquivar o plano e as métricas para revisão.
4. Aprovar explicitamente os artigos/batches que podem ser aplicados.
5. Executar `apply` em batches pequenos, interrompíveis e sequenciais.
6. Comparar as métricas aplicadas com o dry-run aprovado antes de avançar o cursor.

Aplicar a migration não classifica artigos e não altera `article_topics`.

## Rollback das regras

Para desativar novos cálculos, executar manualmente uma transação aprovada que valide os mesmos 12 UUIDs
canônicos e então defina `classification_rules = NULL` somente nesses tópicos. Confirmar `ROW_COUNT = 12`
antes do commit. Não modificar tópicos, especialidades, RLS ou grants.

Voltar as regras para `NULL` **não remove** associações automáticas já persistidas. Essa separação é
intencional para evitar destruição oculta.

## Associações automáticas já produzidas

Escolher explicitamente uma destas políticas após revisão operacional:

- **Preservar:** manter as associações automáticas existentes enquanto a classificação fica desativada.
- **Remover controladamente:** preparar uma operação administrativa separada e explicitamente aprovada
  que invoque a RPC de reconciliação com conjunto desejado vazio, artigo por artigo, somente após enumerar
  as associações `association_type = 'automatic'` e `rule_version = 'catalog-v1-topic-rules-v1'` afetadas.

Associações `editorial` nunca devem ser removidas. Não executar limpeza global de `article_topics` e não
misturar o rollback das regras com a decisão sobre dados automáticos existentes.
