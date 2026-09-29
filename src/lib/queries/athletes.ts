import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'

export type AthleteRow = {
  id: string
  first_name: string
  last_name: string
  age: number | null
  status: 'active' | 'trial' | 'paused' | 'inactive'
  sport: string | null
  position: string | null
  program_name: string | null
  level_name: string | null
  guardian_name: string | null
  attended_30d: number
  last_attended: string | null
}

export type AthleteFilters = { q?: string; status?: string; programId?: string }

export const listAthletes = (s: Session, f: AthleteFilters = {}) =>
  withUser(s.userId, (q) =>
    q<AthleteRow>(
      `select a.id, a.first_name, a.last_name,
              case when a.date_of_birth is null then null else date_part('year', age(a.date_of_birth))::int end as age,
              a.status, sp.name as sport, a.position,
              p.name as program_name, l.name as level_name,
              (select g.name from athlete_guardians ag join guardians g on g.id = ag.guardian_id
                where ag.athlete_id = a.id order by g.name limit 1) as guardian_name,
              (select count(*)::int from attendance at
                 join sessions se on se.id = at.session_id
                where at.athlete_id = a.id and at.status in ('present','late')
                  and se.starts_at > now() - interval '30 days') as attended_30d,
              (select max(se.starts_at)::text from attendance at
                 join sessions se on se.id = at.session_id
                where at.athlete_id = a.id and at.status in ('present','late')) as last_attended
         from athletes a
         left join sports sp on sp.id = a.sport_id
         left join programs p on p.id = a.current_program_id
         left join program_levels l on l.id = a.current_level_id
        where ($1::text is null or (a.first_name || ' ' || a.last_name) ilike '%' || $1 || '%')
          and ($2::text is null or a.status = $2)
          and ($3::uuid is null or a.current_program_id = $3)
        order by a.last_name, a.first_name`,
      [f.q?.trim() || null, f.status || null, f.programId || null],
    ),
  )

export type AthleteDetail = {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  age: number | null
  sport_id: string | null
  sport: string | null
  position: string | null
  school_team: string | null
  status: AthleteRow['status']
  join_date: string
  notes: string | null
  current_program_id: string | null
  current_level_id: string | null
  program_name: string | null
  level_name: string | null
  guardians: {
    id: string
    name: string
    email: string | null
    phone: string | null
    has_login: boolean
  }[]
}

export const getAthlete = (s: Session, id: string) =>
  withUser(s.userId, async (q) => {
    const rows = await q<AthleteDetail>(
      `select a.id, a.first_name, a.last_name, a.date_of_birth::text as date_of_birth,
              case when a.date_of_birth is null then null else date_part('year', age(a.date_of_birth))::int end as age,
              a.sport_id, sp.name as sport, a.position, a.school_team, a.status, a.join_date::text as join_date, a.notes,
              a.current_program_id, a.current_level_id, p.name as program_name, l.name as level_name,
              coalesce((select json_agg(json_build_object('id', g.id, 'name', g.name, 'email', g.email,
                                                          'phone', g.phone, 'has_login', g.profile_id is not null)
                                        order by g.name)
                          from athlete_guardians ag join guardians g on g.id = ag.guardian_id
                         where ag.athlete_id = a.id), '[]'::json) as guardians
         from athletes a
         left join sports sp on sp.id = a.sport_id
         left join programs p on p.id = a.current_program_id
         left join program_levels l on l.id = a.current_level_id
        where a.id = $1`,
      [id],
    )
    return rows[0] ?? null
  })

export type ProgramOption = { id: string; name: string; levels: { id: string; name: string }[] }

export const programOptions = (s: Session) =>
  withUser(s.userId, (q) =>
    q<ProgramOption>(
      `select p.id, p.name,
              coalesce((select json_agg(json_build_object('id', l.id, 'name', l.name) order by l.sort_order)
                          from program_levels l where l.program_id = p.id), '[]'::json) as levels
         from programs p where p.active order by p.name`,
    ),
  )

export const sportOptions = (s: Session) =>
  withUser(s.userId, (q) => q<{ id: string; name: string }>('select id, name from sports order by name'))

