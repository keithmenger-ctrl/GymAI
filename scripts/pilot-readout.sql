-- Weekly pilot readout. Run with a privileged connection, e.g.:
--   psql "$DATABASE_URL" -f scripts/pilot-readout.sql
-- Activity excludes demo academies; feedback includes them (prospects exploring a demo count too).

\echo '== Activity per academy, last 7 days'
select o.name as academy,
       count(*) filter (where e.name = 'login' and e.role in ('owner','admin')) as owner_logins,
       count(*) filter (where e.name = 'login' and e.role = 'coach') as coach_logins,
       count(*) filter (where e.name = 'login' and e.role = 'parent') as parent_logins,
       count(*) filter (where e.name in ('attendance_marked','attendance_bulk')) as attendance_actions,
       coalesce(sum((e.props ->> 'count')::int) filter (where e.name = 'assessments_recorded'), 0) as results_recorded,
       count(*) filter (where e.name = 'note_added') as notes,
       count(*) filter (where e.name = 'report_generated') as reports_generated,
       count(*) filter (where e.name = 'report_shared') as reports_shared,
       count(distinct e.user_id) as active_users
  from organizations o
  left join usage_events e on e.organization_id = o.id and e.created_at > now() - interval '7 days'
 where not o.is_demo
 group by o.name
 order by active_users desc, o.name;

\echo '== Sessions with attendance taken (last 7 days, past sessions only)'
select o.name as academy,
       count(*) as sessions,
       count(*) filter (where exists (select 1 from attendance a where a.session_id = s.id)) as with_attendance
  from sessions s join organizations o on o.id = s.organization_id
 where not o.is_demo and s.starts_at between now() - interval '7 days' and now()
 group by o.name order by o.name;

\echo '== Feedback, last 14 days'
select o.name as academy, f.role, f.page, f.created_at::date as day, f.body
  from feedback f join organizations o on o.id = f.organization_id
 where f.created_at > now() - interval '14 days'
 order by f.created_at desc;
