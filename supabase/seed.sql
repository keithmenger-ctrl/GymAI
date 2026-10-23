-- Optional demo data: "Sample Facility" (not run by migrations; load only into dev/demo databases). Deterministic (fixed random seed), relative to today's date.
-- Logins (password for all: academyos-demo):
--   owner@demo-academy.test  alex@demo-academy.test  mike@demo-academy.test  sarah@demo-academy.test
--   parent1@demo-academy.test .. parent6@demo-academy.test

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
  v_owner := pg_temp.seed_user('owner@demo-academy.test', 'Demo Owner');
  insert into organizations (name, is_demo) values ('Sample Facility', true) returning id into v_org;
  insert into user_roles (user_id, organization_id, role, can_view_finance) values (v_owner, v_org, 'owner', true);
  perform seed_demo_org(
    v_org,
    array[pg_temp.seed_user('alex@demo-academy.test', 'Coach Alex'),
          pg_temp.seed_user('mike@demo-academy.test', 'Coach Mike'),
          pg_temp.seed_user('sarah@demo-academy.test', 'Coach Sarah')],
    array(select pg_temp.seed_user('parent' || i || '@demo-academy.test', 'Parent ' || i) from generate_series(1, 6) i order by i));
end $$;
