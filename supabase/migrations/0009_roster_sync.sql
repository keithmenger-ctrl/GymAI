-- Keep upcoming session rosters in step with an athlete's level/status.
-- Called after an athlete is created, changes level, or changes status. Runs as the caller (RLS applies:
-- only owners/admins can write rosters). Never touches sessions that already started or have attendance.
create or replace function sync_future_rosters(p_athlete uuid, p_old_level uuid default null) returns void
language plpgsql set search_path = public as $$
declare a record;
begin
  select id, organization_id, current_level_id, status into a from athletes where id = p_athlete;
  if not found then return; end if;

  -- leave the old level's upcoming sessions (or all upcoming sessions when paused/inactive)
  delete from session_athletes sa
   using sessions s
   where sa.session_id = s.id and sa.athlete_id = p_athlete and s.starts_at > now()
     and not exists (select 1 from attendance at where at.session_id = s.id and at.athlete_id = p_athlete)
     and (a.status not in ('active', 'trial')
          or (p_old_level is not null and p_old_level is distinct from a.current_level_id and s.level_id = p_old_level));

  -- join the current level's upcoming sessions that still have room
  if a.status in ('active', 'trial') and a.current_level_id is not null then
    insert into session_athletes (organization_id, session_id, athlete_id)
    select a.organization_id, s.id, p_athlete
      from sessions s
     where s.level_id = a.current_level_id and s.starts_at > now()
       and (select count(*) from session_athletes x where x.session_id = s.id) < s.max_athletes
    on conflict do nothing;
  end if;
end $$;

revoke all on function sync_future_rosters(uuid, uuid) from public, anon;
grant execute on function sync_future_rosters(uuid, uuid) to authenticated;
