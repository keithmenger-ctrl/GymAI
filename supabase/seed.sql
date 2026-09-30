-- Demo data: "Vegas Elite Performance". Deterministic (fixed random seed), relative to today's date.
-- Logins (password for all: academyos-demo):
--   owner@vegaselite.test  keith@vegaselite.test  mike@vegaselite.test  sarah@vegaselite.test
--   parent1@vegaselite.test .. parent6@vegaselite.test

create or replace function pg_temp.seed_user(p_email text, p_name text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    crypt('academyos-demo', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name, 'demo', true),
    now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now());
  insert into profiles (id, full_name, email) values (v_id, p_name, p_email);
  return v_id;
end $$;

do $$
declare v_org uuid; v_owner uuid;
begin
  v_owner := pg_temp.seed_user('owner@vegaselite.test', 'Keith Owner');
  insert into organizations (name, is_demo) values ('Vegas Elite Performance', true) returning id into v_org;
  insert into user_roles (user_id, organization_id, role, can_view_finance) values (v_owner, v_org, 'owner', true);
  perform seed_demo_org(
    v_org,
    array[pg_temp.seed_user('keith@vegaselite.test', 'Coach Keith'),
          pg_temp.seed_user('mike@vegaselite.test', 'Coach Mike'),
          pg_temp.seed_user('sarah@vegaselite.test', 'Coach Sarah')],
    array(select pg_temp.seed_user('parent' || i || '@vegaselite.test', 'Parent ' || i) from generate_series(1, 6) i order by i));
end $$;
