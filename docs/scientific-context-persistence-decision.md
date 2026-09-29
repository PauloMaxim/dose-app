# ADR — persistência de contexto científico (Fase 1.8)

**Status:** proposta para aprovação; nenhuma migration, bucket ou operação remota faz parte desta
fase.

**Base auditada:** `origin/main` em `6bc2e7d9eb20f399c40a04a61aa68c95fa58db1e`.

**Escopo:** artefatos contextuais introduzidos nas Fases 1.1–1.7 e sua relação com o catálogo
científico existente.

## 1. Decisão em uma frase

Manter `public.articles` como a única identidade canônica de artigos, persistir em PostgreSQL a
linhagem contextual imutável e as decisões humanas, guardar conteúdo adquirido somente quando a
licença permitir (inline para payload pequeno ou em Storage privado para payload grande), e tratar
descoberta e avaliações determinísticas como dados transitórios, exceto quando uma avaliação for
registrada como evidência de uma decisão operacional.

## 2. Situação atual verificada

### 2.1 Catálogo e identidade bibliográfica

O schema versionado no repositório cria `public.articles` com UUID primário e unicidade parcial para
DOI normalizado e PMID. A migration científica acrescenta PMCID, `bibliographic_key`, metadados,
abstract e classificação; os índices únicos de PMCID e fallback completam a barreira de
deduplicação. `public.article_sources` liga cada `(provider, external_id)` a exatamente um artigo e
armazena URL e metadados de proveniência. As FKs de tópicos e dados de usuário já apontam para
`articles.id`. A existência das migrations no repositório **não prova** que tenham sido aplicadas em
qualquer ambiente remoto; esse estado não foi consultado porque a tarefa proíbe alterar ou presumir
o estado remoto.

No código server-only, a identidade é procurada primeiro por `(provider, external_id)` em
`article_sources`, depois por DOI, PMID, PMCID ou pelo fallback conservador de título normalizado,
data completa e sobrenome do primeiro autor. A escrita faz merge no artigo encontrado e `upsert` da
fonte. Normalizadores rejeitam PMID/PMCID malformados; DOI é normalizado antes da comparação. Os
índices únicos são a última proteção de concorrência, embora a rotina atual possa precisar repetir a
leitura após uma violação de unicidade concorrente.

Consequências obrigatórias para esta decisão:

- não haverá outra tabela de artigos, nem outra autoridade para DOI/PMID/PMCID;
- uma referência bibliográfica selecionada deve resolver/criar o artigo pelo pipeline existente e
  então apontar para `articles.id`;
- `article_sources` continua sendo a identidade de registros de provedores, e flags de acesso aberto
  ou licença ali são metadados declarados pela fonte, não autorização para armazenar full text;
- `abstract` continua sendo texto fornecido pela fonte, distinto de full text e de resumo por IA.

### 2.2 Contratos das Fases 1.1–1.7

Os contratos atuais são Zod estritos e versionados:

- `ContextualNeed` é derivado de um pipeline editorial validado. Ele fixa artigo, endpoint,
  finalidade, facts e anchors de origem. Seu identificador é um SHA-256 determinístico sobre o
  conteúdo integral relevante da necessidade.
- `BibliographicCandidate` agrega resultados de PubMed, Europe PMC e Crossref, preserva registros e
  adaptadores de origem e exige DOI, PMID ou PMCID. Conflitos entre identificadores ligados abortam a
  consolidação; a função de descoberta não persiste.
- `ExternalContextReference` representa identidade/citação, sem alegar aquisição, licença ou escopo
  de conteúdo.
- `ExternalContextAcquisition` vincula uma referência a uma captura normalizada, checksum SHA-256,
  horário, método, escopo, acesso/licença e anchors por intervalo de code points. Full text exige
  licença declarada e base explícita.
- `ContextualClaimCandidate` liga artigo + necessidade exata + referência + aquisição + anchors. Sua
  revisão SHA-256 inclui o texto e uma cópia da evidência adquirida.
- `ContextualAuthorization` é uma decisão humana (`authorized`/`rejected`) para o ID e a revisão
  exatos do claim, com revisor, horário e escopo. Alterar claim, aquisição, anchors ou necessidade
  invalida o reaproveitamento automático da autorização.
