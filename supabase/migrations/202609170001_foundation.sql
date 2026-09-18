-- Dose production foundation for Supabase PostgreSQL.
-- Additive and reproducible: no existing application tables are dropped.

create extension if not exists pgcrypto with schema extensions;

create type public.subscription_status as enum (
  'incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'expired'
);
create type public.payment_status as enum (
  'pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded'
);
create type public.entitlement_status as enum ('active', 'inactive', 'expired', 'revoked');
create type public.staff_role as enum ('admin', 'support', 'billing', 'editor');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 100),
  avatar_path text,
  locale text not null default 'pt-BR' check (locale ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  timezone text not null default 'America/Sao_Paulo',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.specialties (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default extensions.gen_random_uuid(),
  specialty_id uuid references public.specialties(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_interests (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  specialty_id uuid references public.specialties(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_interests_exactly_one_target check (
    (specialty_id is not null and topic_id is null)
    or (specialty_id is null and topic_id is not null)
  )
);
create unique index user_interests_specialty_uidx
  on public.user_interests (user_id, specialty_id) where specialty_id is not null;
create unique index user_interests_topic_uidx
  on public.user_interests (user_id, topic_id) where topic_id is not null;

-- Minimal article catalog required by saved_articles and reading_progress.
-- Collection, ranking and AI processing intentionally remain out of scope.
create table public.articles (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  doi text,
  doi_normalized text generated always as (
    nullif(lower(regexp_replace(trim(doi), '^https?://(dx\\.)?doi\\.org/', '', 'i')), '')
  ) stored,
  pmid text check (pmid is null or pmid ~ '^[0-9]+$'),
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index articles_doi_normalized_uidx on public.articles (doi_normalized)
  where doi_normalized is not null;
create unique index articles_pmid_uidx on public.articles (pmid) where pmid is not null;
create index articles_published_at_idx on public.articles (published_at desc nulls last);

create table public.article_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  provider text not null check (char_length(trim(provider)) > 0),
  external_id text not null check (char_length(trim(external_id)) > 0),
  source_url text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index article_sources_article_id_idx on public.article_sources (article_id);

create table public.article_topics (
  article_id uuid not null references public.articles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (article_id, topic_id)
);
create index article_topics_topic_id_idx on public.article_topics (topic_id, article_id);

create table public.saved_articles (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);
create index saved_articles_article_id_idx on public.saved_articles (article_id);

create table public.reading_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  last_position text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id),
  constraint reading_progress_completion check (
    completed_at is null or progress_percent = 100
  )
);
create index reading_progress_recent_idx on public.reading_progress (user_id, updated_at desc);

create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  digest_frequency text not null default 'weekly'
    check (digest_frequency in ('off', 'daily', 'weekly')),
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) > 0),
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

create table public.plans (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  provider text not null,
  external_id text not null,
  status public.subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);
create index subscriptions_user_status_idx on public.subscriptions (user_id, status);

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null,
  external_id text,
  status public.payment_status not null default 'pending',
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payments_provider_external_id_uidx
  on public.payments (provider, external_id) where external_id is not null;
create index payments_user_created_idx on public.payments (user_id, created_at desc);
create index payments_subscription_id_idx on public.payments (subscription_id)
  where subscription_id is not null;

create table public.payment_events (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  signature_verified boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, event_id)
);
create index payment_events_pending_idx on public.payment_events (received_at)
  where processed_at is null;

create table public.entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  key text not null check (key ~ '^[a-z0-9_.-]+$'),
  status public.entitlement_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  constraint entitlement_time_range check (ends_at is null or ends_at > starts_at)
);
create index entitlements_access_idx on public.entitlements (user_id, key, status, ends_at);

create table public.staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_staff_role(required_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_roles sr
    where sr.user_id = auth.uid()
      and (required_roles is null or sr.role::text = any(required_roles))
  );
