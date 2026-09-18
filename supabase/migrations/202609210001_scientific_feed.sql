-- Phase 3B: additive, unapplied migration. Null means not yet classified.
alter table public.articles
  add column study_type text check (study_type in ('systematic_review','meta_analysis','guideline','randomized_trial','cohort','case_control','cross_sectional','case_report','editorial','other')),
  add column evidence_level text check (evidence_level in ('high','moderate','low','very_low')),
  add column classification_version text;

alter table public.topics add column classification_rules jsonb
  check (classification_rules is null or jsonb_typeof(classification_rules) = 'object');

alter table public.article_topics
  add column association_type text not null default 'editorial' check (association_type in ('editorial','automatic')),
  add column method text,
  add column evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  add column rule_version text,
  add column updated_at timestamptz not null default now(),
  add constraint article_topics_automatic_metadata check (
    association_type = 'editorial' or (confidence is not null and method is not null and rule_version is not null)
  );

create trigger article_topics_set_updated_at before update on public.article_topics
for each row execute function public.set_updated_at();
create index articles_feed_candidates_idx on public.articles (published_at desc, id);
create index article_topics_feed_idx on public.article_topics (topic_id, confidence desc, article_id);
create index article_topics_automatic_idx on public.article_topics (article_id, rule_version) where association_type = 'automatic';

comment on column public.topics.classification_rules is 'Configurable deterministic topic rule; null disables automatic classification.';
comment on column public.article_topics.association_type is 'Editorial associations are never overwritten by automatic reconciliation.';
