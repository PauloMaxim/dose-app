-- Phase 3A: additive scientific metadata. Existing catalog/user foreign keys remain intact.
alter table public.articles
  add column abstract text,
  add column authors jsonb not null default '[]'::jsonb check (jsonb_typeof(authors) = 'array'),
  add column journal text,
  add column publisher text,
  add column pmcid text check (pmcid is null or pmcid ~ '^PMC[0-9]+$'),
  add column language text,
  add column publication_types text[] not null default '{}',
  add column volume text,
  add column issue text,
  add column pages text,
  add column original_url text,
  add column pubmed_url text,
  add column pmc_url text,
  add column doi_url text,
  add column keywords text[] not null default '{}',
  add column mesh_terms text[] not null default '{}',
  add column bibliographic_key text,
  add column ingested_at timestamptz;

create unique index articles_pmcid_uidx on public.articles (pmcid) where pmcid is not null;
create unique index articles_bibliographic_key_uidx on public.articles (bibliographic_key)
  where bibliographic_key is not null and doi_normalized is null and pmid is null and pmcid is null;

comment on column public.articles.abstract is 'Publisher/source supplied abstract; not full text and not AI generated.';
comment on column public.articles.bibliographic_key is 'Conservative exact title/date/first-author fallback used only without DOI, PMID or PMCID.';
