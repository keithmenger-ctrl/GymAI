import 'server-only'
import { z } from 'zod'
import type { Q } from '@/lib/db'
import { parseCsv } from './csv'

export const TEMPLATE_HEADERS = [
  'First name', 'Last name', 'Date of birth', 'Sport', 'Position', 'School/team', 'Status',
  'Program', 'Level', 'Join date', 'Parent name', 'Parent email', 'Parent phone', 'Notes',
]

// header aliases -> field
const ALIASES: Record<string, string> = {
  firstname: 'first_name', first: 'first_name', lastname: 'last_name', last: 'last_name', surname: 'last_name',
  dateofbirth: 'dob', dob: 'dob', birthdate: 'dob', birthday: 'dob', sport: 'sport', position: 'position',
  schoolteam: 'school_team', school: 'school_team', team: 'school_team', status: 'status',
  program: 'program', level: 'level', joindate: 'join_date', joined: 'join_date', startdate: 'join_date',
  parentname: 'parent_name', guardianname: 'parent_name', parent: 'parent_name', guardian: 'parent_name',
  parentemail: 'parent_email', guardianemail: 'parent_email', email: 'parent_email',
  parentphone: 'parent_phone', guardianphone: 'parent_phone', phone: 'parent_phone', notes: 'notes',
}
const key = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '')

