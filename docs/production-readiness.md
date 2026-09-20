# Auditoria integrada e readiness de produção

Data da auditoria: 20 de setembro de 2026. Escopo: revisão estática e testes locais do
repositório. Este relatório não afirma segurança absoluta e não substitui validação no ambiente
real. Nenhum banco, API científica, provedor de IA, gateway, push, Vercel, DNS ou outro serviço
remoto foi acessado.

## 1. Resumo executivo

O encadeamento browser → sessão → server functions → RLS e os domínios científico, summaries e
billing está coerente nos contratos e testes offline atuais. RLS isola dados por `auth.uid()`,
operações privilegiadas são service-only, entitlement é a autoridade de acesso, o service worker
usa allowlist pública e as integrações reais permanecem desativadas ou dependentes de configuração
server-only.

A auditoria encontrou uma superfície real de abuso no organizador legado de notas por IA: a server
function aceitava qualquer objeto/tamanho e não exigia sessão, embora cada chamada pudesse consumir
um provedor pago. Ela foi corrigida com autenticação e schema estrito limitado a 5.000 caracteres,
com teste de regressão. Não foi criada migration e todas as migrations históricas permaneceram
inalteradas.

Resultado por severidade: **0 CRITICAL, 1 HIGH (corrigido), 2 MEDIUM (adiados), 2 LOW (adiados) e
4 INFORMATIONAL**.

## 2. Findings

### CRITICAL

Nenhum finding comprovado.

### HIGH — H-01, endpoint legado de IA sem autenticação e sem limite (corrigido)

- **Evidência:** `rewriteInsight` fazia uma chamada a `api.x.ai` com chave server-only, mas seu
  validator devolvia o input sem validação e a função não usava `authMiddleware`.
- **Impacto/consequência:** qualquer cliente capaz de invocar a server function poderia gerar custo
  e enviar payloads arbitrariamente grandes. A chave não era retornada ao cliente, portanto não foi
  constatado vazamento da credencial.
- **Explorabilidade:** direta pela superfície HTTP gerada para a server function, quando configurada.
- **Correção:** sessão obrigatória, objeto Zod estrito, texto aparado entre 1 e 5.000 caracteres.
- **Estado:** corrigido e coberto por teste neste trabalho. Rate limiting distribuído continua em
  M-01 antes de habilitar o provedor em produção.

### MEDIUM — M-01, ausência de rate limiting distribuído (adiado)

- **Evidência:** o piloto tem token, limites e idempotência; summaries têm claim/lease e tentativas
  limitadas; o organizador exige sessão e limite de payload. Nenhuma dessas superfícies possui
  quota distribuída por ator/IP.
- **Impacto/consequência:** abuso com credencial válida pode consumir APIs/capacidade; webhooks
  futuros também precisam proteção de borda além da verificação de assinatura.
- **Explorabilidade:** depende de ativação e obtenção de uma sessão/token válido; o piloto exige um
  segredo operacional dedicado.
- **Correção proposta:** antes da ativação, aplicar quotas no runtime/borda para organizador e
  summaries por usuário, para piloto por token/IP, e defesa específica do gateway para webhooks.
- **Estado:** adiado; infraestrutura distribuída não deve ser improvisada nesta auditoria.

### MEDIUM — M-02, ativação não validada em runtime real (adiado)

- **Evidência:** somente testes offline foram autorizados; configuração de Vercel/Supabase, URLs de
  redirect, cookies/headers reais, entrega push e restore não foram exercitados.
- **Impacto/consequência:** configuração incorreta pode indisponibilizar auth, persistência ou
  operações privilegiadas apesar dos contratos locais corretos.
- **Explorabilidade/consequência:** risco operacional, não uma vulnerabilidade demonstrada.
- **Correção proposta:** executar smoke tests controlados em staging após secrets, migrations,
  backups e monitoring estarem configurados.
- **Estado:** adiado para operação humana.

### LOW — L-01, organizador legado usa configuração fora do schema central (adiado)

- **Evidência:** `XAI_API_KEY` é lida diretamente em `src/lib/ai.ts`, enquanto summaries v2 usam
  configuração tipada e fail-closed própria; a variável também não consta do template.
- **Impacto/consequência:** maior risco de erro de configuração e inventário incompleto, sem
  evidência de exposição no bundle.
- **Correção proposta:** decidir se o recurso legado será descontinuado ou migrado para uma
  configuração server-only validada; não ativá-lo até essa decisão.
