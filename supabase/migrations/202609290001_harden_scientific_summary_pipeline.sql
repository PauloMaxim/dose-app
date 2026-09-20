-- Prompt 9: additive production claim/lease and observability for scientific summaries.
-- Forward-only: the historical 202609220001 migration remains unchanged.
alter table public.article_summaries
  add column claim_token uuid,
  add column lease_expires_at timestamptz,
  add column failure_code text,
  add column duration_ms integer check (duration_ms >= 0);

alter table public.article_summaries
  add constraint article_summaries_processing_lease_check check (
    status <> 'processing' or
    (claimed_at is not null and claim_token is not null and lease_expires_at is not null)
  ) not valid,
  add constraint article_summaries_token_totals_check check (
    total_tokens is null or input_tokens is null or output_tokens is null or
    total_tokens >= input_tokens + output_tokens
  ) not valid;

-- A caller owns a generation only when the returned claim_token equals its token.
-- Conflict updates are limited to retryable rows or expired leases and bounded attempts.
create function public.claim_article_summary(
  p_article_id uuid,
  p_identity_key text,
  p_input_hash text,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_schema_version text,
  p_claim_token uuid,
  p_lease_seconds integer,
  p_max_attempts integer
) returns public.article_summaries
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.article_summaries (
    article_id, identity_key, input_hash, status, provider, model,
    prompt_version, schema_version, attempts, claimed_at, claim_token, lease_expires_at
  ) values (
    p_article_id, p_identity_key, p_input_hash, 'processing', p_provider, p_model,
    p_prompt_version, p_schema_version, 1, now(), p_claim_token,
    now() + make_interval(secs => least(greatest(p_lease_seconds, 1), 900))
  )
  on conflict (identity_key) do update set
    status = 'processing',
    attempts = article_summaries.attempts + 1,
    claimed_at = now(),
    claim_token = excluded.claim_token,
    lease_expires_at = excluded.lease_expires_at,
    sanitized_error = null,
    failure_code = null
  where article_summaries.attempts < least(greatest(p_max_attempts, 1), 20)
    and (
      article_summaries.status = 'failed_retryable'
      or (article_summaries.status = 'processing' and article_summaries.lease_expires_at < now())
    )
  returning article_summaries.*;
$$;

revoke all on function public.claim_article_summary(uuid, text, text, text, text, text, text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_article_summary(uuid, text, text, text, text, text, text, uuid, integer, integer) to service_role;

comment on function public.claim_article_summary is 'Trusted-only atomic idempotency claim. Ownership is proven by the caller-generated claim token.';
comment on column public.article_summaries.failure_code is 'Sanitized stable failure taxonomy; provider response bodies are never stored.';
comment on column public.article_summaries.duration_ms is 'End-to-end duration for the most recent bounded generation attempt.';
