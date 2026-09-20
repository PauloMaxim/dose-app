-- Auth V1: immutable, server-recorded versions of legal documents acknowledged at signup.
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version)
);

alter table public.legal_acceptances enable row level security;
revoke all on table public.legal_acceptances from public, anon;
revoke insert, update, delete on table public.legal_acceptances from authenticated;
create policy legal_acceptances_select_own on public.legal_acceptances for select to authenticated
using ((select auth.uid()) = user_id);
grant select on public.legal_acceptances to authenticated;

-- Kept in public because PostgREST RPC exposes only configured API schemas.
-- SECURITY DEFINER is required so callers need EXECUTE, never direct INSERT.
create or replace function public.accept_current_legal_documents()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.legal_acceptances (user_id, terms_version, privacy_version)
  values (auth.uid(), '2026-09-20', '2026-09-20')
  on conflict (user_id, terms_version, privacy_version) do nothing;
end;
$$;
revoke all on function public.accept_current_legal_documents() from public, anon;
grant execute on function public.accept_current_legal_documents() to authenticated;
