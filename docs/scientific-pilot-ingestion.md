# Runbook do primeiro piloto científico (execução manual futura)

> **Estado:** preparação somente. Este documento não autoriza ingestão, classificação, backfill ou
> reconciliação. As migrations científicas até `202609280001` já foram aplicadas; não as reaplique.

## 1. Configuração server-side no Vercel

Configure apenas nos ambientes explicitamente aprovados, sem prefixo `VITE_`:

- `SCIENTIFIC_INGESTION_TOKEN`: segredo exclusivo deste endpoint, com pelo menos 32 caracteres;
- `SCIENTIFIC_PILOT_QUERY`: exatamente uma query PubMed escolhida e aprovada por duas pessoas;
- `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`: configuração
  server-side já existente do projeto;
- `NCBI_API_KEY`: opcional, para os limites operacionais do NCBI.

Gere o token localmente com `openssl rand -base64 48`, salve-o diretamente no secret manager da Vercel
e nunca o reutilize como service-role key. Não coloque token ou query em URL, commit, ticket ou fixture.
Após configurar, faça novo deploy e confirme que nenhuma variável sensível foi incluída em bundle `VITE_`.

## 2. Aprovação da query

Antes do deploy, um revisor clínico deve escolher **uma** candidata abaixo, conferir sua sintaxe no
PubMed sem executar o endpoint Dose e registrar objetivo, tópico V1, janela e aprovadores. Não altere a
query entre replay de uma mesma operação.

1. `("Heart Failure"[Mesh] OR "heart failure"[Title]) AND (randomized controlled trial[pt] OR controlled clinical trial[pt])`
   — exercita **insuficiência cardíaca** com frase/MeSH específicos e publication type conservador.
2. `("Atrial Fibrillation"[Mesh] OR "atrial fibrillation"[Title]) AND (anticoagulants[Mesh] OR ablation[Title/Abstract])`
   — exercita **fibrilação atrial**, restringindo a intervenções reconhecíveis.
3. `("Renal Insufficiency, Chronic"[Mesh] OR "chronic kidney disease"[Title]) AND (cohort studies[Mesh] OR randomized controlled trial[pt])`
   — exercita **doença renal crônica** com desenho de estudo delimitado.
4. `("Sepsis"[Mesh] OR "septic shock"[Title]) AND (anti-bacterial agents[Mesh] OR antibiotic*[Title/Abstract])`
   — exercita **sepse e antibióticos**; antibiótico isolado não é o critério temático.

A janela recente é fornecida separadamente por `dateFrom`/`dateTo`; não embuta datas na query aprovada.
Nenhuma candidata contém dados pessoais e nenhuma deve ser executada durante a revisão deste PR.

## 3. Chamada aprovada

Gere uma chave não sensível e única, por exemplo com
`printf 'pilot_%s_%s' "$(date -u +%Y%m%d)" "$(openssl rand -hex 8)"`. Ela deve ter 16–80 caracteres e
usar somente letras, números, `_` ou `-`. Guarde-a junto ao registro da aprovação.

Payload exato (datas e chave são exemplos a substituir pela janela aprovada de no máximo 366 dias):

```json
{
  "operationKey": "pilot_20260919_a1b2c3d4e5f60708",
  "limit": 10,
  "dateFrom": "2026-08-20",
  "dateTo": "2026-09-19"
}
```

Faça uma única chamada a partir de terminal controlado; o endpoint aceita somente `POST`, PubMed e
`limit` de 1–20 (default 10):

```sh
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $SCIENTIFIC_INGESTION_TOKEN" \
  --header "Content-Type: application/json" \
  --data @approved-pilot-payload.json \
  "https://<deployment-aprovado>/api/scientific-pilot"
```

O relatório esperado contém `operationKey`, `providers: ["pubmed"]`, `discovered`, `normalized`,
`deduplicated`, `inserted`, `mergedOrUpdated`, `skipped`, `failed`, `durationMs` e códigos sanitizados em
`errors`. Replay com a mesma chave, query e payload deve retornar o mesmo relatório com `replayed: true`;
a mesma chave com conteúdo diferente deve retornar conflito. Não tente contornar operação em andamento
ou com falha criando chaves repetidamente: investigue o ledger primeiro.

## 4. Auditoria depois da chamada

1. Exporte logs do deployment no intervalo e procure nomes de variáveis, `Authorization`, `Bearer`, o
   token e trechos da query. Os logs devem conter apenas status, duração, chave e contagens; abstracts,
   payload integral, connection string e secrets são incidente de segurança.
2. Compare as contagens do relatório com `scientific_ingestion_operations` e consulte, em console
   administrativo controlado, os `articles`/`article_sources` criados ou atualizados naquela janela.
   Verifique título, autores, periódico, data, DOI/PMID/PMCID, URLs e ausência de full text; inspecione
   manualmente duplicatas por DOI → PMID → PMCID → fallback bibliográfico.
3. Gere um snapshot read-only pelos RPCs científicos e execute o planejador de dry-run temático. O dry-run
   deve produzir matches/no-matches e **não** escrever em `article_topics`.
4. Revise cada proposta contra evidência, confiança e regra V1. Antes de qualquer reconciliação/backfill,
   humanos devem confirmar: precisão aceitável sem falso positivo crítico; associações many-to-many
   corretas; abreviação ou medicamento isolado não causou match; editoriais permanecem protegidos;
   no-match é aceitável; amostra, contagens e duplicação foram auditadas; e houve autorização separada,
   explícita e registrada para escrita.

O endpoint não classifica artigos, não chama IA e não executa backfill. Falha de provider ou persistência
é reportada por código sanitizado; detalhes de infraestrutura devem ser investigados somente nos canais
operacionais protegidos.