$$;
revoke all on function public.has_staff_role(text[]) from public;
grant execute on function public.has_staff_role(text[]) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'))
  on conflict (id) do nothing;
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger specialties_set_updated_at before update on public.specialties
for each row execute function public.set_updated_at();
create trigger topics_set_updated_at before update on public.topics
for each row execute function public.set_updated_at();
create trigger articles_set_updated_at before update on public.articles
for each row execute function public.set_updated_at();
create trigger article_sources_set_updated_at before update on public.article_sources
for each row execute function public.set_updated_at();
create trigger reading_progress_set_updated_at before update on public.reading_progress
for each row execute function public.set_updated_at();
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function public.set_updated_at();
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function public.set_updated_at();
create trigger plans_set_updated_at before update on public.plans
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger entitlements_set_updated_at before update on public.entitlements
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.specialties enable row level security;
alter table public.topics enable row level security;
alter table public.user_interests enable row level security;
alter table public.articles enable row level security;
alter table public.article_sources enable row level security;
alter table public.article_topics enable row level security;
alter table public.saved_articles enable row level security;
alter table public.reading_progress enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.entitlements enable row level security;
alter table public.staff_roles enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy specialties_read on public.specialties for select to authenticated
using (is_active or public.has_staff_role(null));
create policy topics_read on public.topics for select to authenticated
using (is_active or public.has_staff_role(null));
create policy articles_read on public.articles for select to authenticated using (true);
create policy article_sources_read on public.article_sources for select to authenticated using (true);
create policy article_topics_read on public.article_topics for select to authenticated using (true);
create policy plans_read on public.plans for select to authenticated using (is_active or public.has_staff_role(null));

create policy user_interests_select_own on public.user_interests for select to authenticated
using ((select auth.uid()) = user_id);
create policy user_interests_insert_own on public.user_interests for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy user_interests_delete_own on public.user_interests for delete to authenticated
using ((select auth.uid()) = user_id);

create policy saved_articles_select_own on public.saved_articles for select to authenticated
using ((select auth.uid()) = user_id);
create policy saved_articles_insert_own on public.saved_articles for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy saved_articles_delete_own on public.saved_articles for delete to authenticated
using ((select auth.uid()) = user_id);

create policy reading_progress_select_own on public.reading_progress for select to authenticated
using ((select auth.uid()) = user_id);
create policy reading_progress_insert_own on public.reading_progress for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy reading_progress_update_own on public.reading_progress for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy reading_progress_delete_own on public.reading_progress for delete to authenticated
using ((select auth.uid()) = user_id);

create policy notification_preferences_select_own on public.notification_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated
using ((select auth.uid()) = user_id);
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy push_subscriptions_update_own on public.push_subscriptions for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated
using ((select auth.uid()) = user_id);

-- Billing state is server-owned. Authenticated clients get read-only access to
-- their own projections; no INSERT/UPDATE/DELETE policy exists.
create policy subscriptions_select_own on public.subscriptions for select to authenticated
using ((select auth.uid()) = user_id);
create policy payments_select_own on public.payments for select to authenticated
using ((select auth.uid()) = user_id);
create policy entitlements_select_own on public.entitlements for select to authenticated
using ((select auth.uid()) = user_id);

-- Staff may inspect operational records. Writes remain server-only through the
-- service role and must also pass application-level staff authorization.
create policy subscriptions_staff_read on public.subscriptions for select to authenticated
using (public.has_staff_role(array['admin', 'support', 'billing']));
create policy payments_staff_read on public.payments for select to authenticated
using (public.has_staff_role(array['admin', 'support', 'billing']));
create policy payment_events_staff_read on public.payment_events for select to authenticated
using (public.has_staff_role(array['admin', 'billing']));
create policy entitlements_staff_read on public.entitlements for select to authenticated
using (public.has_staff_role(array['admin', 'support', 'billing']));
create policy staff_roles_staff_read on public.staff_roles for select to authenticated
using (public.has_staff_role(array['admin']));

-- Explicit grants complement RLS. There are deliberately no authenticated
-- mutation grants for server-owned billing, entitlement or staff data.
grant select, insert, update on public.profiles to authenticated;
grant select on public.specialties, public.topics, public.articles,
  public.article_sources, public.article_topics, public.plans to authenticated;
grant select, insert, delete on public.user_interests, public.saved_articles to authenticated;
grant select, insert, update, delete on public.reading_progress, public.push_subscriptions to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.subscriptions, public.payments, public.payment_events,
  public.entitlements, public.staff_roles to authenticated;

revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.subscriptions, public.payments,
  public.payment_events, public.entitlements, public.staff_roles from authenticated;
