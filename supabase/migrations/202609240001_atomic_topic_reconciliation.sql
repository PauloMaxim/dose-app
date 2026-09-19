-- Phase 3B.3B: privileged, atomic replacement of one article's automatic topic set.
create or replace function public.reconcile_automatic_article_topics(
  p_article_id uuid,
  p_rule_version text,
  p_matches jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_rule_version is null or btrim(p_rule_version) = '' then
    raise exception 'rule version is required';
  end if;
  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'matches must be a JSON array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_matches) match
    where jsonb_typeof(match) <> 'object'
      or not (match ?& array['topic_id','confidence','method','evidence','rule_version'])
      or not (match - array['topic_id','confidence','method','evidence','rule_version'] = '{}'::jsonb)
      or jsonb_typeof(match->'topic_id') <> 'string'
      or jsonb_typeof(match->'confidence') <> 'number'
      or jsonb_typeof(match->'method') <> 'string'
      or jsonb_typeof(match->'evidence') <> 'array'
      or jsonb_array_length(match->'evidence') = 0
      or jsonb_typeof(match->'rule_version') <> 'string'
      or match->>'method' <> 'deterministic_rules'
      or match->>'rule_version' <> p_rule_version
      or (match->>'confidence')::numeric < 0
      or (match->>'confidence')::numeric > 1
  ) then
    raise exception 'invalid automatic topic match';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_matches) match,
         jsonb_array_elements(match->'evidence') evidence
    where jsonb_typeof(evidence) <> 'object'
      or not (evidence ?& array['field','term'])
      or not (evidence - array['field','term'] = '{}'::jsonb)
      or jsonb_typeof(evidence->'field') <> 'string'
      or jsonb_typeof(evidence->'term') <> 'string'
      or evidence->>'field' not in ('title','abstract','keyword','mesh','publication_type','journal')
      or btrim(evidence->>'term') = ''
  ) then
    raise exception 'invalid topic evidence';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_matches) match
    group by match->>'topic_id' having count(*) > 1
  ) then
    raise exception 'duplicate topic match';
  end if;

  -- Locks the parent so concurrent replacements for this article cannot interleave.
  perform 1 from public.articles where id = p_article_id for update;
  if not found then raise exception 'article not found'; end if;

  delete from public.article_topics existing
  where existing.article_id = p_article_id
    and existing.association_type = 'automatic'
    and not exists (
      select 1 from jsonb_array_elements(p_matches) match
      where (match->>'topic_id')::uuid = existing.topic_id
    );

  insert into public.article_topics (
    article_id, topic_id, association_type, confidence, method, evidence, rule_version
  )
  select
    p_article_id,
    (match->>'topic_id')::uuid,
    'automatic',
    (match->>'confidence')::numeric,
    match->>'method',
    match->'evidence',
    match->>'rule_version'
  from jsonb_array_elements(p_matches) match
  on conflict (article_id, topic_id) do update set
    confidence = excluded.confidence,
    method = excluded.method,
    evidence = excluded.evidence,
    rule_version = excluded.rule_version
  where article_topics.association_type = 'automatic';
end;
$$;

revoke all on function public.reconcile_automatic_article_topics(uuid, text, jsonb) from public;
revoke execute on function public.reconcile_automatic_article_topics(uuid, text, jsonb) from anon, authenticated;
grant execute on function public.reconcile_automatic_article_topics(uuid, text, jsonb) to service_role;
