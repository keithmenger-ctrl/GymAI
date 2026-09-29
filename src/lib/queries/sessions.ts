import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'

export type SessionCard = {
  id: string
  starts_at: Date
  ends_at: Date
  program: string
  level: string | null
  coach: string | null
  location: string | null
  focus: string | null
  max_athletes: number
  enrolled: number
  marked: number
  attended: number
}

const CARD_COLS = `
  s.id, s.starts_at, s.ends_at, p.name as program, l.name as level, c.name as coach, loc.name as location,
  s.focus, s.max_athletes,
  (select count(*)::int from session_athletes sa where sa.session_id = s.id) as enrolled,
  (select count(*)::int from attendance a where a.session_id = s.id) as marked,
  (select count(*)::int from attendance a where a.session_id = s.id and a.status in ('present','late')) as attended`
const CARD_FROM = `
  from sessions s
  join programs p on p.id = s.program_id
  left join program_levels l on l.id = s.level_id
  left join coaches c on c.id = s.coach_id
  left join locations loc on loc.id = s.location_id`

/** Sessions whose local (facility timezone) date falls in [from, to). Dates are 'YYYY-MM-DD'. */
export const sessionsBetween = (s: Session, from: string, to: string) =>
  withUser(s.userId, (q) =>
    q<SessionCard>(
      `select ${CARD_COLS} ${CARD_FROM}
        where s.starts_at >= ($1::date::timestamp at time zone $3)
          and s.starts_at <  ($2::date::timestamp at time zone $3)
        order by s.starts_at`,
      [from, to, s.timezone],
    ),
  )

/**
 * Today's sessions in facility time. Coaches see the sessions assigned to them;
 * owners/admins using the coach view see every session today.
 */
export const todaysSessions = (s: Session) =>
  withUser(s.userId, (q) =>
    q<SessionCard>(
      `select ${CARD_COLS} ${CARD_FROM}
        where (s.starts_at at time zone $1)::date = (now() at time zone $1)::date
          and ($2::boolean = false or s.coach_id in (select id from coaches where profile_id = $3))
        order by s.starts_at`,
      [s.timezone, s.role === 'coach', s.userId],
    ),
  )

export const nextSessionForCoach = (s: Session) =>
  withUser(s.userId, async (q) => {
    const r = await q<SessionCard>(
      `select ${CARD_COLS} ${CARD_FROM}
        where s.starts_at > now()
          and (s.starts_at at time zone $1)::date > (now() at time zone $1)::date
          and ($2::boolean = false or s.coach_id in (select id from coaches where profile_id = $3))
        order by s.starts_at limit 1`,
      [s.timezone, s.role === 'coach', s.userId],
    )
    return r[0] ?? null
  })

export type RosterAthlete = {
  id: string
  first_name: string
  last_name: string
  level: string | null
  status: 'present' | 'absent' | 'late' | null
  last_note: string | null
  note_count: number
}

export type SessionNote = {
  id: string
  athlete_id: string | null
  athlete_name: string | null
  body: string
  shareable: boolean
  author: string | null
  created_at: Date
}

export type SessionDetail = {
  id: string
  starts_at: Date
  ends_at: Date
  date_local: string
  start_local: string
  end_local: string
  program_id: string
  program: string
  level_id: string | null
  level: string | null
  coach_id: string | null
  coach: string | null
  coach_profile_id: string | null
  location_id: string | null
  location: string | null
  max_athletes: number
  session_plan: string | null
  focus: string | null
  notes: string | null
  curriculum_item_id: string | null
  curriculum: {
    week_number: number
    title: string
    objectives: string | null
    cues: string | null
    video_url: string | null
  } | null
  roster: RosterAthlete[]
  session_notes: SessionNote[]
}

