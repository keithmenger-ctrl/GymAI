-- Row level security. Tenant isolation comes from auth_org_id(); roles from auth_role().
-- Helpers are SECURITY DEFINER so they can read user_roles without recursing through its own RLS.

create or replace function auth_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from user_roles where user_id = auth.uid()
$$;

create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from user_roles where user_id = auth.uid()
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('owner', 'admin'), false)
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('owner', 'admin', 'coach'), false)
$$;

create or replace function can_see_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('owner', 'admin') or can_view_finance from user_roles where user_id = auth.uid()),
    false)
$$;

-- true when the signed-in parent is a guardian of the athlete
create or replace function is_guardian_of(p_athlete uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from athlete_guardians ag
    join guardians g on g.id = ag.guardian_id
    where ag.athlete_id = p_athlete
      and g.profile_id = auth.uid()
      and ag.organization_id = auth_org_id()
  )
$$;

create or replace function is_own_coach(p_coach uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from coaches where id = p_coach and profile_id = auth.uid())
$$;

-- Signup: creates an organization and makes the caller its owner.
create or replace function create_organization(p_org_name text, p_full_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from user_roles where user_id = auth.uid()) then
    raise exception 'user already belongs to an organization';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into profiles (id, full_name, email) values (auth.uid(), p_full_name, v_email)
    on conflict (id) do update set full_name = excluded.full_name;
  insert into organizations (name) values (p_org_name) returning id into v_org;
  insert into user_roles (user_id, organization_id, role, can_view_finance)
    values (auth.uid(), v_org, 'owner', true);
  return v_org;
end $$;

revoke all on function create_organization(text, text) from public, anon;
grant execute on function create_organization(text, text) to authenticated;

-- ---------------------------------------------------------------- enable RLS everywhere
do $$
declare t text;
begin
  for t in select unnest(array[
    'organizations','profiles','user_roles','locations','sports','coaches','guardians','programs',
    'program_levels','curriculum_items','athletes','athlete_guardians','sessions','session_athletes',
    'attendance','coach_notes','assessment_types','assessment_results','athlete_progress_events',
    'membership_plans','memberships','payments','progress_reports'])
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- identity tables
create policy org_read on organizations for select using (id = auth_org_id());
create policy org_update on organizations for update
  using (id = auth_org_id() and auth_role() = 'owner') with check (id = auth_org_id());

create policy profiles_read on profiles for select using (
  id = auth.uid()
  or exists (select 1 from user_roles r where r.user_id = profiles.id and r.organization_id = auth_org_id() and is_staff())
);
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy roles_read_self on user_roles for select using (user_id = auth.uid());
create policy roles_read_staff on user_roles for select using (organization_id = auth_org_id() and is_staff());
-- writes (invites, role changes) happen server-side with the service role only.

-- ---------------------------------------------------------------- setup tables: org members read, admins write
do $$
declare t text;
begin
  for t in select unnest(array['locations','sports','programs','program_levels','curriculum_items',
                               'assessment_types','membership_plans'])
  loop
    execute format('create policy %I on %I for select using (organization_id = auth_org_id())', t || '_read', t);
    execute format('create policy %I on %I for all using (organization_id = auth_org_id() and is_admin())
                    with check (organization_id = auth_org_id() and is_admin())', t || '_write', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- people
-- coaches: staff read; admins write
create policy coaches_read on coaches for select using (organization_id = auth_org_id() and is_staff());
create policy coaches_write on coaches for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());

-- guardians: staff read; a parent reads their own row; admins write
create policy guardians_read on guardians for select using (
  organization_id = auth_org_id() and (is_staff() or profile_id = auth.uid()));
create policy guardians_write on guardians for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());

-- athletes
create policy athletes_read on athletes for select using (
  organization_id = auth_org_id() and (is_staff() or is_guardian_of(id)));
create policy athletes_write on athletes for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());

create policy athlete_guardians_read on athlete_guardians for select using (
  organization_id = auth_org_id() and (is_staff() or is_guardian_of(athlete_id)));
create policy athlete_guardians_write on athlete_guardians for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());

-- ---------------------------------------------------------------- sessions
create policy sessions_read on sessions for select using (
  organization_id = auth_org_id()
  and (is_staff() or exists (
    select 1 from session_athletes sa where sa.session_id = sessions.id and is_guardian_of(sa.athlete_id))));
create policy sessions_admin_write on sessions for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());
-- a coach may update (notes/plan) only sessions assigned to them
create policy sessions_coach_update on sessions for update
  using (organization_id = auth_org_id() and auth_role() = 'coach' and is_own_coach(coach_id))
  with check (organization_id = auth_org_id() and is_own_coach(coach_id));

create policy session_athletes_read on session_athletes for select using (
  organization_id = auth_org_id() and (is_staff() or is_guardian_of(athlete_id)));
create policy session_athletes_write on session_athletes for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());

