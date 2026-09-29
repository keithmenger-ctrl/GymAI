-- RLS / tenant isolation tests. Run after reset.sh (plain Postgres + auth stub). Any failed check raises.
create schema if not exists t;
grant usage on schema t to authenticated, anon;

create or replace function t.act_as(p_email text) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), true);
  set local role authenticated;
end $$;

create or replace function t.check(p_name text, p_ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAIL: %', p_name; end if;
  raise notice 'ok   - %', p_name;
end $$;
grant execute on function t.check(text, boolean) to authenticated, anon;

-- second tenant
insert into auth.users (id, email) values (gen_random_uuid(), 'owner@abcbaseball.test');

do $$
declare
  a_org uuid; b_org uuid; a_prog uuid; n bigint;
  s_id uuid; ath_id uuid; parent_ath uuid; other_ath uuid; b_prog uuid; a_level uuid;
begin
  select id into a_org from organizations where name = 'Vegas Elite Performance';
  select id into a_prog from programs where organization_id = a_org order by name limit 1;
  select id into a_level from program_levels where program_id = a_prog limit 1;

  -- ================= org B signs up through the real signup function
  perform t.act_as('owner@abcbaseball.test');
  b_org := create_organization('ABC Baseball Academy', 'ABC Owner');
  perform t.check('signup creates org for caller', b_org is not null);
  begin
    perform create_organization('Second Org', 'Dup');
    perform t.check('user cannot create a second org', false);
  exception when raise_exception then
    perform t.check('user cannot create a second org', true);
  end;
  insert into programs (organization_id, name) values (b_org, 'ABC Hitting') returning id into b_prog;
  insert into athletes (organization_id, first_name, last_name) values (b_org, 'Bee', 'Player');

  -- ================= cross-org isolation (owner of B looking at A)
  perform t.check('B sees only its own athlete', (select count(*) from athletes) = 1);
  perform t.check('B sees 0 org A athletes', (select count(*) from athletes where organization_id = a_org) = 0);
  perform t.check('B cannot read org A org row', (select count(*) from organizations where id = a_org) = 0);
  perform t.check('B sees 0 org A sessions', (select count(*) from sessions) = 0);
  perform t.check('B sees 0 org A payments', (select count(*) from payments) = 0);
  begin
    insert into athletes (organization_id, first_name, last_name) values (a_org, 'Evil', 'Insert');
    perform t.check('B cannot insert into org A', false);
  exception when insufficient_privilege then
    perform t.check('B cannot insert into org A', true);
  end;
  update athletes set first_name = 'Hacked' where organization_id = a_org;
  get diagnostics n = row_count;
  perform t.check('B cannot update org A rows', n = 0);
  delete from programs where id = a_prog;
  get diagnostics n = row_count;
  perform t.check('B cannot delete org A rows', n = 0);
  -- cross-tenant reference: B athlete pointing at A's program must be rejected by composite FK
  begin
    update athletes set current_program_id = a_prog where organization_id = b_org;
    perform t.check('composite FK blocks cross-org reference', false);
  exception when foreign_key_violation then
    perform t.check('composite FK blocks cross-org reference', true);
  end;

  -- ================= owner A
  perform t.act_as('owner@vegaselite.test');
  perform t.check('owner A sees 30 athletes', (select count(*) from athletes) = 30);
  perform t.check('owner A sees none of B''s data', (select count(*) from athletes where first_name = 'Bee') = 0);
  perform t.check('owner A sees 30 memberships', (select count(*) from memberships) = 30);
  perform t.check('owner A sees payments', (select count(*) from payments) > 0);
  perform t.check('owner A sees org A only', (select count(*) from organizations) = 1);

  -- ================= coach
  perform t.act_as('keith@vegaselite.test');
  perform t.check('coach sees athletes', (select count(*) from athletes) = 30);
  perform t.check('coach sees sessions', (select count(*) from sessions) > 0);
  perform t.check('coach cannot see memberships', (select count(*) from memberships) = 0);
  perform t.check('coach cannot see payments', (select count(*) from payments) = 0);
  begin
    insert into athletes (organization_id, first_name, last_name) values (a_org, 'Nope', 'Coach');
    perform t.check('coach cannot create athletes', false);
  exception when insufficient_privilege then
    perform t.check('coach cannot create athletes', true);
  end;
  begin
    insert into programs (organization_id, name) values (a_org, 'Nope');
    perform t.check('coach cannot create programs', false);
  exception when insufficient_privilege then
    perform t.check('coach cannot create programs', true);
  end;
  begin
    insert into membership_plans (organization_id, name, price_cents) values (a_org, 'Free', 0);
    perform t.check('coach cannot create plans', false);
  exception when insufficient_privilege then
    perform t.check('coach cannot create plans', true);
  end;
  select sa.session_id, sa.athlete_id into s_id, ath_id
    from session_athletes sa join sessions s on s.id = sa.session_id
    where s.starts_at::date >= current_date and s.coach_id in (select id from coaches where profile_id = auth.uid()) limit 1;
  if s_id is null then
    select sa.session_id, sa.athlete_id into s_id, ath_id from session_athletes sa limit 1;
  end if;
  insert into attendance (organization_id, session_id, athlete_id, status, marked_by)
    values (a_org, s_id, ath_id, 'present', auth.uid())
    on conflict (session_id, athlete_id) do update set status = 'present';
  perform t.check('coach can mark attendance', true);
  insert into coach_notes (organization_id, athlete_id, session_id, author_id, body, shareable)
    values (a_org, ath_id, s_id, auth.uid(), 'test note', true);
  perform t.check('coach can add notes', true);
  begin
    insert into coach_notes (organization_id, athlete_id, author_id, body) values (a_org, ath_id, gen_random_uuid(), 'spoofed');
    perform t.check('coach cannot spoof note author', false);
  exception when insufficient_privilege or foreign_key_violation then
    perform t.check('coach cannot spoof note author', true);
  end;
  insert into assessment_results (organization_id, athlete_id, type_id, value)
    select a_org, ath_id, id, 1.5 from assessment_types limit 1;
  perform t.check('coach can record assessments', true);
  perform t.check('assessment trigger wrote timeline event',
    (select count(*) from athlete_progress_events where athlete_id = ath_id and kind = 'assessment' and occurred_at::date = current_date) >= 1);
  -- coach can only edit sessions assigned to them
  update sessions set notes = 'not mine' where coach_id not in (select id from coaches where profile_id = auth.uid());
  get diagnostics n = row_count;
  perform t.check('coach cannot edit other coaches'' sessions', n = 0);
  update sessions set notes = 'mine' where coach_id in (select id from coaches where profile_id = auth.uid());
  get diagnostics n = row_count;
  perform t.check('coach can edit own sessions', n > 0);

  -- ================= parent 1 (guardian of Alvarez athlete only)
  perform t.act_as('parent1@vegaselite.test');
  select a.id into parent_ath from athletes a;
  perform t.check('parent sees exactly their own athlete', (select count(*) from athletes) = 1);
  perform t.check('parent sees only own athlete sessions',
    (select count(*) from sessions) > 0 and (select count(*) from sessions) < 110);
  perform t.check('parent sees own athlete attendance',
    (select count(*) from attendance where athlete_id <> parent_ath) = 0);
  perform t.check('parent sees no unshareable notes', (select count(*) from coach_notes where not shareable) = 0);
  perform t.check('parent sees no session-general notes', (select count(*) from coach_notes where athlete_id is null) = 0);
  perform t.check('parent timeline hides private note bodies',
    (select count(*) from athlete_progress_events where kind = 'note' and payload ->> 'shareable' <> 'true') = 0);
  perform t.check('parent sees own membership only',
    (select count(*) from memberships) = 1 and (select count(*) from payments) > 0);
  perform t.check('parent cannot see other guardians', (select count(*) from guardians) = 1);
  perform t.check('parent cannot list roles of others', (select count(*) from user_roles) = 1);
  perform t.check('parent cannot see coaches table', (select count(*) from coaches) = 0);
  begin
    insert into attendance (organization_id, session_id, athlete_id, status) values (a_org, s_id, ath_id, 'absent')
      on conflict (session_id, athlete_id) do update set status = 'absent';
    perform t.check('parent cannot write attendance', false);
  exception when insufficient_privilege then
    perform t.check('parent cannot write attendance', true);
  end;
  update athletes set notes = 'hacked';
  get diagnostics n = row_count;
  perform t.check('parent cannot update athletes', n = 0);
  begin
    update user_roles set role = 'owner';
    get diagnostics n = row_count;
    perform t.check('parent cannot escalate role', n = 0);
  exception when insufficient_privilege then
    perform t.check('parent cannot escalate role', true);
  end;

  -- reports: draft hidden, shared visible
  perform t.act_as('owner@vegaselite.test');
  insert into progress_reports (organization_id, athlete_id, title, sections, status)
    values (a_org, parent_ath, 'Draft', '{}', 'draft'), (a_org, parent_ath, 'Shared', '{}', 'shared');
  perform t.act_as('parent1@vegaselite.test');
  perform t.check('parent sees shared report only',
    (select count(*) from progress_reports) = 1 and (select count(*) from progress_reports where status = 'draft') = 0);

  -- anonymous: nothing
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  begin
    n := (select count(*) from athletes);
  exception when insufficient_privilege then
    n := 0;
  end;
  perform t.check('anon reads no athletes', n = 0);
  raise notice 'ALL RLS CHECKS PASSED';
end $$;
