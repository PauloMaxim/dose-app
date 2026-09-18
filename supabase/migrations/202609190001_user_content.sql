-- Persisted user library, notes and collections.
-- Additive migration: existing user data and foundation tables are preserved.

alter table public.saved_articles
  add column if not exists liked boolean not null default false;

alter table public.reading_progress
  add column if not exists minutes_read integer not null default 0
    check (minutes_read between 0 and 1440);

create policy saved_articles_update_own on public.saved_articles for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant update on public.saved_articles to authenticated;

create table public.user_collections (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  name_normalized text generated always as (lower(trim(name))) stored,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, name_normalized)
);
create unique index user_collections_one_default_uidx
  on public.user_collections (user_id) where is_default;

create table public.saved_article_collections (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  collection_id uuid not null references public.user_collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id, collection_id),
  foreign key (user_id, article_id)
    references public.saved_articles(user_id, article_id) on delete cascade,
  foreign key (user_id, collection_id)
    references public.user_collections(user_id, id) on delete cascade
);
create index saved_article_collections_collection_idx
  on public.saved_article_collections (user_id, collection_id, created_at desc);

create table public.article_notes (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index article_notes_user_updated_idx
  on public.article_notes (user_id, updated_at desc);
create index article_notes_user_article_idx
  on public.article_notes (user_id, article_id, updated_at desc);

create trigger user_collections_set_updated_at before update on public.user_collections
for each row execute function public.set_updated_at();
create trigger article_notes_set_updated_at before update on public.article_notes
for each row execute function public.set_updated_at();

alter table public.user_collections enable row level security;
alter table public.saved_article_collections enable row level security;
alter table public.article_notes enable row level security;

create policy user_collections_select_own on public.user_collections for select to authenticated
using ((select auth.uid()) = user_id);
create policy user_collections_insert_own on public.user_collections for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy user_collections_update_own on public.user_collections for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy user_collections_delete_own on public.user_collections for delete to authenticated
using ((select auth.uid()) = user_id and not is_default);

create policy saved_article_collections_select_own on public.saved_article_collections for select to authenticated
using ((select auth.uid()) = user_id);
create policy saved_article_collections_insert_own on public.saved_article_collections for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy saved_article_collections_delete_own on public.saved_article_collections for delete to authenticated
using ((select auth.uid()) = user_id);

create policy article_notes_select_own on public.article_notes for select to authenticated
using ((select auth.uid()) = user_id);
create policy article_notes_insert_own on public.article_notes for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy article_notes_update_own on public.article_notes for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy article_notes_delete_own on public.article_notes for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_collections,
  public.saved_article_collections, public.article_notes to authenticated;

-- The current editorial catalog is registered as a source mapping. This is
-- compatibility data only; it is not a scientific ingestion pipeline.
with catalog(id, slug, title, pmid, published_at) as (
  values
    ('d05e0000-0000-4000-8000-000000000001'::uuid, 'summit', 'A balança agora pesa no ventrículo', '39555826', '2024-11-16'::date),
    ('d05e0000-0000-4000-8000-000000000002'::uuid, 'surmount', 'Dois agonistas, um pódio', '40353578', '2025-05-11'::date),
    ('d05e0000-0000-4000-8000-000000000003'::uuid, 'select', 'O inimigo agora é a inércia', '37952131', '2023-11-11'::date),
    ('d05e0000-0000-4000-8000-000000000004'::uuid, 'flow', 'O rim que o comprimido salvou', null, '2024-05-24'::date),
    ('d05e0000-0000-4000-8000-000000000005'::uuid, 'empa-kidney', 'O SGLT2 que não pergunta o diabetes', '36331190', '2023-01-12'::date),
    ('d05e0000-0000-4000-8000-000000000006'::uuid, 'esc-af', 'Fibrilação: o protocolo que envelheceu o CHA₂DS₂ solitário', null, '2024-08-30'::date),
    ('d05e0000-0000-4000-8000-000000000007'::uuid, 'aspree', 'A aspirina da farmácia já não é o que era', '30221597', '2018-09-16'::date),
    ('d05e0000-0000-4000-8000-000000000008'::uuid, 'danger-shock', 'O motorzinho que disputa a UTI', '38587239', '2024-04-07'::date),
    ('d05e0000-0000-4000-8000-000000000009'::uuid, 'orbita2', 'A angina que o placebo não calou', '37984346', '2023-11-11'::date),
    ('d05e0000-0000-4000-8000-000000000010'::uuid, 'mash', 'O fígado que derreteu a gordura', '33185364', '2021-03-18'::date),
    ('d05e0000-0000-4000-8000-000000000011'::uuid, 'sprint', '120 não é o novo 140 — e nunca foi tão simples', '26551272', '2015-11-09'::date),
    ('d05e0000-0000-4000-8000-000000000012'::uuid, 'balance', 'O antibiótico que não deveria ter sido prescrito — os 7 dias que bastam', null, '2024-11-20'::date),
    ('d05e0000-0000-4000-8000-000000000013'::uuid, 'clear', 'Quando a estatina é o inimigo', '36876740', '2023-03-04'::date),
    ('d05e0000-0000-4000-8000-000000000014'::uuid, 'rsv', 'O vírus que o idoso para de ignorar', '37018468', '2023-02-16'::date)
)
insert into public.articles (id, title, pmid, published_at)
select id, title, pmid, published_at from catalog
on conflict do nothing;

with catalog(id, slug, pmid) as (
  values
    ('d05e0000-0000-4000-8000-000000000001'::uuid, 'summit', '39555826'),
    ('d05e0000-0000-4000-8000-000000000002'::uuid, 'surmount', '40353578'),
    ('d05e0000-0000-4000-8000-000000000003'::uuid, 'select', '37952131'),
    ('d05e0000-0000-4000-8000-000000000004'::uuid, 'flow', null),
    ('d05e0000-0000-4000-8000-000000000005'::uuid, 'empa-kidney', '36331190'),
    ('d05e0000-0000-4000-8000-000000000006'::uuid, 'esc-af', null),
    ('d05e0000-0000-4000-8000-000000000007'::uuid, 'aspree', '30221597'),
    ('d05e0000-0000-4000-8000-000000000008'::uuid, 'danger-shock', '38587239'),
    ('d05e0000-0000-4000-8000-000000000009'::uuid, 'orbita2', '37984346'),
    ('d05e0000-0000-4000-8000-000000000010'::uuid, 'mash', '33185364'),
    ('d05e0000-0000-4000-8000-000000000011'::uuid, 'sprint', '26551272'),
    ('d05e0000-0000-4000-8000-000000000012'::uuid, 'balance', null),
    ('d05e0000-0000-4000-8000-000000000013'::uuid, 'clear', '36876740'),
    ('d05e0000-0000-4000-8000-000000000014'::uuid, 'rsv', '37018468')
)
insert into public.article_sources (article_id, provider, external_id)
select coalesce(existing.id, catalog.id), 'dose_catalog', catalog.slug
from catalog
left join public.articles existing on catalog.pmid is not null and existing.pmid = catalog.pmid
on conflict (provider, external_id) do nothing;

insert into public.user_collections (user_id, name, is_default)
select id, 'Ler mais tarde', true from auth.users
on conflict (user_id, name_normalized) do nothing;

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
  insert into public.user_collections (user_id, name, is_default)
  values (new.id, 'Ler mais tarde', true)
  on conflict (user_id, name_normalized) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public;

create or replace function public.resolve_dose_article(article_key text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select article_id from public.article_sources
  where provider = 'dose_catalog' and external_id = article_key
$$;
revoke all on function public.resolve_dose_article(text) from public;
grant execute on function public.resolve_dose_article(text) to authenticated;

create or replace function public.set_my_library_entry(
  article_key text,
  is_liked boolean,
  collection_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_article uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  target_article := public.resolve_dose_article(article_key);
  if target_article is null then raise exception 'article not found'; end if;
  if exists (
    select 1 from unnest(collection_ids) requested(id)
    left join public.user_collections owned
      on owned.id = requested.id and owned.user_id = auth.uid()
    where owned.id is null
  ) then raise exception 'invalid collection'; end if;

  if is_liked or cardinality(collection_ids) > 0 then
    insert into public.saved_articles (user_id, article_id, liked)
    values (auth.uid(), target_article, is_liked)
    on conflict (user_id, article_id) do update set liked = excluded.liked;
    delete from public.saved_article_collections
      where user_id = auth.uid() and article_id = target_article;
    insert into public.saved_article_collections (user_id, article_id, collection_id)
    select auth.uid(), target_article, id from unnest(collection_ids) requested(id)
    on conflict do nothing;
  else
    delete from public.saved_articles
      where user_id = auth.uid() and article_id = target_article;
  end if;
end;
$$;
revoke all on function public.set_my_library_entry(text, boolean, uuid[]) from public;
grant execute on function public.set_my_library_entry(text, boolean, uuid[]) to authenticated;

create or replace function public.upsert_my_reading_progress(
  article_key text,
  new_progress numeric,
  new_minutes integer default 0,
  mark_completed boolean default false
)
returns public.reading_progress
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_article uuid;
  result public.reading_progress;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  target_article := public.resolve_dose_article(article_key);
  if target_article is null then raise exception 'article not found'; end if;
  insert into public.reading_progress (
    user_id, article_id, progress_percent, minutes_read, started_at, completed_at
  ) values (
    auth.uid(), target_article,
    case when mark_completed then 100 else greatest(0, least(new_progress, 99)) end,
    greatest(0, new_minutes), now(), case when mark_completed then now() end
  )
  on conflict (user_id, article_id) do update set
    progress_percent = greatest(public.reading_progress.progress_percent, excluded.progress_percent),
    minutes_read = greatest(public.reading_progress.minutes_read, excluded.minutes_read),
    started_at = coalesce(public.reading_progress.started_at, excluded.started_at),
    completed_at = coalesce(public.reading_progress.completed_at, excluded.completed_at)
  returning * into result;
  return result;
end;
$$;
revoke all on function public.upsert_my_reading_progress(text, numeric, integer, boolean) from public;
grant execute on function public.upsert_my_reading_progress(text, numeric, integer, boolean) to authenticated;
