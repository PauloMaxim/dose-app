-- Phase 3C: shared, versioned scientific summaries. Additive and intentionally not applied remotely.
create type public.article_summary_status as enum ('pending', 'processing', 'completed', 'failed_retryable', 'failed_permanent');

create table public.article_summaries (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  identity_key text not null unique check (identity_key ~ '^[0-9a-f]{64}$'),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  status public.article_summary_status not null default 'pending',
  structured_summary jsonb check (structured_summary is null or jsonb_typeof(structured_summary) = 'object'),
  provider text not null,
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  attempts integer not null default 0 check (attempts between 0 and 20),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  total_tokens integer check (total_tokens >= 0),
  cached_tokens integer check (cached_tokens >= 0),
  estimated_cost_micros bigint check (estimated_cost_micros >= 0),
  cost_config_version text,
  generation_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(generation_metadata) = 'object'),
  sanitized_error text check (char_length(sanitized_error) <= 500),
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_summaries_completed_payload check (status <> 'completed' or (structured_summary is not null and completed_at is not null))
);

create index article_summaries_article_completed_idx on public.article_summaries (article_id, completed_at desc) where status = 'completed';
create trigger article_summaries_set_updated_at before update on public.article_summaries
for each row execute function public.set_updated_at();

alter table public.article_summaries enable row level security;
-- Completed summaries are reusable assets for authenticated product users.
create policy article_summaries_select_completed on public.article_summaries for select to authenticated
using (status = 'completed');

revoke all on public.article_summaries from anon;
revoke insert, update, delete, truncate, references, trigger on public.article_summaries from authenticated;
grant select on public.article_summaries to authenticated;

comment on table public.article_summaries is 'Server-generated summaries shared by deterministic content/config identity; never stores chain-of-thought or secrets.';
comment on column public.article_summaries.identity_key is 'SHA-256 over article, scientific input hash, prompt/schema versions, provider, and model.';
