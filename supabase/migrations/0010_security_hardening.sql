-- Security hardening (found in review). Remember: on hosted Supabase the REST API exposes these tables
-- to every signed-in user, so RLS + grants are the real boundary, not the app's screens.

-- 1. is_demo can only be set by the service role. Otherwise an owner could flip their real academy to
--    "demo" and use the demo switcher to sign in as real parents/coaches.
create or replace function trg_protect_org_columns() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') and new.is_demo is distinct from old.is_demo then
    raise exception 'is_demo cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger protect_org_columns before update on organizations
  for each row execute function trg_protect_org_columns();

-- Org names are shown in emails; keep them short (limits abuse as free-text phishing copy).
alter table organizations add constraint organizations_name_len check (length(name) between 1 and 120);

-- 2. Internal notes on athletes and sessions are staff-only. Parents can read their athlete's row and
--    their sessions, so the notes columns are removed from the `authenticated` grant and exposed to staff
--    through SECURITY DEFINER functions that check org + role.
--    NOTE: new columns on these tables must be added to the grant lists below.
revoke select on athletes from anon, authenticated;
grant select (id, organization_id, first_name, last_name, date_of_birth, sport_id, position, school_team, status,
              join_date, current_program_id, current_level_id, created_at) on athletes to authenticated;
revoke select on sessions from anon, authenticated;
grant select (id, organization_id, program_id, level_id, curriculum_item_id, location_id, coach_id, starts_at,
              ends_at, max_athletes, session_plan, focus, created_at) on sessions to authenticated;

create or replace function athlete_internal_notes(p_athlete uuid) returns text
language sql stable security definer set search_path = public as $$
  select notes from athletes where id = p_athlete and organization_id = auth_org_id() and is_staff()
$$;
create or replace function session_internal_notes(p_session uuid) returns text
language sql stable security definer set search_path = public as $$
  select notes from sessions where id = p_session and organization_id = auth_org_id() and is_staff()
$$;
revoke all on function athlete_internal_notes(uuid), session_internal_notes(uuid) from public, anon;
grant execute on function athlete_internal_notes(uuid), session_internal_notes(uuid) to authenticated;
