# Migração do estado local

O storage `dose-app-v2` continua intacto nesta fase. A ponte `UserDataBridge`
trata o perfil remoto como fonte de verdade quando há sessão válida, sem
remover o estado local e sem promover automaticamente dados legados sem dono.

## Destino por categoria

| Estado atual | Destino | Situação |
|---|---|---|
| nome, avatar, idioma, onboarding | `profiles` | leitura remota; escrita somente por ação autenticada explícita |
| especialidade e tópicos | `user_interests` | operações prontas; aguarda IDs reais do catálogo para migrar nomes locais |
| artigos salvos | `saved_articles` | schema pronto; migração posterior |
| progresso de leitura | `reading_progress` | schema pronto; migração posterior |
| horário e canal de lembrete | `notification_preferences` | leitura pronta; escrita/mapeamento posterior |
| plano | `subscriptions`/`entitlements` | nunca migrar do cliente; somente backend confiável |
| notas, coleções, logs e avaliações | tabelas de domínio futuras | continuam locais |
| aparência, tema e som | preferência local ou perfil futuro | continuam locais |
| comentários/comunidade | domínio futuro | continuam locais; comunidade fora de escopo |

Não há cópia automática do perfil legado para o servidor: o storage histórico
não registra seu proprietário e poderia pertencer a outra pessoa em um
navegador compartilhado. Uma migração futura deve pedir confirmação do usuário
autenticado e marcar explicitamente a origem/destino. Os dados originais em
`dose-app-v2` não são apagados.