- **Estado:** adiado para evitar mudança arquitetural/provider fora do escopo.

### LOW — L-02, warning de configuração do npm (adiado)

- **Evidência:** todos os comandos npm emitiram `Unknown env config "http-proxy"`.
- **Impacto/consequência:** não afeta o build atual, mas deixará de ser aceito em uma versão major
  futura do npm.
- **Correção proposta:** corrigir a configuração externa do ambiente/CI, sem gravar proxy ou
  credencial no repositório.
- **Estado:** adiado; configuração não pertence ao código versionado.

### INFORMATIONAL

1. **I-01:** billing real e checkout estão deliberadamente inativos; pagamento isolado não concede
   acesso, e entitlement permanece autoridade.
2. **I-02:** notifications possuem preferências/subscriptions e fluxo explícito, mas não há sender,
   VAPID secreto ou envio em background.
3. **I-03:** mobile readiness significa PWA responsiva; publicação em lojas não foi implementada.
4. **I-04:** `npm audit --offline --omit=dev` reportou zero vulnerabilidades conhecidas no cache
   local; isso não equivale a uma consulta atual ao registry.

## 3. Evidência integrada por área

### Auth e persistência do usuário

Signup, login, logout, restore, recovery, troca de senha/e-mail e OAuth passam por Supabase Auth.
OAuth só aparece mediante flags explícitas. Server functions de usuário usam `authMiddleware`, que
valida o token com `auth.getUser`; o ID usado nas queries vem do contexto verificado, não do payload.
Falhas não autenticadas fecham com `UnauthorizedError`. O logout encerra a sessão e navega para fora;
o listener substitui a sessão subordinada. Não foram encontradas referências ativas a Better Auth
ou Neon. O conteúdo remoto sobrescreve o snapshot local para usuário autenticado.

### Database, RLS e migrations

As tabelas privadas solicitadas habilitam RLS. Policies de propriedade usam `auth.uid()`. Não há
policies de escrita autenticada para summaries, subscriptions, payments, payment_events,
entitlements ou staff_roles; a migration de billing revoga novamente mutações financeiras. RPCs
privilegiadas usam `SECURITY DEFINER` com `search_path` explícito, revogam `public`/clientes e
concedem somente a `service_role`. Constraints cobrem ownership, idempotência e identificadores;
índices cobrem DOI/PMID. A ordem de migrations é crescente e única de `202609170001` a
`202609300001`. Nenhuma migration existente ou `.gitattributes` foi alterada; não há migration nova.

### Secrets e fronteira client/server

A busca estática de arquivos tracked encontrou apenas valores fictícios deliberados em testes; o
único arquivo de ambiente tracked é `.env.example`, cujas atribuições são vazias. Chaves service
role, banco, ingestão, summaries e pagamentos não usam prefixo `VITE_`. Repositórios, adapters,
reconciliação e RPC helpers privilegiados estão em módulos server-only. O build deve ser novamente
inspecionado no deployment, mas a compilação local não indicou import privilegiado no grafo client.
Não imprimir, testar ou reutilizar credenciais temporárias do ambiente fez parte desta auditoria.

### Validação, XSS, URLs, logs e erros

Contratos públicos usam Zod estrito, UUIDs/identificadores limitados, arrays e paginação com teto.
Push aceita apenas endpoint HTTPS limitado. O piloto limita Content-Length e o tamanho calculado do
JSON. Não foi encontrado `dangerouslySetInnerHTML`; texto científico é renderizado como texto React.
Links `_blank` possuem `rel="noreferrer"`. URLs de fontes vêm do catálogo controlado, não de um fetch
arbitrário solicitado pelo cliente. Erros de ingestion, summaries e billing são sanitizados; não
foram encontrados logs de Authorization, payload bruto financeiro, tokens ou abstracts completos
em runtime.

### Ingestão, classificação e feed

Adapters científicos são server-only e usam timeout, retry limitado, `Retry-After` com teto e
normalização conservadora. O pipeline preserva provenance e DOI/PMID/PMCID, deduplica antes de
persistir e não ingere full text. O piloto usa query server-owned, token dedicado, payload fechado e
operation key idempotente. Regras V1 têm versão e IDs canônicos; reconciliação automática é atômica
e preserva associações editoriais. Nenhum backfill foi executado. O feed deriva interesses da sessão
e do banco, recalcula classificação confiável, separa recent/classics e vincula cursor a versão,
snapshot e modo, com ordenação estável e allowlist de saída. `feedEligible` e `summaryEligible` são
conceitos separados.

