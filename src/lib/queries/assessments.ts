import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'

export type AssessmentType = {
  id: string
  name: string
  unit: string
  direction: 'lower' | 'higher'
  category: string
  reassess_days: number
  result_count: number
  last_recorded: string | null
}

export const listAssessmentTypes = (s: Session) =>
  withUser(s.userId, (q) =>
    q<AssessmentType>(
      `select t.id, t.name, t.unit, t.direction, t.category, t.reassess_days,
              (select count(*)::int from assessment_results r where r.type_id = t.id) as result_count,
              (select max(recorded_on)::text from assessment_results r where r.type_id = t.id) as last_recorded
         from assessment_types t order by t.category, t.name`,
    ),
  )

export type DueAthlete = {
  athlete_id: string
  name: string
  program: string | null
  level: string | null
  last_assessed: string | null
  days_since: number | null
  overdue_metrics: string[]
}

/**
 * Active/trial athletes who are due for testing:
 *  - any metric they've been tested on whose latest result is older than that metric's reassess_days, or
 *  - never assessed at all and joined more than 14 days ago.
 */
export const dueForReassessment = (s: Session) =>
  withUser(s.userId, (q) =>
    q<DueAthlete>(
      `with latest as (
         select r.athlete_id, r.type_id, max(r.recorded_on) as last_on
           from assessment_results r group by r.athlete_id, r.type_id),
       per_athlete as (
         select a.id,
                max(l.last_on) as last_assessed,
                coalesce(array_agg(t.name order by t.name) filter (
                  where l.last_on < (now() at time zone $1)::date - t.reassess_days), '{}') as overdue
           from athletes a
           left join latest l on l.athlete_id = a.id
           left join assessment_types t on t.id = l.type_id
          where a.status in ('active','trial')
          group by a.id)
       select a.id as athlete_id, a.first_name || ' ' || a.last_name as name, p.name as program, lv.name as level,
              pa.last_assessed::text as last_assessed,
              ((now() at time zone $1)::date - pa.last_assessed)::int as days_since,
              pa.overdue as overdue_metrics
         from per_athlete pa
         join athletes a on a.id = pa.id
         left join programs p on p.id = a.current_program_id
         left join program_levels lv on lv.id = a.current_level_id
        where cardinality(pa.overdue) > 0
           or (pa.last_assessed is null and a.join_date < (now() at time zone $1)::date - 14)
        order by pa.last_assessed nulls first, a.last_name`,
      [s.timezone],
    ),
  )

/** "Never tested" / "10 Yard Sprint overdue" / "3 tests overdue". */
export function dueLabel(d: DueAthlete) {
  const n = d.overdue_metrics.length
  if (!d.last_assessed) return 'Never tested'
  return n === 1 ? `${d.overdue_metrics[0]} overdue` : `${n} tests overdue`
}

export type RecentResult = {
  id: string
  athlete_id: string
  athlete: string
  metric: string
  unit: string
  direction: 'lower' | 'higher'
  value: string
  previous: string | null
  recorded_on: string
  recorded_by: string | null
}

export const recentResults = (s: Session, limit = 25) =>
  withUser(s.userId, (q) =>
    q<RecentResult>(
      `select r.id, r.athlete_id, a.first_name || ' ' || a.last_name as athlete, t.name as metric, t.unit, t.direction,
              r.value::text as value,
              (select p.value::text from assessment_results p
                where p.athlete_id = r.athlete_id and p.type_id = r.type_id
                  and (p.recorded_on, p.created_at) < (r.recorded_on, r.created_at)
                order by p.recorded_on desc, p.created_at desc limit 1) as previous,
              r.recorded_on::text as recorded_on, pr.full_name as recorded_by
         from assessment_results r
         join athletes a on a.id = r.athlete_id
         join assessment_types t on t.id = r.type_id
         left join profiles pr on pr.id = r.recorded_by
        order by r.recorded_on desc, r.created_at desc limit $1`,
      [limit],
    ),
  )

export type RecorderAthlete = { id: string; name: string; previous: string | null; previous_on: string | null }

/** Athletes for the recorder, from a session roster or a program level, with their latest value for `typeId`. */
export const recorderAthletes = (s: Session, source: { sessionId?: string; levelId?: string }, typeId: string) =>
  withUser(s.userId, (q) =>
    q<RecorderAthlete>(
      `select a.id, a.first_name || ' ' || a.last_name as name,
              (select r.value::text from assessment_results r where r.athlete_id = a.id and r.type_id = $3
                order by r.recorded_on desc, r.created_at desc limit 1) as previous,
              (select r.recorded_on::text from assessment_results r where r.athlete_id = a.id and r.type_id = $3
                order by r.recorded_on desc, r.created_at desc limit 1) as previous_on
         from athletes a
        where ($1::uuid is not null and a.id in (select athlete_id from session_athletes where session_id = $1))
           or ($1::uuid is null and $2::uuid is not null and a.current_level_id = $2 and a.status in ('active','trial'))
        order by a.first_name, a.last_name`,
      [source.sessionId ?? null, source.levelId ?? null, typeId],
    ),
  )