- `VerifiedSourceObservation` é uma observação humana datada sobre atualidade, versão, checksum e
  integridade dos anchors, com evidência opcional de comparação externa.
- `ContextualReferenceReuseEvaluation` é um parecer offline determinístico e explicitamente não cria
  claim nem autorização. A reutilização segura exige política temporal, integridade local e evidência
  externa recente; mudança ou incerteza produz bloqueio ou reverificação.

Os registries atuais são somente `Map` em memória. Portanto esses contratos demonstram validação e
linhagem, mas não persistência durável dos artefatos contextuais.

### 2.3 Infraestrutura reutilizável

Há padrões que devem ser reutilizados: UUIDs PostgreSQL, FKs, `created_at`/`updated_at`, trigger
`set_updated_at`, RLS habilitada, escrita server-only por `service_role`, leitura autenticada
explicitamente limitada, ledger de idempotência para ingestão, e claim token + lease para impedir
que workers antigos finalizem um trabalho novo. O modelo de summaries também demonstra chave de
identidade por SHA-256, payload versionado, status de processamento e leitura apenas do resultado
completo.

## 3. Alternativas consideradas

### A. Um JSON completo por execução

**Rejeitada.** É simples, mas enfraquece FKs, deduplicação de referências/aquisições, consultas de
revisão, invalidação seletiva e reutilização segura. Também facilita autorizações órfãs.

### B. Segunda tabela de artigos/contexto bibliográfico

**Rejeitada.** Criaria identidade concorrente com `articles`, duplicaria DOI/PMID/PMCID e quebraria
os vínculos já usados pelo catálogo. Metadados bibliográficos pertencem a `articles` e
`article_sources`.

### C. Sobrescrever sempre o estado mais recente

**Rejeitada.** Perderia a base exata de decisões humanas, tornaria checksums e anchors não
reprodutíveis e permitiria que uma autorização parecesse valer para conteúdo revisado.

### D. Linhagem imutável normalizada + projeção corrente

**Escolhida.** Eventos/revisões científicos permanecem append-only; índices e estados derivados
apontam para a revisão atual sem apagar histórico. Conteúdo grande é separado do banco relacional,
mas sua integridade e autorização continuam no PostgreSQL.

## 4. Política por artefato

