import 'server-only'
import type { Session } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { notAttendedSince, programCapacity } from '@/lib/queries/dashboard'
import { dueForReassessment, dueLabel } from '@/lib/queries/assessments'
import { buildSnapshot, draftSections, type ReportSections } from '@/lib/queries/reports'
import { num } from '@/lib/format'
import { aiEnabled, draftText } from './claude'

/**
 * The assistant is a registry of predefined, read-only queries over structured data (all under RLS).
 * Each returns a typed result the UI can render. Nothing here writes to the database; turning a draft
 * into a saved report is a separate, explicit user action.
 */
export type Table = { columns: string[]; rows: { cells: string[]; href?: string }[] }
export type AssistantResult =
  | { kind: 'table'; title: string; summary: string; table: Table }
  | { kind: 'draft'; title: string; athleteId: string; sections: ReportSections; source: 'claude' | 'template' }
  | { kind: 'summary'; title: string; text: string; facts: Table; source: 'claude' | 'template' }
  | { kind: 'help'; title: string; text: string }

export type QueryId = 'inactive' | 'due' | 'almost_full' | 'open' | 'draft_report' | 'summary_60'

export const QUERIES: { id: QueryId; label: string; needsAthlete?: boolean }[] = [
  { id: 'inactive', label: "Show me athletes who haven't attended in 14 days" },
  { id: 'due', label: 'Who is due for reassessment?' },
  { id: 'almost_full', label: 'Which programs are almost full?' },
  { id: 'open', label: 'Which programs have open capacity?' },
  { id: 'draft_report', label: 'Draft a progress report for…', needsAthlete: true },
  { id: 'summary_60', label: "Summarize an athlete's last 60 days", needsAthlete: true },
]

type AthleteRef = { id: string; first_name: string; last_name: string }

