-- Phase 3B.3B follow-up: harden the already-deployed atomic reconciliation function.
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
declare
  current_match jsonb;
  evidence_item jsonb;
  parsed_topic_id uuid;
  seen_topic_ids uuid[] := '{}'::uuid[];
begin
  if p_rule_version is null
     or btrim(p_rule_version) = ''
     or p_rule_version <> btrim(p_rule_version) then
    raise exception 'rule version is required';
  end if;
  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'matches must be a JSON array';
  end if;

  -- Validate in ordered steps. Boolean SQL predicates may be reordered, so do
  -- not call array functions or casts until their input type has been proven.
  for current_match in select value from jsonb_array_elements(p_matches) loop
    if jsonb_typeof(current_match) <> 'object'
       or not (current_match ?& array['topic_id','confidence','method','evidence','rule_version'])
       or not (current_match - array['topic_id','confidence','method','evidence','rule_version'] = '{}'::jsonb)
    then
      raise exception 'invalid automatic topic match';
    end if;
    if jsonb_typeof(current_match->'topic_id') <> 'string'
       or jsonb_typeof(current_match->'confidence') <> 'number'
       or jsonb_typeof(current_match->'method') <> 'string'
       or jsonb_typeof(current_match->'evidence') <> 'array'
       or jsonb_typeof(current_match->'rule_version') <> 'string'
    then
      raise exception 'invalid automatic topic match';
    end if;
    if jsonb_array_length(current_match->'evidence') = 0
       or current_match->>'method' <> 'deterministic_rules'
       or current_match->>'rule_version' <> p_rule_version
       or (current_match->>'confidence')::numeric < 0
       or (current_match->>'confidence')::numeric > 1
    then
      raise exception 'invalid automatic topic match';
    end if;

    begin
      parsed_topic_id := (current_match->>'topic_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid topic id';
    end;
    if parsed_topic_id = any(seen_topic_ids) then
      raise exception 'duplicate topic match';
    end if;
    seen_topic_ids := array_append(seen_topic_ids, parsed_topic_id);

    for evidence_item in select value from jsonb_array_elements(current_match->'evidence') loop
      if jsonb_typeof(evidence_item) <> 'object'
         or not (evidence_item ?& array['field','term'])
         or not (evidence_item - array['field','term'] = '{}'::jsonb)
      then
        raise exception 'invalid topic evidence';
      end if;
      if jsonb_typeof(evidence_item->'field') <> 'string'
         or jsonb_typeof(evidence_item->'term') <> 'string'
         or evidence_item->>'field' not in ('title','abstract','keyword','mesh','publication_type','journal')
         or btrim(evidence_item->>'term') = ''
      then
        raise exception 'invalid topic evidence';
      end if;
    end loop;
  end loop;

  -- Locks the parent so concurrent replacements for this article cannot interleave.
  perform 1 from public.articles where id = p_article_id for update;
  if not found then raise exception 'article not found'; end if;

  delete from public.article_topics existing
  where existing.article_id = p_article_id
    and existing.association_type = 'automatic'
    and not exists (
      select 1 from jsonb_array_elements(p_matches) item
      where (item->>'topic_id')::uuid = existing.topic_id
    );

  insert into public.article_topics (
    article_id, topic_id, association_type, confidence, method, evidence, rule_version
  )
  select
    p_article_id,
    (item->>'topic_id')::uuid,
    'automatic',
    (item->>'confidence')::numeric,
    item->>'method',
    item->'evidence',
    item->>'rule_version'
  from jsonb_array_elements(p_matches) item
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
