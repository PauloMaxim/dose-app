begin;
select plan(14);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'a@example.test', '', now(), '{}', '{"name":"A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'b@example.test', '', now(), '{}', '{"name":"B"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'staff@example.test', '', now(), '{}', '{"name":"Staff"}', now(), now());

insert into public.staff_roles (user_id, role)
values ('30000000-0000-0000-0000-000000000003', 'admin');
insert into public.plans (id, code, name)
values ('40000000-0000-0000-0000-000000000004', 'free', 'Free');
insert into public.articles (id, title, doi, pmid)
values ('50000000-0000-0000-0000-000000000005', 'Foundation test', 'https://doi.org/10.1000/TEST', '12345');
insert into public.saved_articles (user_id, article_id)
values ('20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005');
insert into public.subscriptions (id, user_id, plan_id, provider, external_id, status)
values ('60000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', 'test', 'sub_b', 'active');
insert into public.payments (id, user_id, subscription_id, provider, external_id, status, amount_minor, currency)
values ('70000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000006', 'test', 'pay_b', 'succeeded', 1000, 'BRL');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is((select count(*) from public.profiles), 1::bigint, 'A sees only own profile');
select is((select count(*) from public.saved_articles), 0::bigint, 'A cannot read B library');
select is((select count(*) from public.subscriptions), 0::bigint, 'A cannot read B subscription');
select is((select count(*) from public.payments), 0::bigint, 'A cannot read B payment');
select is((select count(*) from public.entitlements), 0::bigint, 'A sees no foreign entitlements');
select lives_ok(
  $$update public.profiles set display_name = 'blocked' where id = '20000000-0000-0000-0000-000000000002'$$,
  'A update against B is safely filtered'
);
select is((select display_name from public.profiles where id = '20000000-0000-0000-0000-000000000002'), null, 'B remains unreadable to A');
select throws_ok(
  $$insert into public.entitlements (user_id, plan_id, key) values ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'dose.plus')$$,
  '42501', null, 'authenticated user cannot create entitlement'
);
select throws_ok(
  $$update public.subscriptions set status = 'canceled' where id = '60000000-0000-0000-0000-000000000006'$$,
  '42501', null, 'authenticated user cannot alter subscription'
);
select throws_ok(
  $$update public.payments set status = 'refunded' where id = '70000000-0000-0000-0000-000000000007'$$,
  '42501', null, 'authenticated user cannot alter payment'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot access profiles');
select throws_ok($$select * from public.saved_articles$$, '42501', null, 'anon cannot access library');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.subscriptions), 1::bigint, 'authorized staff can inspect subscriptions');
select throws_ok(
  $$insert into public.staff_roles (user_id, role) values ('10000000-0000-0000-0000-000000000001', 'admin')$$,
  '42501', null, 'staff cannot grant roles through the client connection'
);

select * from finish();
rollback;