/** Deterministic router: keywords -> query, athlete by first/last name. */
export async function route(s: Session, question: string): Promise<{ id: QueryId | null; athlete: AthleteRef | null; ambiguous: AthleteRef[] }> {
  const q = question.toLowerCase()
  const athletes = await withUser(s.userId, (x) => x<AthleteRef>('select id, first_name, last_name from athletes'))
  const words = new Set(q.replace(/[^a-z' -]/g, ' ').split(/\s+/).map((w) => w.replace(/'s$/, '')))
  let matches = athletes.filter((a) => words.has(a.first_name.toLowerCase()) && words.has(a.last_name.toLowerCase()))
  if (!matches.length) matches = athletes.filter((a) => words.has(a.first_name.toLowerCase()))
  if (!matches.length) matches = athletes.filter((a) => words.has(a.last_name.toLowerCase()))
  const athlete = matches.length === 1 ? matches[0] : null
  const ambiguous = matches.length > 1 ? matches : []

  let id: QueryId | null = null
  if (/(report|progress report)/.test(q) && /(draft|write|generate|make|create)/.test(q)) id = 'draft_report'
  else if (/(summar|recap|last \d+ days|overview)/.test(q)) id = 'summary_60'
  else if (/(reassess|retest|re-test|due for (test|assess)|overdue)/.test(q)) id = 'due'
  else if (/(almost full|nearly full|full|at capacity|waitlist)/.test(q) && !/open/.test(q)) id = 'almost_full'
  else if (/(open|available|space|room|spots|capacity)/.test(q)) id = 'open'
  else if (/(attend|absent|missing|haven'?t (been|come|shown)|inactive|disengag|not coming|dropp)/.test(q)) id = 'inactive'
  return { id, athlete, ambiguous }
}

export async function runQuery(s: Session, id: QueryId, athleteId?: string): Promise<AssistantResult> {
  switch (id) {
    case 'inactive': {
      const rows = await notAttendedSince(s, 14)
      return {
        kind: 'table', title: "Athletes who haven't attended in 14+ days",
        summary: rows.length ? `${rows.length} active athletes haven't trained in two weeks or more.` : 'Everyone has trained in the last two weeks.',
        table: { columns: ['Athlete', 'Program', 'Last attended'], rows: rows.map((r) => ({
          href: `/athletes/${r.id}`, cells: [r.name, r.program ?? '—', r.days === null ? 'Never' : `${r.days} days ago`] })) },
      }
    }
    case 'due': {
      const rows = await dueForReassessment(s)
      return {
        kind: 'table', title: 'Due for reassessment',
        summary: rows.length ? `${rows.length} athletes are due for testing.` : 'Everyone is up to date on testing.',
        table: { columns: ['Athlete', 'Program', 'Status'], rows: rows.map((r) => ({
          href: `/athletes/${r.athlete_id}`, cells: [r.name, [r.program, r.level].filter(Boolean).join(' · ') || '—', dueLabel(r)] })) },
      }
    }
    case 'almost_full':
    case 'open': {
      const all = await programCapacity(s)
      const full = id === 'almost_full'
      const rows = all
        .filter((r) => (full ? r.enrolled / r.capacity >= 0.85 : r.enrolled < r.capacity))
        .sort((a, b) => (full ? b.enrolled / b.capacity - a.enrolled / a.capacity : (b.capacity - b.enrolled) - (a.capacity - a.enrolled)))
      return {
        kind: 'table', title: full ? 'Programs that are almost full (85%+)' : 'Programs with open capacity',
        summary: rows.length
          ? full ? `${rows.length} levels are at or above 85% of capacity.` : `${rows.reduce((n, r) => n + r.capacity - r.enrolled, 0)} open spots across ${rows.length} levels.`
          : full ? 'No level is above 85% of capacity.' : 'Every level is full.',
        table: { columns: ['Program', 'Level', 'Enrolled', 'Open spots'], rows: rows.map((r) => ({
          href: `/programs/${r.program_id}`, cells: [r.program, r.level, `${r.enrolled}/${r.capacity}`, String(Math.max(0, r.capacity - r.enrolled))] })) },
      }
    }
    case 'draft_report': {
      const snap = athleteId ? await buildSnapshot(s, athleteId) : null
      if (!snap || !athleteId) return { kind: 'help', title: 'Athlete not found', text: 'Pick an athlete to draft a report for.' }
      const template = draftSections(snap)
      // Claude only sees the snapshot (no private coach notes).
      const summary = await draftText(
        `Write the "coach summary" paragraph of ${snap.first_name}'s progress report for their parents.`,
        { athlete: snap.first_name, program: snap.program, level: snap.level, attendance: snap.attendance, period_days: snap.period_days,
          assessment_changes: snap.improvements, current_focus: snap.focus })
      return {
        kind: 'draft', title: `Draft progress report · ${snap.athlete}`, athleteId,
        sections: { summary: summary ?? template.summary, next_focus: template.next_focus },
        source: summary ? 'claude' : 'template',
      }
    }
    case 'summary_60': {
      if (!athleteId) return { kind: 'help', title: 'Which athlete?', text: 'Include the athlete’s name, e.g. “Summarize Johnny’s last 60 days”.' }
      return summarize60(s, athleteId)
    }
  }
}

async function summarize60(s: Session, athleteId: string): Promise<AssistantResult> {
  const facts = await withUser(s.userId, async (q) => {
    const [a] = await q<{ name: string; first: string; program: string | null; level: string | null }>(
      `select a.first_name || ' ' || a.last_name as name, a.first_name as first, p.name as program, l.name as level
         from athletes a left join programs p on p.id = a.current_program_id left join program_levels l on l.id = a.current_level_id
        where a.id = $1`, [athleteId])
    if (!a) return null
    const [att] = await q<{ present: number; late: number; absent: number }>(
      `select count(*) filter (where at.status = 'present')::int as present, count(*) filter (where at.status = 'late')::int as late,
              count(*) filter (where at.status = 'absent')::int as absent
         from attendance at join sessions se on se.id = at.session_id
        where at.athlete_id = $1 and se.starts_at > now() - interval '60 days'`, [athleteId])
    const tests = await q<{ name: string; unit: string; direction: string; first: number; last: number; n: number }>(
      `select t.name, t.unit, t.direction, count(*)::int as n,
              (array_agg(r.value order by r.recorded_on, r.created_at))[1]::float8 as first,
              (array_agg(r.value order by r.recorded_on desc, r.created_at desc))[1]::float8 as last
         from assessment_results r join assessment_types t on t.id = r.type_id
        where r.athlete_id = $1 and r.recorded_on > current_date - 60 group by t.id order by t.name`, [athleteId])
    const events = await q<{ kind: string; title: string; on: string }>(
      `select kind, title, to_char(occurred_at, 'Mon DD') as on from athlete_progress_events
        where athlete_id = $1 and kind in ('level_change','milestone','program_change') and occurred_at > now() - interval '60 days'
        order by occurred_at`, [athleteId])
    const notes = await q<{ body: string; on: string }>(
      `select body, to_char(created_at, 'Mon DD') as on from coach_notes
        where athlete_id = $1 and created_at > now() - interval '60 days' order by created_at desc limit 5`, [athleteId])
    return { ...a, attendance: att, tests, events, notes }
  })
  if (!facts) return { kind: 'help', title: 'Athlete not found', text: 'Try the athlete’s full name.' }

  const { present, late, absent } = facts.attendance
  const total = present + late + absent
  const better = (t: (typeof facts.tests)[number]) => (t.direction === 'lower' ? t.last < t.first : t.last > t.first)
  const improved = facts.tests.filter((t) => t.n >= 2 && better(t))
  const template = [
    total ? `${facts.first} attended ${present + late} of ${total} sessions in the last 60 days${late ? ` (${late} late)` : ''}.` : `${facts.first} has no recorded sessions in the last 60 days.`,
    improved.length ? `Improved: ${improved.map((t) => `${t.name} ${num(t.first)} → ${num(t.last)} ${t.unit}`).join('; ')}.` : facts.tests.length ? 'Tested, but no measurable improvement yet.' : 'No assessments in this period.',
    facts.events.length ? `Milestones: ${facts.events.map((e) => `${e.title} (${e.on})`).join('; ')}.` : '',
    facts.notes.length ? `Latest coach note (${facts.notes[0].on}): “${facts.notes[0].body}”` : '',
  ].filter(Boolean).join(' ')
  // Staff-only view, so private notes may inform the summary.
  const text = await draftText(`Summarize ${facts.first}'s last 60 days for a coach, in one short paragraph.`, facts)

  return {
    kind: 'summary', title: `${facts.name} · last 60 days`, text: text ?? template, source: text ? 'claude' : 'template',
    facts: {
      columns: ['Fact', 'Value'],
      rows: [
        { cells: ['Program', [facts.program, facts.level].filter(Boolean).join(' · ') || '—'] },
        { cells: ['Attendance', `${present} present · ${late} late · ${absent} absent`] },
        ...facts.tests.map((t) => ({ cells: [t.name, t.n >= 2 ? `${num(t.first)} → ${num(t.last)} ${t.unit}` : `${num(t.last)} ${t.unit}`] })),
        ...facts.events.map((e) => ({ cells: [e.on, e.title] })),
      ],
    },
  }
}

export { aiEnabled }
