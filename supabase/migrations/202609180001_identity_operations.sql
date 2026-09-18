-- Atomic, identity-bound operations for Phase 2.

create or replace function public.replace_my_interests(
  specialty_ids uuid[] default '{}'::uuid[],
  topic_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from public.user_interests where user_id = caller_id;

  insert into public.user_interests (user_id, specialty_id)
  select caller_id, id from public.specialties
  where id = any(coalesce(specialty_ids, '{}'::uuid[])) and is_active;

  insert into public.user_interests (user_id, topic_id)
  select caller_id, id from public.topics
  where id = any(coalesce(topic_ids, '{}'::uuid[])) and is_active;
end;
$$;

revoke all on function public.replace_my_interests(uuid[], uuid[]) from public;
grant execute on function public.replace_my_interests(uuid[], uuid[]) to authenticated;