export const getSessionDetail = (s: Session, id: string) =>
  withUser(s.userId, async (q) => {
    const r = await q<SessionDetail>(
      `select s.id, s.starts_at, s.ends_at,
              to_char(s.starts_at at time zone $2, 'YYYY-MM-DD') as date_local,
              to_char(s.starts_at at time zone $2, 'HH24:MI') as start_local,
              to_char(s.ends_at at time zone $2, 'HH24:MI') as end_local,
              s.program_id, p.name as program, s.level_id, l.name as level,
              s.coach_id, c.name as coach, c.profile_id as coach_profile_id,
              s.location_id, loc.name as location, s.max_athletes, s.session_plan, s.focus, s.notes,
              s.curriculum_item_id,
              case when ci.id is null then null else json_build_object(
                'week_number', ci.week_number, 'title', ci.title, 'objectives', ci.objectives,
                'cues', ci.cues, 'video_url', ci.video_url) end as curriculum,
              coalesce((select json_agg(json_build_object(
                  'id', a.id, 'first_name', a.first_name, 'last_name', a.last_name, 'level', al.name,
                  'status', att.status,
                  'last_note', (select n.body from coach_notes n where n.athlete_id = a.id order by n.created_at desc limit 1),
                  'note_count', (select count(*) from coach_notes n where n.athlete_id = a.id))
                  order by a.first_name, a.last_name)
                from session_athletes sa
                join athletes a on a.id = sa.athlete_id
                left join program_levels al on al.id = a.current_level_id
                left join attendance att on att.session_id = sa.session_id and att.athlete_id = a.id
               where sa.session_id = s.id), '[]'::json) as roster,
              coalesce((select json_agg(json_build_object(
                  'id', n.id, 'athlete_id', n.athlete_id,
                  'athlete_name', case when na.id is null then null else na.first_name || ' ' || na.last_name end,
                  'body', n.body, 'shareable', n.shareable, 'author', pr.full_name, 'created_at', n.created_at)
                  order by n.created_at desc)
                from coach_notes n
                left join athletes na on na.id = n.athlete_id
                left join profiles pr on pr.id = n.author_id
               where n.session_id = s.id), '[]'::json) as session_notes
         from sessions s
         join programs p on p.id = s.program_id
         left join program_levels l on l.id = s.level_id
         left join coaches c on c.id = s.coach_id
         left join locations loc on loc.id = s.location_id
         left join curriculum_items ci on ci.id = s.curriculum_item_id
        where s.id = $1`,
      [id, s.timezone],
    )
    return r[0] ?? null
  })

export type Option = { id: string; name: string }

export const coachOptions = (s: Session) =>
  withUser(s.userId, (q) => q<Option>('select id, name from coaches where active order by name'))

export const locationOptions = (s: Session) =>
  withUser(s.userId, (q) => q<Option>('select id, name from locations order by name'))

export type CurriculumOption = { id: string; level_id: string; week_number: number; title: string }

export const curriculumOptions = (s: Session) =>
  withUser(s.userId, (q) =>
    q<CurriculumOption>('select id, level_id, week_number, title from curriculum_items order by week_number, title'),
  )

/** Active/trial athletes not yet on this session's roster (for enrolling). */
export const enrollableAthletes = (s: Session, sessionId: string) =>
  withUser(s.userId, (q) =>
    q<{ id: string; name: string; program: string | null; level: string | null; in_level: boolean }>(
      `select a.id, a.first_name || ' ' || a.last_name as name, p.name as program, l.name as level,
              a.current_level_id is not distinct from se.level_id as in_level
         from athletes a
         cross join sessions se
         left join programs p on p.id = a.current_program_id
         left join program_levels l on l.id = a.current_level_id
        where se.id = $1 and a.status in ('active','trial')
          and not exists (select 1 from session_athletes sa where sa.session_id = se.id and sa.athlete_id = a.id)
        order by in_level desc, a.last_name, a.first_name`,
      [sessionId],
    ),
  )

/** Monday (facility-local) of the week containing `date` ('YYYY-MM-DD'), or of today when omitted. */
export const weekStart = (s: Session, date?: string) =>
  withUser(s.userId, async (q) => {
    const r = await q<{ monday: string; today: string }>(
      `select to_char(date_trunc('week', coalesce($1::date, (now() at time zone $2)::date)), 'YYYY-MM-DD') as monday,
              to_char((now() at time zone $2)::date, 'YYYY-MM-DD') as today`,
      [date ?? null, s.timezone],
    )
    return r[0]
  })
