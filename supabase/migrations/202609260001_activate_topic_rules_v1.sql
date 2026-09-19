-- Phase 3B.3E: install the clinically reviewed V1 topic rules only; no classification or backfill.
do $$
declare
  expected constant jsonb := $topic_rules$
[
  {"id":"32000000-0000-4000-8000-000000000001","slug":"insuficiencia-cardiaca","specialty_id":"31000000-0000-4000-8000-000000000001","rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["heart failure","insuficiência cardíaca"],"synonyms":["cardiac failure"],"meshTerms":["Heart Failure"]}},
  {"id":"32000000-0000-4000-8000-000000000002","slug":"obesidade-e-incretinas","specialty_id":"31000000-0000-4000-8000-000000000002","rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["obesity","obesidade"],"meshTerms":["Obesity","Obesity, Morbid"]}},
  {"id":"32000000-0000-4000-8000-000000000003","slug":"fibrilacao-atrial","specialty_id":"31000000-0000-4000-8000-000000000001","rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["atrial fibrillation","fibrilação atrial"],"meshTerms":["Atrial Fibrillation"]}},
  {"id":"32000000-0000-4000-8000-000000000004","slug":"doenca-renal-cronica","specialty_id":"31000000-0000-4000-8000-000000000003","rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["chronic kidney disease","chronic renal disease","doença renal crônica"],"synonyms":["chronic renal insufficiency"],"meshTerms":["Renal Insufficiency, Chronic"]}},
  {"id":"32000000-0000-4000-8000-000000000005","slug":"prevencao-cardiovascular","specialty_id":null,"rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["cardiovascular prevention","cardiovascular disease prevention","cardiovascular risk reduction","primary prevention of cardiovascular disease","secondary prevention of cardiovascular disease","prevenção cardiovascular"],"meshTerms":["Primary Prevention","Secondary Prevention"],"requiredTerms":["cardiovascular"]}},
  {"id":"32000000-0000-4000-8000-000000000006","slug":"diabetes","specialty_id":"31000000-0000-4000-8000-000000000002","rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["diabetes mellitus","type 1 diabetes","type 2 diabetes","gestational diabetes"],"meshTerms":["Diabetes Mellitus","Diabetes Mellitus, Type 1","Diabetes Mellitus, Type 2","Diabetes, Gestational"]}},
  {"id":"32000000-0000-4000-8000-000000000007","slug":"sepse-e-antibioticos","specialty_id":null,"rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["sepsis","septic shock","sepse","choque séptico"],"meshTerms":["Sepsis","Shock, Septic"]}},
  {"id":"32000000-0000-4000-8000-000000000008","slug":"lipidios","specialty_id":null,"rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["dyslipidemia","dyslipidaemia","dislipidemia","hypercholesterolemia","hypertriglyceridemia","LDL cholesterol","non-HDL cholesterol","lipid-lowering therapy"],"meshTerms":["Dyslipidemias","Hypercholesterolemia","Hypertriglyceridemia"]}},
  {"id":"32000000-0000-4000-8000-000000000009","slug":"hipertensao","specialty_id":null,"rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["arterial hypertension","essential hypertension","systemic hypertension","hipertensão arterial"],"meshTerms":["Hypertension","Hypertension, Essential"],"exclusionTerms":["pulmonary hypertension","portal hypertension","intracranial hypertension","ocular hypertension"]}},
  {"id":"32000000-0000-4000-8000-000000000010","slug":"doenca-coronariana","specialty_id":"31000000-0000-4000-8000-000000000001","rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["coronary artery disease","coronary heart disease","acute coronary syndrome","myocardial infarction","ischemic heart disease","ischaemic heart disease","doença arterial coronariana"],"meshTerms":["Coronary Artery Disease","Acute Coronary Syndrome","Myocardial Infarction","Myocardial Ischemia"]}},
  {"id":"32000000-0000-4000-8000-000000000011","slug":"vacinas-no-adulto","specialty_id":null,"rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["adult vaccination","adult immunization","vaccination in adult","immunization in adult","vacinação no adulto"]}},
  {"id":"32000000-0000-4000-8000-000000000012","slug":"hepatologia","specialty_id":"31000000-0000-4000-8000-000000000006","rules":{"version":"catalog-v1-topic-rules-v1","preferredTerms":["liver cirrhosis","hepatic cirrhosis","portal hypertension","viral hepatitis","hepatocellular carcinoma","metabolic dysfunction-associated steatotic liver disease","alcohol-associated liver disease","chronic liver disease","hepatic fibrosis","cirrose hepática","hepatite viral"],"meshTerms":["Liver Cirrhosis","Portal Hypertension","Hepatitis, Viral, Human","Carcinoma, Hepatocellular","Fatty Liver"]}}
]
$topic_rules$::jsonb;
  matched_count integer;
  updated_count integer;
begin
  if jsonb_typeof(expected) <> 'array' or jsonb_array_length(expected) <> 12 then
    raise exception 'topic rules V1 must contain exactly 12 targets';
  end if;
  if (select count(distinct item->>'id') from jsonb_array_elements(expected) item) <> 12
     or (select count(distinct item->>'slug') from jsonb_array_elements(expected) item) <> 12 then
    raise exception 'topic rules V1 targets must have unique IDs and slugs';
  end if;

  select count(*) into matched_count
  from jsonb_to_recordset(expected) target(id uuid, slug text, specialty_id uuid, rules jsonb)
  join public.topics topic on topic.id = target.id
  where topic.is_active
    and topic.slug = target.slug
    and topic.specialty_id is not distinct from target.specialty_id;
  if matched_count <> 12 then
    raise exception 'canonical topic catalog does not match topic rules V1';
  end if;

  update public.topics topic
  set classification_rules = target.rules
  from jsonb_to_recordset(expected) target(id uuid, slug text, specialty_id uuid, rules jsonb)
  where topic.id = target.id
    and topic.is_active
    and topic.slug = target.slug
    and topic.specialty_id is not distinct from target.specialty_id;
  get diagnostics updated_count = row_count;
  if updated_count <> 12 then
    raise exception 'topic rules V1 activation did not update exactly 12 targets';
  end if;
end;
$$;
