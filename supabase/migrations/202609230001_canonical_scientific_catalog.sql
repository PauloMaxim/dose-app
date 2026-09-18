-- Phase 3B.2 canonical catalog. Additive seed only; intentionally not applied by this repository.
do $$
declare
  conflict_count integer;
begin
  select count(*) into conflict_count from public.specialties s
  join (values
    ('31000000-0000-4000-8000-000000000001'::uuid,'cardiologia','Cardiologia'),
    ('31000000-0000-4000-8000-000000000002','endocrinologia','Endocrinologia'),
    ('31000000-0000-4000-8000-000000000003','nefrologia','Nefrologia'),
    ('31000000-0000-4000-8000-000000000004','infectologia','Infectologia'),
    ('31000000-0000-4000-8000-000000000005','pneumologia','Pneumologia'),
    ('31000000-0000-4000-8000-000000000006','hepatologia','Hepatologia'),
    ('31000000-0000-4000-8000-000000000007','medicina-interna','Medicina Interna'),
    ('31000000-0000-4000-8000-000000000008','medicina-intensiva','Medicina Intensiva'),
    ('31000000-0000-4000-8000-000000000009','geriatria','Geriatria'),
    ('31000000-0000-4000-8000-000000000010','neurologia','Neurologia')
  ) v(id,slug,name) on s.slug=v.slug
  where s.id<>v.id or s.name<>v.name;
  if conflict_count > 0 then raise exception 'canonical specialty slug conflicts with another entity'; end if;
end $$;

insert into public.specialties (id,slug,name,is_active) values
('31000000-0000-4000-8000-000000000001','cardiologia','Cardiologia',true),
('31000000-0000-4000-8000-000000000002','endocrinologia','Endocrinologia',true),
('31000000-0000-4000-8000-000000000003','nefrologia','Nefrologia',true),
('31000000-0000-4000-8000-000000000004','infectologia','Infectologia',true),
('31000000-0000-4000-8000-000000000005','pneumologia','Pneumologia',true),
('31000000-0000-4000-8000-000000000006','hepatologia','Hepatologia',true),
('31000000-0000-4000-8000-000000000007','medicina-interna','Medicina Interna',true),
('31000000-0000-4000-8000-000000000008','medicina-intensiva','Medicina Intensiva',true),
('31000000-0000-4000-8000-000000000009','geriatria','Geriatria',true),
('31000000-0000-4000-8000-000000000010','neurologia','Neurologia',true)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from public.topics t join (values
    ('32000000-0000-4000-8000-000000000001'::uuid,'insuficiencia-cardiaca','Insuficiência cardíaca'),
    ('32000000-0000-4000-8000-000000000002','obesidade-e-incretinas','Obesidade e incretinas'),
    ('32000000-0000-4000-8000-000000000003','fibrilacao-atrial','Fibrilação atrial'),
    ('32000000-0000-4000-8000-000000000004','doenca-renal-cronica','Doença renal crônica'),
    ('32000000-0000-4000-8000-000000000005','prevencao-cardiovascular','Prevenção cardiovascular'),
    ('32000000-0000-4000-8000-000000000006','diabetes','Diabetes'),
    ('32000000-0000-4000-8000-000000000007','sepse-e-antibioticos','Sepse e antibióticos'),
    ('32000000-0000-4000-8000-000000000008','lipidios','Lipídios'),
    ('32000000-0000-4000-8000-000000000009','hipertensao','Hipertensão'),
    ('32000000-0000-4000-8000-000000000010','doenca-coronariana','Doença coronariana'),
    ('32000000-0000-4000-8000-000000000011','vacinas-no-adulto','Vacinas no adulto'),
    ('32000000-0000-4000-8000-000000000012','hepatologia','Hepatologia')
  ) v(id,slug,name) on t.slug=v.slug where t.id<>v.id or t.name<>v.name) then
    raise exception 'canonical topic slug conflicts with another entity';
  end if;
end $$;

insert into public.topics (id,slug,name,specialty_id,is_active,classification_rules) values
('32000000-0000-4000-8000-000000000001','insuficiencia-cardiaca','Insuficiência cardíaca','31000000-0000-4000-8000-000000000001',true,null),
('32000000-0000-4000-8000-000000000002','obesidade-e-incretinas','Obesidade e incretinas','31000000-0000-4000-8000-000000000002',true,null),
('32000000-0000-4000-8000-000000000003','fibrilacao-atrial','Fibrilação atrial','31000000-0000-4000-8000-000000000001',true,null),
('32000000-0000-4000-8000-000000000004','doenca-renal-cronica','Doença renal crônica','31000000-0000-4000-8000-000000000003',true,null),
('32000000-0000-4000-8000-000000000005','prevencao-cardiovascular','Prevenção cardiovascular',null,true,null),
('32000000-0000-4000-8000-000000000006','diabetes','Diabetes','31000000-0000-4000-8000-000000000002',true,null),
('32000000-0000-4000-8000-000000000007','sepse-e-antibioticos','Sepse e antibióticos',null,true,null),
('32000000-0000-4000-8000-000000000008','lipidios','Lipídios',null,true,null),
('32000000-0000-4000-8000-000000000009','hipertensao','Hipertensão',null,true,null),
('32000000-0000-4000-8000-000000000010','doenca-coronariana','Doença coronariana','31000000-0000-4000-8000-000000000001',true,null),
('32000000-0000-4000-8000-000000000011','vacinas-no-adulto','Vacinas no adulto',null,true,null),
('32000000-0000-4000-8000-000000000012','hepatologia','Hepatologia','31000000-0000-4000-8000-000000000006',true,null)
on conflict (id) do nothing;

-- Validates every client-provided UUID before replacing anything, then completes profile atomically.
create or replace function public.complete_my_onboarding(display_name_input text, locale_input text, specialty_id_input uuid, topic_ids_input uuid[] default '{}')
returns void language plpgsql security invoker set search_path = '' as $$
declare caller_id uuid := auth.uid(); distinct_topic_count integer;
begin
  if caller_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists (select 1 from public.specialties where id=specialty_id_input and is_active) then raise exception 'invalid or inactive specialty'; end if;
  select count(distinct x) into distinct_topic_count from unnest(coalesce(topic_ids_input,'{}'::uuid[])) x;
  if distinct_topic_count <> coalesce(array_length(topic_ids_input,1),0)
     or distinct_topic_count <> (select count(*) from public.topics where id=any(coalesce(topic_ids_input,'{}'::uuid[])) and is_active)
  then raise exception 'invalid, inactive, or duplicate topic'; end if;
  delete from public.user_interests where user_id=caller_id;
  insert into public.user_interests(user_id,specialty_id) values(caller_id,specialty_id_input);
  insert into public.user_interests(user_id,topic_id) select caller_id,x from unnest(coalesce(topic_ids_input,'{}'::uuid[])) x;
  update public.profiles set display_name=display_name_input,locale=locale_input,onboarding_completed_at=now() where id=caller_id;
end $$;
revoke all on function public.complete_my_onboarding(text,text,uuid,uuid[]) from public;
revoke execute on function public.complete_my_onboarding(text,text,uuid,uuid[]) from anon;
grant execute on function public.complete_my_onboarding(text,text,uuid,uuid[]) to authenticated;
