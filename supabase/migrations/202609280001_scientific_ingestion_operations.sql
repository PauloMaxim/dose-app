-- Phase 3C.1: server-owned idempotency ledger for explicitly triggered pilot ingestions.
create table public.scientific_ingestion_operations (
  operation_key text primary key check (operation_key ~ '^[A-Za-z0-9_-]{16,80}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('running', 'completed', 'failed')),
  report jsonb check (report is null or jsonb_typeof(report) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.scientific_ingestion_operations enable row level security;
revoke all on table public.scientific_ingestion_operations from public, anon, authenticated;
grant select, insert, update on table public.scientific_ingestion_operations to service_role;

comment on table public.scientific_ingestion_operations is
  'Server-only idempotency and sanitized metrics for manually approved scientific ingestion operations.';