### Summaries v2

Material canônico é allowlisted e exclui full text/dados privados. Eligibility e identidade são
recalculadas no server e incluem input, prompt, schema, provider e model. Provider/model vêm de
configuração server-only. Claim token, lease, tentativas limitadas e persistência condicionada
controlam concorrência. Estado `completed` só ocorre após schema e fidelity checks, incluindo
identificadores e números; uso/custo são registrados e erros são sanitizados. Nenhuma IA real foi
chamada.

### Billing e entitlements

A abstração verifica assinatura sobre bytes brutos antes de confiar no JSON, limita payload,
normaliza por provider e reconcilia evento/subscription/payment/entitlement de modo atômico e
idempotente. Eventos fora de ordem não rebaixam estado mais novo; pagamento isolado é somente
auditoria. A RPC é service-role only. UI não coleta cartão/CVV e o estado persistido força plano
`free`; não existe caminho de checkout real ou concessão local de Premium.

### PWA, notifications, local storage e i18n

Manifest aponta para `favicon.svg`, que existe. Service worker versiona um cache e atende somente
uma allowlist de assets públicos same-origin; navegação, API e respostas privadas não são cacheadas.
Permissão de notification não é solicitada no load. Inscrição e remoção push exigem sessão, derivam
owner do contexto, validam payload e usam endpoint como chave de dedupe. O Zustand persiste dados
locais/protótipo, mas nunca restaura o plano e não promove perfil/interesses para conta autenticada.
I18n tem catálogo pt-BR, fallback e `Intl` determinístico; conteúdo científico permanece separado
da tradução de interface.

### Performance e acessibilidade

Não surgiu correção pequena adicional com benefício comprovado. O build mantém code splitting; os
JPEGs/Google Fonts/chunk inicial devem ser medidos no runtime real antes de intervenção. Smoke
estático encontrou labels nos fluxos de formulário revisados, botões com tipo/nomes acessíveis,
hierarquia de headings utilizável, alt/`aria-hidden` apropriados e proteção dos links externos.
Nenhum redesign ou asset artístico foi alterado.

## 4. Production readiness matrix

| Área | Estado | Evidência / condição |
|---|---|---|
| Auth | READY WITH OPERATIONAL STEP | Fluxos e fail-closed testados; validar redirects/cookies no staging. |
| Database/RLS | READY WITH OPERATIONAL STEP | Policies e runtime PGlite passam; aplicar/reconciliar migrations no alvo. |
| User persistence | READY WITH OPERATIONAL STEP | Ownership e autoridade remota testados; smoke real pendente. |
| Scientific ingestion | DEFERRED | Código limitado/idempotente; piloto e fontes reais não executados. |
| Taxonomy/classification | READY WITH OPERATIONAL STEP | V1 determinística passa corpus; validação editorial real pendente. |
| Feed | READY WITH OPERATIONAL STEP | Sessão/cursor/ranking testados; volume e DB real pendentes. |
| Summaries | DEFERRED | Pipeline preparado e fail-closed; provider/API não ativados. |
| Billing | DEFERRED | Domínio e fake provider prontos; gateway/checkout reais ausentes. |
| Entitlements | READY WITH OPERATIONAL STEP | Autoridade e RPC seguras; validar migration e leitura real. |
| PWA | READY WITH OPERATIONAL STEP | Manifest/cache seguros; validar instalação/update em browsers reais. |
| Notifications | DEFERRED | Preferências/subscriptions prontas; sender/VAPID/delivery ausentes. |
| I18n | READY | pt-BR, fallback e Intl cobertos localmente. |
| Secrets | READY WITH OPERATIONAL STEP | Nenhum segredo tracked detectado; configurar/rotacionar no runtime. |
| Deployment | BLOCKED | Vercel/runtime/secrets/migrations não foram validados nem alterados. |
| Observability | BLOCKED | Monitoring/alertas/runbooks operacionais não estão demonstrados. |
| Backups/recovery | BLOCKED | Política, restore drill e RPO/RTO não estão demonstrados. |
| Mobile readiness | DEFERRED | PWA existe; publicação nativa/lojas é trabalho futuro. |

`READY` significa evidência suficiente no escopo atual, não perfeição nem serviço ativado.

