import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'
import { num } from '@/lib/format'

export const REPORT_PERIOD_DAYS = 60

export type Improvement = { name: string; unit: string; first: number; last: number; better: boolean | null }

export type ReportSnapshot = {
  athlete: string
  first_name: string
  program: string | null
  level: string | null
  period_days: number
  attendance: { attended: number; total: number }
  improvements: Improvement[]
  focus: string[]
  next_focus: string[]
  generated_on: string
}

export type ReportSections = { summary: string; next_focus: string }

/** Pulls the facts for a report from structured data. Pure reads under RLS. */
export const buildSnapshot = (s: Session, athleteId: string) =>
  withUser(s.userId, async (q) => {
    const [a] = await q<{ first_name: string; last_name: string; program: string | null; level: string | null; level_id: string | null }>(
      `select a.first_name, a.last_name, p.name as program, l.name as level, a.current_level_id as level_id
         from athletes a left join programs p on p.id = a.current_program_id
         left join program_levels l on l.id = a.current_level_id where a.id = $1`,
      [athleteId],
    )
    if (!a) return null
    const [att] = await q<{ attended: number; total: number }>(
      `select count(*) filter (where at.status in ('present','late'))::int as attended, count(*)::int as total
         from attendance at join sessions se on se.id = at.session_id
        where at.athlete_id = $1 and se.starts_at > now() - make_interval(days => $2)`,
      [athleteId, REPORT_PERIOD_DAYS],
    )
    // first vs latest result per metric over the last ~6 months
    const improvements = await q<Improvement>(
      `select t.name, t.unit,
              (array_agg(r.value order by r.recorded_on, r.created_at))[1]::float8 as first,
              (array_agg(r.value order by r.recorded_on desc, r.created_at desc))[1]::float8 as last,
              case when count(*) < 2 then null
                   when t.direction = 'lower' then (array_agg(r.value order by r.recorded_on desc, r.created_at desc))[1] < (array_agg(r.value order by r.recorded_on, r.created_at))[1]
                   else (array_agg(r.value order by r.recorded_on desc, r.created_at desc))[1] > (array_agg(r.value order by r.recorded_on, r.created_at))[1] end as better
         from assessment_results r join assessment_types t on t.id = r.type_id
        where r.athlete_id = $1 and r.recorded_on > (now() at time zone $2)::date - 180
        group by t.id having count(*) >= 2
        order by t.category, t.name`,
      [athleteId, s.timezone],
    )
    const focus = (
      await q<{ focus: string }>(
        `select focus from (select se.focus, max(se.starts_at) as last from session_athletes sa
            join sessions se on se.id = sa.session_id
           where sa.athlete_id = $1 and se.focus is not null
             and se.starts_at between now() - interval '21 days' and now() + interval '1 day'
           group by se.focus) x order by last desc limit 3`,
        [athleteId],
      )
    ).map((r) => r.focus)
    // upcoming curriculum: next weeks after the most recent week taught at this level
    const nextFocus = a.level_id
      ? (
          await q<{ title: string }>(
            `select c.title from curriculum_items c
              where c.level_id = $1
                and c.week_number > coalesce((
                  select ci.week_number from session_athletes sa join sessions se on se.id = sa.session_id
                    join curriculum_items ci on ci.id = se.curriculum_item_id
                   where sa.athlete_id = $2 and se.level_id = $1 and se.starts_at <= now()
                   order by se.starts_at desc limit 1), 0)
              order by c.week_number limit 2`,
            [a.level_id, athleteId],
          )
        ).map((r) => r.title)
      : []
    const [{ today }] = await q<{ today: string }>(`select to_char((now() at time zone $1)::date, 'YYYY-MM-DD') as today`, [s.timezone])
    const snap: ReportSnapshot = {
      athlete: `${a.first_name} ${a.last_name}`,
      first_name: a.first_name,
      program: a.program,
      level: a.level,
      period_days: REPORT_PERIOD_DAYS,
      attendance: att,
      improvements,
      focus,
      next_focus: nextFocus,
      generated_on: today,
    }
    return snap
  })

const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** Deterministic first draft from the snapshot. Staff edit it before sharing. */
export function draftSections(snap: ReportSnapshot): ReportSections {
  const { attended, total } = snap.attendance
  const pct = total ? Math.round((attended / total) * 100) : 0
  const gains = snap.improvements.filter((i) => i.better).slice(0, 3)
  const parts: string[] = []
  parts.push(
    total
      ? `${snap.first_name} attended ${attended} of ${total} sessions over the last ${snap.period_days} days (${pct}%).${pct >= 85 ? ' Great consistency.' : pct < 60 ? ' More consistent attendance will speed up progress.' : ''}`
      : `${snap.first_name} is just getting started with us.`,
  )
  if (gains.length) {
    parts.push(`Biggest gains: ${list(gains.map((g) => `${g.name} from ${num(g.first)} to ${num(g.last)} ${g.unit}`))}.`)
  }
  if (snap.focus.length) parts.push(`Recent training has focused on ${list(snap.focus.map((f) => f.toLowerCase()))}.`)
  return {
    summary: parts.join(' '),
    next_focus: snap.next_focus.length
      ? `Next up in ${snap.level ?? 'the program'}: ${list(snap.next_focus)}.`
      : 'We will keep building on the current focus and retest in the coming weeks.',
  }
}

export type ReportRow = {
  id: string
  athlete_id: string
  athlete: string
  title: string
  status: 'draft' | 'shared'
  created_at: Date
  shared_at: Date | null
  author: string | null
}

export const listReports = (s: Session, athleteId?: string) =>
  withUser(s.userId, (q) =>
    q<ReportRow>(
      `select r.id, r.athlete_id, a.first_name || ' ' || a.last_name as athlete, r.title, r.status,
              r.created_at, r.shared_at, pr.full_name as author
         from progress_reports r join athletes a on a.id = r.athlete_id
         left join profiles pr on pr.id = r.created_by
        where ($1::uuid is null or r.athlete_id = $1)
        order by r.created_at desc limit 100`,
      [athleteId ?? null],
    ),
  )

export type ReportDetail = ReportRow & { sections: ReportSections; snapshot: ReportSnapshot; org_name: string }

export const getReport = (s: Session, id: string) =>
  withUser(s.userId, async (q) => {
    const r = await q<ReportDetail>(
      `select r.id, r.athlete_id, a.first_name || ' ' || a.last_name as athlete, r.title, r.status, r.created_at,
              r.shared_at, pr.full_name as author, r.sections, r.snapshot, o.name as org_name
         from progress_reports r join athletes a on a.id = r.athlete_id
         join organizations o on o.id = r.organization_id
         left join profiles pr on pr.id = r.created_by
        where r.id = $1`,
      [id],
    )
    return r[0] ?? null
  })
