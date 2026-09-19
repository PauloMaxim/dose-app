-- Phase 3B.3G: narrowly scoped, read-only data access for scientific dry-runs.
create or replace function public.read_scientific_topic_rule_snapshot()
returns table (
  topic_id uuid,
  topic_slug text,
  topic_name text,
  topic_is_active boolean,
  specialty_id uuid,
  specialty_slug text,
  specialty_name text,
  specialty_is_active boolean,
  classification_rules jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    topic.id,
    topic.slug,
    topic.name,
    topic.is_active,
    specialty.id,
    specialty.slug,
    specialty.name,
    specialty.is_active,
    topic.classification_rules
  from public.topics as topic
  left join public.specialties as specialty on specialty.id = topic.specialty_id
  where topic.classification_rules is not null
  order by topic.id;
$$;

create or replace function public.read_scientific_reclassification_batch(
  p_after_article_id uuid default null,
  p_limit integer default 50
)
returns table (
  article_id uuid,
  title text,
  abstract text,
  keywords text[],
  mesh_terms text[],
  publication_types text[],
  journal text,
  associations jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'limit must be between 1 and 100';
  end if;

  return query
  select
    article.id,
    article.title,
    article.abstract,
    article.keywords,
    article.mesh_terms,
    article.publication_types,
    article.journal,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'topic_id', association.topic_id,
            'association_type', association.association_type,
            'method', association.method,
            'confidence', association.confidence,
            'evidence', association.evidence,
            'rule_version', association.rule_version
          ) order by association.topic_id
        )
        from public.article_topics as association
        where association.article_id = article.id
      ),
      '[]'::jsonb
    )
  from public.articles as article
  where p_after_article_id is null or article.id > p_after_article_id
  order by article.id
  limit p_limit;
end;
$$;

revoke all on function public.read_scientific_topic_rule_snapshot() from public;
revoke execute on function public.read_scientific_topic_rule_snapshot() from anon, authenticated;
grant execute on function public.read_scientific_topic_rule_snapshot() to service_role;

revoke all on function public.read_scientific_reclassification_batch(uuid, integer) from public;
revoke execute on function public.read_scientific_reclassification_batch(uuid, integer) from anon, authenticated;
grant execute on function public.read_scientific_reclassification_batch(uuid, integer) to service_role;