create policy attendance_read on attendance for select using (
  organization_id = auth_org_id() and (is_staff() or is_guardian_of(athlete_id)));
create policy attendance_write on attendance for all using (organization_id = auth_org_id() and is_staff())
  with check (organization_id = auth_org_id() and is_staff());

-- ---------------------------------------------------------------- coaching + assessments
create policy notes_read on coach_notes for select using (
  organization_id = auth_org_id()
  and (is_staff() or (shareable and athlete_id is not null and is_guardian_of(athlete_id))));
create policy notes_insert on coach_notes for insert with check (
  organization_id = auth_org_id() and is_staff() and author_id = auth.uid());
create policy notes_update on coach_notes for update
  using (organization_id = auth_org_id() and (is_admin() or author_id = auth.uid()))
  with check (organization_id = auth_org_id() and (is_admin() or author_id = auth.uid()));
create policy notes_delete on coach_notes for delete using (
  organization_id = auth_org_id() and (is_admin() or author_id = auth.uid()));

create policy results_read on assessment_results for select using (
  organization_id = auth_org_id() and (is_staff() or is_guardian_of(athlete_id)));
create policy results_write on assessment_results for all using (organization_id = auth_org_id() and is_staff())
  with check (organization_id = auth_org_id() and is_staff());

-- timeline: parents never see non-shareable note events (those carry no body anyway)
create policy events_read on athlete_progress_events for select using (
  organization_id = auth_org_id()
  and (is_staff() or (is_guardian_of(athlete_id) and (kind <> 'note' or payload ->> 'shareable' = 'true'))));
create policy events_insert on athlete_progress_events for insert with check (
  organization_id = auth_org_id() and is_staff());
-- events are append-only from the client; no update/delete policies.

-- ---------------------------------------------------------------- money
create policy memberships_read on memberships for select using (
  organization_id = auth_org_id()
  and (can_see_finance() or (guardian_id in (select id from guardians where profile_id = auth.uid()))));
create policy memberships_write on memberships for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());

create policy payments_read on payments for select using (
  organization_id = auth_org_id()
  and (can_see_finance() or exists (
    select 1 from memberships m
    join guardians g on g.id = m.guardian_id
    where m.id = payments.membership_id and g.profile_id = auth.uid())));
create policy payments_write on payments for all using (organization_id = auth_org_id() and is_admin())
  with check (organization_id = auth_org_id() and is_admin());

-- ---------------------------------------------------------------- reports
create policy reports_read on progress_reports for select using (
  organization_id = auth_org_id()
  and (is_staff() or (status = 'shared' and is_guardian_of(athlete_id))));
create policy reports_write on progress_reports for all using (organization_id = auth_org_id() and is_staff())
  with check (organization_id = auth_org_id() and is_staff());

-- ---------------------------------------------------------------- timeline triggers
create or replace function trg_assessment_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_unit text;
begin
  select name, unit into v_name, v_unit from assessment_types where id = new.type_id;
  insert into athlete_progress_events (organization_id, athlete_id, kind, title, payload, occurred_at)
  values (new.organization_id, new.athlete_id, 'assessment', v_name || ': ' || new.value || ' ' || v_unit,
          jsonb_build_object('type_id', new.type_id, 'value', new.value, 'result_id', new.id),
          new.recorded_on::timestamptz);
  return new;
end $$;
create trigger assessment_event after insert on assessment_results
  for each row execute function trg_assessment_event();

create or replace function trg_note_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.athlete_id is null then return new; end if;
  insert into athlete_progress_events (organization_id, athlete_id, kind, title, payload, occurred_at)
  values (new.organization_id, new.athlete_id, 'note',
          case when new.shareable then new.body else 'Coach note added' end,
          jsonb_build_object('note_id', new.id, 'shareable', new.shareable), new.created_at);
  return new;
end $$;
create trigger note_event after insert on coach_notes
  for each row execute function trg_note_event();

create or replace function trg_athlete_change_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_old text; v_new text;
begin
  if new.current_program_id is distinct from old.current_program_id then
    select name into v_new from programs where id = new.current_program_id;
    insert into athlete_progress_events (organization_id, athlete_id, kind, title, payload)
    values (new.organization_id, new.id, 'program_change', 'Moved to ' || coalesce(v_new, 'no program'),
            jsonb_build_object('from', old.current_program_id, 'to', new.current_program_id));
  end if;
  if new.current_level_id is distinct from old.current_level_id then
    select name into v_new from program_levels where id = new.current_level_id;
    insert into athlete_progress_events (organization_id, athlete_id, kind, title, payload)
    values (new.organization_id, new.id, 'level_change', 'Advanced to ' || coalesce(v_new, 'no level'),
            jsonb_build_object('from', old.current_level_id, 'to', new.current_level_id));
  end if;
  return new;
end $$;
create trigger athlete_change_event after update on athletes
  for each row execute function trg_athlete_change_event();
