# Scientific ingestion — Phase 3A

The trusted server pipeline is `discover → fetch metadata → normalize → deduplicate → persist`. It uses the official PubMed E-utilities, Europe PMC REST API, and Crossref REST API. It stores metadata and source-provided abstracts only; full text is deliberately not represented or fetched. A PMCID or open-access flag is metadata, not permission to redistribute an article.

## Identity and merge rules

Identity priority is normalized DOI, PMID, PMCID, then an exact conservative key consisting of Unicode-normalized title, complete publication date, and the first author's exact normalized family name. The fallback is unavailable unless all three components exist, and no fuzzy matching is performed.

Merging never replaces a non-null value with null. It keeps valid identifiers, chooses the longer title/abstract, chooses the structurally richer author list, unions publication types, keywords and MeSH terms, and unions provenance by provider/external ID. Re-running the same source record finds its `article_sources` row and updates the existing article. Database unique indexes are the final concurrency guard.

`article_sources.metadata` records discovery source and any source-reported open-access/license values. These values do not authorize full-text collection. Crossref contact is supplied only through the optional `CROSSREF_MAILTO`; no contact is fabricated. `NCBI_API_KEY`, when provided, is read only in the server adapter.

## Operations and security

No public ingestion route is created. A trusted job must obtain the existing service-role client and call `discoverAndIngestScientificArticles`. Adapter modules contain a browser guard and secrets are neither returned nor logged. HTTP calls have a ten-second default timeout, two bounded retries for 429/5xx/network failures, and honor a bounded `Retry-After` delay.

Apply `202609200001_scientific_ingestion.sql` manually before enabling persistence in an environment. It is additive and does not change existing RLS policies or the relationships used by saved articles, notes, collections, or reading progress.