## 5. Checklist operacional humano (não executar nesta auditoria)

- [ ] Reconciliar o histórico e aplicar migrations existentes em staging/produção; nenhuma migration
  nova foi criada neste trabalho.
- [ ] Configurar e rotacionar secrets server-only; remover credenciais privilegiadas temporárias do
  ambiente Codex sem copiá-las para arquivos.
- [ ] Configurar Vercel e executar redeploy controlado; validar runtime, headers, cookies, redirects,
  variáveis e rollback.
- [ ] Rodar smoke real de Auth, RLS, persistência, feed e entitlement com contas isoladas.
- [ ] Executar piloto científico com limites, revisar provenance/dedupe e validar classificação com
  literatura real antes de backfill.
- [ ] Decidir o destino do organizador legado; antes de ativar IA, centralizar configuração e impor
  rate limit/custos/alertas. Ativar summaries v2 somente depois da validação operacional.
- [ ] Selecionar/implementar gateway, assinatura webhook, reconciliação e checkout hospedado antes de
  qualquer cobrança; nunca coletar cartão/CVV no Dose.
- [ ] Configurar VAPID e sender push server-only, consentimento, unsubscribe, expiração e métricas;
  testar somente em staging primeiro.
- [ ] Definir monitoring, logs redigidos, alertas de auth/5xx/latência/custo e runbooks de incidente.
- [ ] Configurar backups, retenção, restore drill e RPO/RTO do Supabase.
- [ ] Validar instalação/offline/update do PWA e cache em browsers/dispositivos suportados.
- [ ] Configurar domínio/DNS e validar TLS/redirects; não alterar DNS durante esta fase.
- [ ] Avaliar Cloudflare, sem adotá-lo automaticamente. Vercel + Supabase cobrem o baseline atual;
  considerar WAF/rate limit/bot protection/CDN adicional/DDoS apenas com métricas de abuso, requisitos
  regulatórios, necessidade de regras globais consistentes ou lacuna comprovada dos controles atuais.
- [ ] Planejar publicação mobile futura separadamente, incluindo políticas das lojas e privacidade.

## 6. Arquivos e mudanças

- **Modificados:** `src/lib/ai.ts` e `scripts/production-hardening.test.mjs`.
- **Novo:** `docs/production-readiness.md`.
- **Migration nova:** nenhuma.
- **Migrations históricas:** preservadas sem alteração.

## 7. Testes executados

| Comando | Resultado exato |
|---|---|
| `npm run typecheck` | PASS, exit 0. |
| `npm run test:foundation` | PASS, 32/32. |
| `npm run test:scientific` | PASS, 69/69. |
| `npm run test:summaries` | PASS, 16/16. |
| `npm run test:billing` | PASS, 10/10. |
| `npm run test:hardening` | PASS, 10/10 (6 hardening + 4 i18n/contracts). |
| `npm run lint` | PASS, exit 0, 0 erros e 7 warnings legados. |
| `npm run build` | PASS, exit 0; warnings de chunk inicial de 633 kB e dynamic import ineficaz de auth. |
| `git diff --check` | PASS, sem saída. |
| `npm audit --offline --omit=dev` | PASS, 0 vulnerabilidades no cache local. |
| busca de marcadores privilegiados no client build | PASS, nenhum marcador encontrado. |
| `npm test` | FAIL legado: 208 testes, 195 pass, 13 fail. |

O `npm test` agregado para antes da segunda etapa por causa dos 13 failures de scripts. Quatro
falhas tentam ler `.grok/skills/og`/referências ausentes; uma tenta ler
`public/__grok/icon-180.png`, também ausente. As oito restantes esperam que o plugin genérico derive
título/card do HTML/host, mas a identidade baked deste app fixa `Dose`. Elas são anteriores e
independentes da correção de autenticação/validação; as suítes obrigatórias do produto e o novo teste
passam. Não foram criados arquivos falsos, nem o branding/mascote foi alterado, apenas para satisfazer
essa suíte de tooling genérico.

## 8. Riscos restantes e decisão

Os blockers são operacionais: deployment não validado, observabilidade e recuperação. Ingestão,
summaries, billing, push e mobile continuam deliberadamente desativados/deferred. O código pode ser
submetido a revisão, mas o produto **não está liberado para ativação de produção** até o checklist
humano e os itens BLOCKED serem resolvidos. Código preparado não é serviço ativado; testes offline
não são validação real de produção.
