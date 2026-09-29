-- Assessment events were stamped at UTC midnight of recorded_on, which displays as the previous day
-- in US timezones. Use noon UTC so the calendar date is stable everywhere.
create or replace function trg_assessment_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text; v_unit text;
begin
  select name, unit into v_name, v_unit from assessment_types where id = new.type_id;
  insert into athlete_progress_events (organization_id, athlete_id, kind, title, payload, occurred_at)
  values (new.organization_id, new.athlete_id, 'assessment', v_name || ': ' || new.value || ' ' || v_unit,
          jsonb_build_object('type_id', new.type_id, 'value', new.value, 'result_id', new.id),
          (new.recorded_on::timestamp + interval '12 hours') at time zone 'UTC');
  return new;
end $$;
