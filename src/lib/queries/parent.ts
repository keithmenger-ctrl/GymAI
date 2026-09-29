import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'

export type ParentAthlete = {
  id: string
  first_name: string
  last_name: string
  program: string | null
  level: string | null
  attended_90d: number
  total_90d: number
  next_session: { starts_at: string; program: string; level: string | null; focus: string | null } | null
  latest_note: { body: string; created_at: string } | null
  membership: { plan: string; price_cents: number; status: string; next_billing_date: string | null } | null
  latest_report: { id: string; title: string } | null
}

/** Everything a parent's home screen needs. RLS limits rows to the parent's own athletes. */
export const myAthletes = (s: Session) =>
  withUser(s.userId, (q) =>
    q<ParentAthlete>(
      `select a.id, a.first_name, a.last_name, p.name as program, l.name as level,
              (select count(*) filter (where at.status in ('present','late'))::int from attendance at
                 join sessions se on se.id = at.session_id
                where at.athlete_id = a.id and se.starts_at > now() - interval '90 days') as attended_90d,
              (select count(*)::int from attendance at join sessions se on se.id = at.session_id
                where at.athlete_id = a.id and se.starts_at > now() - interval '90 days') as total_90d,
              (select json_build_object('starts_at', se.starts_at, 'program', sp.name, 'level', sl.name, 'focus', se.focus)
                 from session_athletes sa join sessions se on se.id = sa.session_id
                 join programs sp on sp.id = se.program_id left join program_levels sl on sl.id = se.level_id
                where sa.athlete_id = a.id and se.ends_at > now() order by se.starts_at limit 1) as next_session,
              (select json_build_object('body', n.body, 'created_at', n.created_at) from coach_notes n
                where n.athlete_id = a.id order by n.created_at desc limit 1) as latest_note,
              (select json_build_object('plan', mp.name, 'price_cents', mp.price_cents, 'status', m.status,
                                        'next_billing_date', m.next_billing_date)
                 from memberships m join membership_plans mp on mp.id = m.plan_id
                where m.athlete_id = a.id order by (m.status = 'canceled'), m.created_at desc limit 1) as membership,
              (select json_build_object('id', r.id, 'title', r.title) from progress_reports r
                where r.athlete_id = a.id and r.status = 'shared' order by r.shared_at desc limit 1) as latest_report
         from athletes a
         left join programs p on p.id = a.current_program_id
         left join program_levels l on l.id = a.current_level_id
        order by a.first_name`,
    ),
  )

export type ParentSession = {
  id: string
  starts_at: Date
  ends_at: Date
  program: string
  level: string | null
  focus: string | null
  location: string | null
  athlete: string
  status: 'present' | 'absent' | 'late' | null
}

export const mySchedule = (s: Session, daysAhead = 14) =>
  withUser(s.userId, (q) =>
    q<ParentSession>(
      `select se.id, se.starts_at, se.ends_at, p.name as program, l.name as level, se.focus, loc.name as location,
              a.first_name as athlete, at.status
         from session_athletes sa
         join athletes a on a.id = sa.athlete_id
         join sessions se on se.id = sa.session_id
         join programs p on p.id = se.program_id
         left join program_levels l on l.id = se.level_id
         left join locations loc on loc.id = se.location_id
         left join attendance at on at.session_id = se.id and at.athlete_id = a.id
        where se.starts_at >= (now() at time zone $1)::date::timestamp at time zone $1
          and se.starts_at < now() + make_interval(days => $2)
        order by se.starts_at, a.first_name`,
      [s.timezone, daysAhead],
    ),
  )