// ---------------------------------------------------------------- profile sections

export type AttendanceSummary = { attended: number; total: number; last_attended: string | null }

export const attendanceSummary = (s: Session, athleteId: string) =>
  withUser(s.userId, async (q) => {
    const r = await q<AttendanceSummary>(
      `select count(*) filter (where at.status in ('present','late'))::int as attended,
              count(*)::int as total,
              (max(se.starts_at) filter (where at.status in ('present','late')))::text as last_attended
         from attendance at join sessions se on se.id = at.session_id
        where at.athlete_id = $1 and se.starts_at > now() - interval '90 days'`,
      [athleteId],
    )
    return r[0]
  })

export type AttendanceRow = { session_id: string; starts_at: Date; status: 'present' | 'absent' | 'late'; program: string; level: string | null }

export const recentAttendance = (s: Session, athleteId: string, limit = 12) =>
  withUser(s.userId, (q) =>
    q<AttendanceRow>(
      `select at.session_id, se.starts_at, at.status, p.name as program, l.name as level
         from attendance at
         join sessions se on se.id = at.session_id
         join programs p on p.id = se.program_id
         left join program_levels l on l.id = se.level_id
        where at.athlete_id = $1
        order by se.starts_at desc limit $2`,
      [athleteId, limit],
    ),
  )

export type AssessmentSeries = {
  type_id: string
  name: string
  unit: string
  direction: 'lower' | 'higher'
  category: string
  results: { id: string; value: string; recorded_on: string }[] // oldest first
}

export const assessmentSeries = (s: Session, athleteId: string) =>
  withUser(s.userId, (q) =>
    q<AssessmentSeries>(
      `select t.id as type_id, t.name, t.unit, t.direction, t.category,
              json_agg(json_build_object('id', r.id, 'value', r.value::text, 'recorded_on', r.recorded_on::text)
                       order by r.recorded_on, r.created_at) as results
         from assessment_results r join assessment_types t on t.id = r.type_id
        where r.athlete_id = $1
        group by t.id
        order by t.category, t.name`,
      [athleteId],
    ),
  )

/** Improvement as a signed fraction: positive = better, taking direction into account. */
export function improvement(series: AssessmentSeries) {
  const r = series.results
  if (r.length < 2) return null
  const first = Number(r[0].value)
  const last = Number(r[r.length - 1].value)
  const diff = last - first
  const better = series.direction === 'lower' ? diff < 0 : diff > 0
  return { first, last, diff, better: diff === 0 ? null : better }
}

export type NoteRow = { id: string; body: string; shareable: boolean; created_at: Date; author: string | null; session_id: string | null }

export const athleteNotes = (s: Session, athleteId: string, limit = 10) =>
  withUser(s.userId, (q) =>
    q<NoteRow>(
      `select n.id, n.body, n.shareable, n.created_at, pr.full_name as author, n.session_id
         from coach_notes n left join profiles pr on pr.id = n.author_id
        where n.athlete_id = $1
        order by n.created_at desc limit $2`,
      [athleteId, limit],
    ),
  )

export type TimelineEvent = { id: string; kind: string; title: string; occurred_at: Date }

export const athleteTimeline = (s: Session, athleteId: string, limit = 40) =>
  withUser(s.userId, (q) =>
    q<TimelineEvent>(
      `select id, kind, title, occurred_at from athlete_progress_events
        where athlete_id = $1 order by occurred_at desc, id limit $2`,
      [athleteId, limit],
    ),
  )

/** Distinct curriculum focus of the athlete's recent + upcoming sessions (most recent first). */
export const currentFocus = (s: Session, athleteId: string) =>
  withUser(s.userId, async (q) => {
    const rows = await q<{ focus: string }>(
      `select focus from (
         select se.focus, max(se.starts_at) as last
           from session_athletes sa join sessions se on se.id = sa.session_id
          where sa.athlete_id = $1 and se.focus is not null
            and se.starts_at between now() - interval '14 days' and now() + interval '7 days'
          group by se.focus) x
       order by last desc limit 3`,
      [athleteId],
    )
    return rows.map((r) => r.focus)
  })
