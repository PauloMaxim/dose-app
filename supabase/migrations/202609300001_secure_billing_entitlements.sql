-- Provider-agnostic, atomic financial reconciliation. Forward-only; do not run
-- from the application. Existing billing tables and RLS remain authoritative.

alter table public.subscriptions
  add column last_provider_event_at timestamptz,
  add column last_provider_event_id text;

alter table public.payment_events
  add column occurred_at timestamptz,
  add column normalized_type text,
  add column processing_result text
    check (processing_result is null or processing_result in ('applied', 'stale', 'rejected'));

alter table public.entitlements
  add column source text not null default 'legacy'
    check (source ~ '^[a-z0-9_-]{1,40}$'),
  add column metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object');

create index subscriptions_provider_order_idx
  on public.subscriptions (provider, external_id, last_provider_event_at desc);

comment on column public.plans.features is
  'Commercial configuration only; never an authorization decision.';
comment on column public.payment_events.payload is
  'Sanitized normalized metadata only. Never store raw webhook payloads or secrets.';
comment on table public.entitlements is
  'Canonical internal authorization state; plans and payments do not grant access.';

-- Called only after raw-body signature verification and normalization in the
-- server adapter. Provider identifiers resolve an already server-created
-- subscription; no webhook-supplied user id is accepted.
create or replace function public.reconcile_verified_payment_event(
  p_provider text,
  p_event_id text,
  p_normalized_type text,
  p_occurred_at timestamptz,
  p_subscription_external_id text default null,
  p_subscription_status text default null,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_payment_external_id text default null,
  p_payment_status text default null,
  p_amount_minor bigint default null,
  p_currency text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_status public.subscription_status;
  v_payment_status public.payment_status;
begin
  if p_provider !~ '^[a-z0-9_-]{1,40}$'
     or nullif(p_event_id, '') is null or char_length(p_event_id) > 255
     or p_normalized_type not in ('subscription.changed', 'payment.recorded')
     or p_occurred_at is null or p_occurred_at > now() + interval '5 minutes' then
    raise exception 'invalid normalized financial event';
  end if;

  insert into public.payment_events (
    provider, event_id, event_type, normalized_type, payload,
    signature_verified, received_at, occurred_at
  ) values (
    p_provider, p_event_id, p_normalized_type, p_normalized_type, '{}'::jsonb,
    true, now(), p_occurred_at
  ) on conflict (provider, event_id) do nothing;
  if not found then
    return 'duplicate';
  end if;

  if p_subscription_external_id is null then
    update public.payment_events set processed_at = now(), processing_result = 'rejected',
      processing_error = 'subscription mapping unavailable'
    where provider = p_provider and event_id = p_event_id;
    return 'rejected';
  end if;

  select * into v_subscription from public.subscriptions
    where provider = p_provider and external_id = p_subscription_external_id
    for update;
  if not found then
    update public.payment_events set processed_at = now(), processing_result = 'rejected',
      processing_error = 'subscription mapping unavailable'
    where provider = p_provider and event_id = p_event_id;
    return 'rejected';
  end if;

  if v_subscription.last_provider_event_at is not null
     and (p_occurred_at, p_event_id) <=
       (v_subscription.last_provider_event_at, coalesce(v_subscription.last_provider_event_id, '')) then
    update public.payment_events set processed_at = now(), processing_result = 'stale'
      where provider = p_provider and event_id = p_event_id;
    return 'stale';
  end if;

  if p_normalized_type = 'subscription.changed' then
    v_status := case p_subscription_status
      when 'pending' then 'incomplete'::public.subscription_status
      when 'active' then 'active'::public.subscription_status
      when 'past_due' then 'past_due'::public.subscription_status
      when 'canceled' then 'canceled'::public.subscription_status
      when 'expired' then 'expired'::public.subscription_status
      else null end;
    if v_status is null then raise exception 'invalid subscription status'; end if;

    update public.subscriptions set
      status = v_status,
      current_period_start = p_period_start,
      current_period_end = p_period_end,
      cancel_at_period_end = p_cancel_at_period_end,
      canceled_at = case when v_status = 'canceled' then p_occurred_at else canceled_at end,
      last_provider_event_at = p_occurred_at,
      last_provider_event_id = p_event_id
    where id = v_subscription.id;

    insert into public.entitlements (
      user_id, plan_id, subscription_id, key, status, starts_at, ends_at, source, metadata
    ) values (
      v_subscription.user_id, v_subscription.plan_id, v_subscription.id, 'premium',
      case when v_status = 'active' then 'active'::public.entitlement_status
           when v_status = 'expired' then 'expired'::public.entitlement_status
           else 'inactive'::public.entitlement_status end,
      coalesce(p_period_start, p_occurred_at), p_period_end, p_provider, '{}'::jsonb
    ) on conflict (user_id, key) do update set
      plan_id = excluded.plan_id,
      subscription_id = excluded.subscription_id,
      status = excluded.status,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      source = excluded.source,
      metadata = '{}'::jsonb;
  elsif p_normalized_type = 'payment.recorded' then
    v_payment_status := p_payment_status::public.payment_status;
    if p_payment_external_id is null or p_amount_minor is null or p_amount_minor < 0
       or p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid payment data'; end if;
    insert into public.payments (
      user_id, subscription_id, provider, external_id, status, amount_minor, currency, paid_at
    ) values (
      v_subscription.user_id, v_subscription.id, p_provider, p_payment_external_id,
      v_payment_status, p_amount_minor, p_currency,
      case when v_payment_status = 'succeeded' then p_occurred_at else null end
    ) on conflict (provider, external_id) where external_id is not null do update set
      status = excluded.status,
      paid_at = excluded.paid_at;
    -- Payment audit state deliberately never mutates entitlement.
  end if;

  update public.payment_events set processed_at = now(), processing_result = 'applied'
    where provider = p_provider and event_id = p_event_id;
  return 'applied';
exception when others then
  -- The transaction rolls back, including the event claim. Callers log only a
  -- sanitized category and may retry; database errors never become stored secrets.
  raise;
end;
$$;

revoke all on function public.reconcile_verified_payment_event(
  text, text, text, timestamptz, text, text, timestamptz, timestamptz,
  boolean, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.reconcile_verified_payment_event(
  text, text, text, timestamptz, text, text, timestamptz, timestamptz,
  boolean, text, text, bigint, text
) to service_role;

revoke insert, update, delete on public.subscriptions, public.payments,
  public.payment_events, public.entitlements from authenticated;