| Artefato                             | Decisão                                                                            | Justificativa                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContextualNeed`                     | **Persistir**, uma linha imutável por ID/revisão                                   | É o escopo que impede reutilização de claim entre artigo, endpoint ou finalidade diferentes. Reexecução idêntica é idempotente. Uma necessidade recalculada gera outro ID; a antiga pode ser marcada como superada sem ser apagada.                                                                                                    |
| `BibliographicCandidate`             | **Somente durante a execução**                                                     | É um resultado volátil de busca, não uma nova entidade bibliográfica. Se selecionado, passa pelo pipeline existente para resolver `articles`/`article_sources`; a seleção registra artigo, necessidade, query e provedores, não uma cópia canônica paralela do candidato. Resultados não selecionados não justificam custo e retenção. |
| `ExternalContextReference`           | **Persistir**                                                                      | É a citação reutilizável. Referência bibliográfica aponta obrigatoriamente para `articles.id`; documentos institucionais preservam seu identificador externo sem fingir ser artigo.                                                                                                                                                    |
| `ExternalContextAcquisition`         | **Persistir metadados e, condicionalmente, conteúdo**                              | Checksum, licença, método, escopo e horário são necessários para integridade e custo. O conteúdo só é retido quando permitido; sem permissão, registrar `not_stored`, checksum permitido e locator, nunca inventar disponibilidade.                                                                                                    |
| anchors de aquisição                 | **Persistir com a aquisição**                                                      | Claims precisam resolver a evidência exata. Intervalos e excerpt são imutáveis e validados contra a versão adquirida; não migram silenciosamente para outra versão.                                                                                                                                                                    |
| `ContextualClaimCandidate`           | **Persistir cada revisão imutável**                                                | Texto e escopo são objeto de revisão humana. A revisão calculada é chave de idempotência e base exata da autorização.                                                                                                                                                                                                                  |
| `ContextualAuthorization`            | **Persistir append-only**                                                          | É uma decisão humana auditável. Rejeição também é histórico. Não atualizar a linha para “trocar” decisão; correção ou revogação é novo evento que referencia o anterior.                                                                                                                                                               |
| `VerifiedSourceObservation`          | **Persistir append-only**                                                          | É evidência humana externa, temporal e cara; sustenta reverificação e precisa identificar revisor. Não altera aquisição histórica.                                                                                                                                                                                                     |
| `ContextualReferenceReuseEvaluation` | **Derivar sob demanda por padrão; persistir snapshot quando usado em decisão/job** | O resultado depende de `asOf` e da política. Cache genérico fica obsoleto; porém uma avaliação efetivamente usada para selecionar/rejeitar reutilização deve ser congelada com versão da política, inputs e razões para auditoria. Nunca cria autorização.                                                                             |

Solicitações de descoberta, tentativas e falhas podem ser retidas como log operacional sanitizado por
prazo curto. Não são artefatos científicos nem devem conter payload integral de provedores.

## 5. Modelo lógico proposto

Os nomes abaixo são proposta de desenho, **não SQL executável**. Todo `schema_version`, checksum e
revision usa o literal/algoritmo do contrato correspondente; timestamps são `timestamptz`.

### 5.1 Tabelas centrais

#### `contextual_needs`

- `id text primary key` — o `contextualNeedId(...)` determinístico;
- `article_id uuid not null references articles(id) on delete restrict`;
- `schema_version`, `subject_kind`, `endpoint_id`, `editorial_purpose`, `status`;
- `payload jsonb not null`, `payload_checksum text not null`, `created_at`;
- `superseded_at`, `superseded_by text null references contextual_needs(id)`.

Restrições: checksum hexadecimal de 64 caracteres; payload coerente com colunas projetadas; unique
`(article_id, endpoint_id, id)` é redundante ao PK, mas não necessário. Índice de trabalho:
`(article_id, status, created_at desc)`.

#### `contextual_references`

- `id text primary key`, `schema_version`, `source_class`;
- `article_id uuid null references articles(id) on delete restrict`;
- `provider`, `canonical_scheme`, `canonical_value`, `canonical_locator`, título e datas/versão;
- `created_at`, `updated_at` somente para correções de projeção não científicas.

Para `source_class = 'bibliographic_record'`, `article_id` é obrigatório e a identidade bibliográfica
é herdada do artigo; `canonical_scheme/value` é uma projeção validada, não autoridade concorrente.
Para documento regulatório/institucional, `article_id` é nulo. Unique normalizado
`(source_class, provider, canonical_scheme, canonical_value)` evita referências duplicadas. Índice
`(article_id)` parcial acelera reutilização por artigo.

#### `contextual_need_references`

- `contextual_need_id references contextual_needs(id) on delete restrict`;
- `reference_id references contextual_references(id) on delete restrict`;
- `selected_article_id uuid null references articles(id) on delete restrict`;
- `discovery_request_id`, `query`, `selected_by uuid null references auth.users(id)`, `selected_at`;
- PK `(contextual_need_id, reference_id)`.

`selected_article_id`, quando presente, deve ser igual a `contextual_references.article_id`. Essa
tabela expressa que a mesma referência pode atender várias necessidades sem compartilhar claim ou
autorização.

#### `external_context_acquisitions`

- `id text primary key`, `reference_id references contextual_references(id) on delete restrict`;
- `schema_version`, `retrieved_at`, `content_scope`, `media_type`, método/versão;
- `access_status`, campos de licença e base de aquisição;
- `checksum_algorithm = 'sha256'`, `content_checksum`, `byte_length`;
- `storage_mode in ('not_stored','inline','storage')`, `content_inline text null`,
  `storage_object_path text null`, `storage_bucket text null`;
- `supersedes_acquisition_id null references external_context_acquisitions(id)`;
- `created_by uuid null references auth.users(id)`, `created_at`.

Check exatamente um modo de conteúdo: `inline` requer texto e proíbe path; `storage` requer bucket e
path e proíbe texto; `not_stored` proíbe ambos. Unique `(reference_id, content_checksum,
content_scope)` torna repetição idempotente, sem afirmar que scopes diferentes são equivalentes.
Índices `(reference_id, retrieved_at desc)` e `(content_checksum)` suportam reutilização e auditoria.

#### `external_context_acquisition_anchors`

- `id text primary key`, `acquisition_id references external_context_acquisitions(id) on delete
restrict`, `schema_version`, `start_code_point`, `end_code_point`, `excerpt`, `excerpt_checksum`;
- unique `(acquisition_id, start_code_point, end_code_point, excerpt_checksum)`;
- checks `start >= 0`, `end > start`.

A validação transacional do writer deve recomputar conteúdo, checksum e excerpt antes do commit. O
banco sozinho não consegue validar offsets dentro de um objeto do Storage.

#### `contextual_claims` e `contextual_claim_revisions`

`contextual_claims(id primary key, contextual_need_id, created_at)` fornece identidade editorial
estável. Cada `contextual_claim_revisions` contém `claim_id`, `revision` SHA-256, `article_id`,
`contextual_need_id`, `reference_id`, `acquisition_id`, `statement`, `schema_version`, `created_by`,
`created_at`, com PK `(claim_id, revision)`. `article_id` deve coincidir com a necessidade; referência
e aquisição devem coincidir. Índices `(contextual_need_id, created_at desc)` e
`(acquisition_id)`.

Uma join table `contextual_claim_revision_anchors(claim_id, revision, anchor_id)` tem PK nas três
colunas e FK composta para a revisão; cada anchor deve pertencer à aquisição da revisão. Pelo menos
um anchor é obrigatório, imposto pelo comando transacional de criação (constraint trigger deferred
ou função server-only revisada).

#### `contextual_authorization_events`

- `id text primary key`, FK composta `(claim_id, claim_revision)` para a revisão exata;
- cópia verificável de `contextual_need_id`, `article_id`, `reference_id`, `acquisition_id` e
  `scope_checksum`;
- `decision in ('authorized','rejected','revoked')`, `reviewer_id uuid not null references
auth.users(id) on delete restrict`, `reviewed_at`, `created_at`;
- `supersedes_authorization_id null references contextual_authorization_events(id)`.

Não há `UPDATE` de decisão. Uma unique parcial permite no máximo uma decisão vigente por
`(claim_id, claim_revision)`, ou o writer serializa pelo claim e fecha a decisão anterior antes de
inserir a substituta. Índices `(claim_id, claim_revision, reviewed_at desc)` e
`(reviewer_id, reviewed_at desc)`. A projeção “claim autorizado atual” seleciona a última decisão
válida para a revisão exata; jamais procura autorização de outra revisão.

#### `verified_source_observations`

- `id text primary key`, `reference_id` e `acquisition_id` opcional com FKs;
- schema/version, `observed_at`, `verified_by uuid references auth.users(id) on delete restrict`;
- estado, source version/checksum, integridade de anchors, método/locator externo, scope comparado;
- `payload_checksum`, `created_at`;
- índices `(reference_id, observed_at desc)` e `(acquisition_id, observed_at desc)`.

É append-only; unique `payload_checksum` pode tornar a repetição exata idempotente, mas observações
legítimas em instantes diferentes não devem colidir se `observed_at` participa do hash.

#### `contextual_reuse_evaluation_snapshots`

- `id uuid primary key`, `evaluated_at`, `state`, `policy_version`, `policy jsonb`;
- FKs para artigo, necessidade, referência e aquisição opcional;
- `observation_ids uuid[]` **não é suficiente para integridade**; usar
  `contextual_reuse_evaluation_observations(evaluation_id, observation_id)`;
- razões e assessments em JSONB validados, `input_checksum`, `created_at`;
- unique `(input_checksum)` para o mesmo `asOf`, política e conjunto ordenado de inputs.

Só criar snapshot ao consumir o parecer em uma seleção/reverificação/job. O snapshot registra
`creates_editorial_authorization = false` com check literal.

### 5.2 Conteúdo: PostgreSQL versus Supabase Storage

1. **Metadata, abstracts e citações:** permanecem no PostgreSQL existente. Não copiar o abstract de
   `articles` para cada aquisição.
2. **Excerpt/page/section pequenos e licenciados:** podem ficar inline com limite a aprovar (proposta
   inicial: 256 KiB por aquisição). Isso simplifica transação e validação de anchors.
3. **Payload grande autorizado:** objeto imutável em bucket privado, com path derivado de ID opaco da
   aquisição e checksum, nunca do título. O PostgreSQL guarda checksum, tamanho, media type, licença,
   scope e path. Upload deve ir para path temporário, ser verificado e então promovido/registrado; um
   reconciliador remove temporários órfãos após TTL.
4. **Full text:** `not_stored` por padrão. Só `storage`/`inline` após comprovação explícita de direito
   de armazenamento e do uso pretendido. “Publicamente acessível”, PMCID ou flag open access, sem
   licença/base compatível, não basta. A licença pode também impedir exposição ao usuário mesmo que
   permita processamento interno.
5. **Sem direito de retenção:** guardar somente metadados permitidos, checksum se permitido, locator,
   scope `not_stored` e observação de acesso; anchors que dependam do conteúdo não podem ser
   declarados reutilizáveis localmente. Não guardar trechos como forma de contornar a licença.
6. **Deduplicação física:** objetos iguais podem compartilhar blob pelo checksum somente se os
   contextos de licença, retenção e acesso forem compatíveis. Cada aquisição mantém linha e
   proveniência próprias; garbage collection só remove blob sem referência.

O download nunca usa bucket público. Um endpoint server-side valida sessão, entitlement/editor role,
licença e finalidade antes de emitir resposta curta ou signed URL de duração mínima. Signed URL não
transforma conteúdo restrito em conteúdo redistribuível.

## 6. Identidade, versões e transições de estado

### Nova aquisição da mesma referência

Criar nova linha; não atualizar a anterior. Conteúdo normalizado e checksum iguais tornam a operação
idempotente e podem reutilizar o blob. Checksum, versão ou scope diferentes criam nova aquisição com
`supersedes_acquisition_id`. Claims existentes continuam apontando para a aquisição antiga e não se
tornam claims da nova.

### Mudança da fonte

Registrar `VerifiedSourceObservation(sourceState = changed)`, bloquear reuse da aquisição afetada e
obter nova aquisição. Não editar reference/acquisition histórica para parecer atual. Um novo claim
pode copiar texto como ponto de partida, mas recebe nova revisão, anchors da nova aquisição e revisão
humana independente.

### Revisão de claim

Qualquer alteração de statement, necessidade, referência, aquisição, anchors ou evidência muda o
hash de revisão. A autorização anterior permanece no histórico e não aparece na projeção corrente.
Mesmo texto sobre nova aquisição é nova revisão e **não herda autorização**.

### Fonte desatualizada

Política temporal e observações produzem avaliação de reverificação. “Desatualizada” não apaga
evidência histórica; impede nova utilização até avaliação/observação suficiente. Publicações já
geradas precisam guardar o claim revision usado para permitir retirada ou reavaliação posterior.

### Anchors e checksums

Offsets são em Unicode code points sobre o conteúdo NFC com CRLF/CR convertido em LF, conforme o
contrato. Checksum é dos bytes UTF-8 dessa representação. Anchors pertencem a uma única aquisição e
nunca são remapeados automaticamente. `excerpt_checksum` detecta corrupção adicional, mas o
checksum do conteúdo continua sendo a autoridade de integridade do payload.

## 7. Idempotência, concorrência e recuperação

- Cada comando de escrita recebe `operation_key` e hash do request em ledger server-only, seguindo o
  padrão de ingestão. Mesma chave + mesmo hash retorna o resultado anterior; mesma chave + hash
  diferente falha.
- Resolver artigo e inserir `article_sources` usa o pipeline existente. Em corrida de DOI/PMID/PMCID
  ou `(provider, external_id)`, capturar somente a violação única esperada, reler a identidade
  vencedora e repetir a transação; não escolher artigo arbitrariamente.
- Criação de necessidade, referência, aquisição, anchors e revisão ocorre em transação. Checksums são
  recomputados no servidor confiável, não aceitos do browser como autoridade.
- Workers de aquisição usam claim token, lease curta, tentativas limitadas e compare-and-set na
  finalização, reaproveitando o desenho de summaries. Worker com lease perdido não publica estado.
- Storage e PostgreSQL não têm transação distribuída: primeiro upload temporário, depois validação e
  insert transacional, finalmente promoção/estado `ready`. Falha deixa item `pending` retomável;
  reconciliador idempotente conclui ou remove temporário. Claims só aceitam aquisição `ready`.
- Locks/advisory locks por referência evitam duas promoções correntes conflitantes; constraints
  únicas continuam sendo a barreira final.
- Deletes físicos ficam proibidos para artefatos referenciados. Retenção/licença usa estado tombstone
  (`content_removed_at`, razão e ator), preservando metadados, checksum e auditoria sem conservar o
  conteúdo proibido.

## 8. Segurança, acesso e custo

### Operações internas privilegiadas

Descoberta, ingestão de artigo, upload, checksum, criação/finalização de aquisição e avaliações em
batch são server-only com `service_role` ou RPCs estritamente revogadas de `public`, `anon` e
`authenticated`. Service role nunca entra no browser. Payloads, excerpts, URLs assinadas, tokens e
erros de provider não entram em logs; logs usam IDs/hash e códigos sanitizados.

### Revisão humana

O browser autenticado não recebe poder genérico de `INSERT/UPDATE`. Um endpoint/RPC server-side
valida a sessão Supabase, consulta `staff_roles` (`editor` ou papel futuro aprovado), deriva
`reviewer_id` de `auth.uid()`/sessão validada e grava uma decisão append-only. ID de revisor enviado
pelo cliente não é autoridade. Revisor pode ler apenas os artefatos/licenças necessários ao caso.

### Usuário final

Usuários não leem tabelas internas, observações, decisões rejeitadas, conteúdo restrito nem paths do
Storage. Uma projeção/API allowlisted expõe apenas claims autorizados da revisão atual e metadados de
proveniência adequados. Excerpt/full text só é exposto se a licença autorizar redistribuição e a
política do produto permitir. RLS deve ser habilitada em todas as novas tabelas; por padrão, nenhum
grant para `anon` e nenhum write para `authenticated`.

### Reutilização e custo

Antes de nova aquisição, procurar referência canônica e aquisições `ready`, comparar licença/scope e
executar a avaliação com política atual e observação externa recente. Uma aquisição aprovada pode
ser proposta para várias necessidades e artigos, reduzindo tráfego e armazenamento. Essa reutilização
não transporta `ContextualClaimCandidate`, decisão humana nem autorização: cada necessidade cria
claim/revisão e decisão próprias.

Minimizar duplicação com `articles`/`article_sources`, checksum de conteúdo e blobs compartilhados
somente sob licenças compatíveis. Métricas de custo devem contar aquisição, bytes, verificações e
eventuais chamadas pagas por `operation_key`, sem conteúdo científico nos logs.

## 9. Integridade mínima

As migrations futuras devem impor, além das FKs e checks acima:

1. todo `contextual_need.article_id` existe e não muda;
2. referência bibliográfica resolve um único `articles.id`; nenhuma FK bibliográfica aponta para uma
   entidade paralela;
3. aquisição pertence à referência declarada e anchors pertencem à aquisição;
4. revisão de claim pertence à mesma necessidade/artigo e usa referência, aquisição e anchors
   coerentes;
5. autorização referencia PK composta de revisão exata e seu scope checksum é recomputado;
6. observação com `acquisition_id` pertence à mesma referência;
7. avaliação registra a política e o conjunto exato de observações, e nunca autoriza editorialmente;
8. schema versions desconhecidas falham fechadas até haver leitor/migração explícitos;
9. timestamps de revisão/aquisição/observação futuros são rejeitados segundo tolerância de clock a
   aprovar;
10. JSONB é reservado ao payload versionado e atributos variáveis; identidades e FKs críticas ficam
    em colunas tipadas e indexadas.

## 10. Evolução para diretrizes clínicas

Diretriz não deve ser inserida em `articles`. Uma fase futura pode criar
`guideline_publications` (autoridade, título, edição, vigência) e `guideline_units` hierárquicas
(capítulo/seção/recomendação, versão e estabilidade). `contextual_references` recebe então um target
explícito para guideline por migration aditiva, com check de exatamente um alvo: artigo, guideline ou
documento institucional externo.

Aquisições continuam ligadas à referência, enquanto anchors futuros ganham locators semânticos de
edição/capítulo/recomendação além de offsets. Uma nova edição é nova versão/publicação relacionada,
não overwrite; recomendação revisada não herda decisão anterior. Esta ADR apenas reserva a separação
de identidade e não define nem implementa processamento de diretrizes.

## 11. Riscos e mitigação

- **Licença ambígua:** default `not_stored`, revisão jurídica/produto antes de retenção ou exposição.
- **JSON e schema divergirem:** validar Zod no writer e constraints/projeções no banco; testes de
  compatibilidade por schema version.
- **Crescimento de histórico:** retenção diferenciada para logs transitórios; preservar decisões e
  linhagem; conteúdo removível por política sem apagar auditoria.
- **Hash correto sobre representação errada:** uma única função server-only de normalização/hash e
  vetores de teste Unicode/line ending.
- **RLS acidentalmente permissiva:** deny-by-default, grants explícitos e testes runtime de anon,
  usuário, editor e service role.
- **Corrida entre atualização e autorização:** transação/lock no claim e FK para revisão; projeção
  verifica decisão vigente e revisão exata.
- **Storage órfão ou DB sem objeto:** estado `pending/ready/removed`, upload temporário e reconciliador
  idempotente.
- **Referência institucional virar “artigo”:** constraint por `source_class` e alvo explícito;
  diretrizes terão entidade própria.

## 12. Sequência sugerida de implementação

1. Aprovar decisões pendentes abaixo e confirmar o estado remoto real das migrations antes de criar
   qualquer migration aditiva.
2. Especificar contratos de persistência, normalização canônica e matriz de transições; adicionar
   testes unitários de identidade, revisão e não-herança de autorização.
3. Criar migration aditiva para necessidades, referências e vínculo com `articles`; implementar
   writer service-only idempotente e testes de RLS.
4. Criar acquisitions/anchors com modo `not_stored` e inline limitado; validar checksums e falhas
   transacionais antes de habilitar Storage.
5. Criar claim revisions e authorization events append-only, API de revisão derivando reviewer da
   sessão e projeção de claims autorizados.
6. Criar observations e snapshots de reuse; conectar o avaliador determinístico sem conceder
   autorização automática.
7. Se aprovado, criar bucket privado, fluxo temporário/ready, reconciliador, retenção e testes reais
   de acesso. Não ativar full text até aprovação de licença.
8. Instrumentar métricas sanitizadas, runbook de recuperação e auditoria de concorrência/custo; só
   então considerar integração editorial.

## 13. Decisões que exigem aprovação antes de implementar

1. **Modelo lógico e nomes:** conjunto de tabelas, eventos append-only e vínculo obrigatório de
   referências bibliográficas a `articles.id`.
2. **Retenção:** prazos para conteúdo, temporários, logs de descoberta, observações e tombstones.
3. **Licenciamento:** matriz por provider/licença/scope para armazenar, processar, mostrar excerpt ou
   redistribuir; responsável pela aprovação.
4. **Storage:** criação/nome/região do bucket privado, limite inline (proposta de 256 KiB), criptografia,
   signed URLs, antivírus/DLP e compartilhamento físico por checksum.
5. **Papéis e segregação:** quais `staff_roles` podem adquirir, revisar, autorizar, revogar e ver
   conteúdo restrito; se revisão dupla é necessária.
6. **Temporalidade:** políticas por classe de fonte, tolerância de relógio e quando uma observação
   externa deve ser renovada.
7. **Revogação/publicação:** efeito de fonte alterada ou licença retirada sobre drafts/publicações já
   produzidos e SLA de retirada.
8. **Operação:** fila/worker, leases, limites de tentativa, rate limits e orçamento por provider.
9. **Diretrizes futuras:** entidade e identificadores próprios serão decididos em fase separada; não
   adicionar `guideline_id` até esse modelo ser aprovado.

Até essas aprovações, esta ADR é uma recomendação arquitetural e não autorização para migration,
bucket, chamada paga, ingestão remota ou mudança de RLS.