/** YYYY-MM-DD or M/D/YYYY (US). Returns ISO date or null; undefined when blank. */
function date(v: string): string | null | undefined {
  const t = v.trim()
  if (!t) return undefined
  let y: number, m: number, d: number
  let mt = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (mt) [y, m, d] = [+mt[1], +mt[2], +mt[3]]
  else if ((mt = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    ;[m, d, y] = [+mt[1], +mt[2], +mt[3]]
    if (y < 100) y += y > 30 ? 1900 : 2000
  } else return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

export type ImportRow = {
  line: number
  first_name: string
  last_name: string
  dob?: string
  sport?: string
  position?: string
  school_team?: string
  status: 'active' | 'trial' | 'paused' | 'inactive'
  program?: string
  level?: string
  join_date?: string
  parent_name?: string
  parent_email?: string
  parent_phone?: string
  notes?: string
  program_id?: string
  level_id?: string
  errors: string[]
  duplicate: boolean
}

export type ImportPreview = { rows: ImportRow[]; unknownHeaders: string[]; error?: string }

export async function previewImport(q: Q, text: string): Promise<ImportPreview> {
  const grid = parseCsv(text)
  if (grid.length < 2) return { rows: [], unknownHeaders: [], error: 'The file needs a header row and at least one athlete.' }
  if (grid.length > 1001) return { rows: [], unknownHeaders: [], error: 'Import up to 1,000 athletes at a time.' }
  const headers = grid[0].map((h) => ALIASES[key(h)] ?? null)
  const unknownHeaders = grid[0].filter((_, i) => !headers[i] && grid[0][i].trim())
  if (!headers.includes('first_name') || !headers.includes('last_name')) {
    return { rows: [], unknownHeaders, error: 'Columns "First name" and "Last name" are required. Download the template to see the expected columns.' }
  }
  const programs = await q<{ id: string; name: string; levels: { id: string; name: string }[] }>(
    `select p.id, p.name, coalesce((select json_agg(json_build_object('id', l.id, 'name', l.name)) from program_levels l where l.program_id = p.id), '[]') as levels
       from programs p where p.active`)
  // Same person = same name, and the birthdates match or one side has none (a row without a DOB
  // must not create a second "Johnny Alvarez").
  const byName = new Map<string, (string | null)[]>()
  for (const a of await q<{ k: string; dob: string | null }>(
    `select lower(first_name || '|' || last_name) as k, date_of_birth::text as dob from athletes`)) {
    byName.set(a.k, [...(byName.get(a.k) ?? []), a.dob])
  }
  const sameAs = (dobs: (string | null)[] | undefined, dob?: string) =>
    Boolean(dobs?.some((d) => d === null || !dob || d === dob))
  const seen = new Map<string, (string | null)[]>()

  const rows = grid.slice(1).map((cells, i): ImportRow => {
    const get = (f: string) => { const idx = headers.indexOf(f); return idx >= 0 ? (cells[idx] ?? '').trim() : '' }
    const errors: string[] = []
    const r: ImportRow = { line: i + 2, first_name: get('first_name'), last_name: get('last_name'), status: 'active', errors, duplicate: false }
    if (!r.first_name) errors.push('First name is missing')
    if (!r.last_name) errors.push('Last name is missing')
    const dob = date(get('dob')); if (dob === null) errors.push(`Date of birth "${get('dob')}" isn't a date`); else r.dob = dob
    const jd = date(get('join_date')); if (jd === null) errors.push(`Join date "${get('join_date')}" isn't a date`); else r.join_date = jd
    const st = get('status').toLowerCase()
    if (st) { if (['active', 'trial', 'paused', 'inactive'].includes(st)) r.status = st as ImportRow['status']; else errors.push(`Status "${get('status')}" should be active, trial, paused or inactive`) }
    for (const f of ['sport', 'position', 'school_team', 'parent_name', 'parent_phone', 'notes'] as const) { const v = get(f); if (v) r[f] = v }
    const email = get('parent_email')
    if (email) { if (z.email().safeParse(email).success) r.parent_email = email.toLowerCase(); else errors.push(`Parent email "${email}" is invalid`) }
    if (r.parent_email && !r.parent_name) errors.push('Parent email given without a parent name')
    const prog = get('program'), lvl = get('level')
    if (prog) {
      const p = programs.find((x) => x.name.toLowerCase() === prog.toLowerCase())
      if (!p) errors.push(`Program "${prog}" doesn't exist yet`)
      else {
        r.program = p.name; r.program_id = p.id
        if (lvl) {
          const want = lvl.toLowerCase().replace(/^level\s*/, '')
          const l = p.levels.find((x) => x.name.toLowerCase() === lvl.toLowerCase() || x.name.toLowerCase().replace(/^level\s*/, '') === want)
          if (!l) errors.push(`Level "${lvl}" isn't in ${p.name}`)
          else { r.level = l.name; r.level_id = l.id }
        }
      }
    } else if (lvl) errors.push('Level given without a program')
    const k = `${r.first_name}|${r.last_name}`.toLowerCase()
    if (sameAs(byName.get(k), r.dob)) r.duplicate = true
    else if (sameAs(seen.get(k), r.dob)) errors.push('Same athlete appears twice in this file')
    seen.set(k, [...(seen.get(k) ?? []), r.dob ?? null])
    return r
  })
  return { rows, unknownHeaders }
}

/** Imports valid, non-duplicate rows. Runs inside the caller's (RLS) transaction. */
export async function commitImport(q: Q, orgId: string, rows: ImportRow[]) {
  let created = 0
  for (const r of rows.filter((x) => !x.errors.length && !x.duplicate)) {
    let sportId: string | null = null
    if (r.sport) {
      const [sp] = await q<{ id: string }>(
        `insert into sports (organization_id, name) values ($1, $2)
         on conflict (organization_id, name) do update set name = excluded.name returning id`, [orgId, r.sport])
      sportId = sp.id
    }
    const [a] = await q<{ id: string }>(
      `insert into athletes (organization_id, first_name, last_name, date_of_birth, sport_id, position, school_team, status,
                             join_date, notes, current_program_id, current_level_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::date, current_date),$10,$11,$12) returning id`,
      [orgId, r.first_name, r.last_name, r.dob ?? null, sportId, r.position ?? null, r.school_team ?? null, r.status,
       r.join_date ?? null, r.notes ?? null, r.program_id ?? null, r.level_id ?? null])
    await q(`insert into athlete_progress_events (organization_id, athlete_id, kind, title, occurred_at)
             values ($1, $2, 'milestone', 'Joined ' || (select name from organizations where id = $1), coalesce($3::date, current_date) + time '12:00')`,
      [orgId, a.id, r.join_date ?? null])
    if (r.parent_name) {
      let gid = r.parent_email
        ? (await q<{ id: string }>('select id from guardians where lower(email) = $1 limit 1', [r.parent_email]))[0]?.id
        : undefined
      if (!gid) {
        gid = (await q<{ id: string }>('insert into guardians (organization_id, name, email, phone) values ($1,$2,$3,$4) returning id',
          [orgId, r.parent_name, r.parent_email ?? null, r.parent_phone ?? null]))[0].id
      }
      await q('insert into athlete_guardians (organization_id, athlete_id, guardian_id) values ($1,$2,$3) on conflict do nothing', [orgId, a.id, gid])
    }
    created++
  }
  return created
}
