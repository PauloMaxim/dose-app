-- Allow the trusted ingestion client to persist the scientific catalog.
-- UUID primary keys use gen_random_uuid(), so no sequence privileges are required.
grant select, insert, update on table public.articles to service_role;
grant select, insert, update on table public.article_sources to service_role;
