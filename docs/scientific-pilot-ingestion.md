# Ingestão científica piloto no runtime Vercel

Este runbook prepara uma execução manual futura. Ele não é cron, fila ou autorização para executar o
piloto sem revisão operacional.

## Pré-requisitos

1. Revisar e aplicar separadamente a migration `202609280001_scientific_ingestion_operations.sql`.
2. Configurar no Vercel, somente para o runtime server-side:
   - `SCIENTIFIC_INGESTION_TOKEN`: segredo dedicado com pelo menos 32 caracteres;
   - `SCIENTIFIC_PILOT_QUERY`: uma única consulta PubMed aprovada, entre 3 e 300 caracteres;
   - configurações Supabase server-side já existentes;
   - opcionalmente `NCBI_API_KEY` para limites operacionais do NCBI.
3. Não prefixar os dois novos valores com `VITE_` e não reutilizar a service-role key como token.

## Execução futura — não executar nesta fase

Gerar previamente uma operation key única, estável e sem informação sensível. Fazer uma única chamada:

```sh
curl --fail-with-body --request POST \
  --header "Authorization: Bearer $SCIENTIFIC_INGESTION_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"operationKey":"pilot_2026_approved_0001","limit":10,"dateFrom":"2026-01-01","dateTo":"2026-09-30"}' \
  "https://<deployment-aprovado>/api/scientific-pilot"
```

Não colocar o token, a query ou dados clínicos na URL. Não elevar `limit` acima de 20. A operação usa
somente PubMed, com timeout de 8 segundos por tentativa e um retry; a busca PubMed normalmente faz uma
requisição de IDs e uma requisição de metadata/XML. Persistência é sequencial e idempotente.

Repetir exatamente a mesma operation key e payload retorna o relatório armazenado. A mesma key com outro
payload falha com conflito. Uma execução concorrente permanece bloqueada pelo registro único no banco.

O relatório contém somente métricas e códigos de erro sanitizados; não contém abstracts, full text ou
secrets. Depois do piloto: auditar os registros, executar dry-run temático, fazer revisão humana e somente
então decidir sobre reconciliação. O endpoint não classifica nem chama o backfill.
