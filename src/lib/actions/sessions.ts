'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireStaff } from '@/lib/auth'
import { withUser, type Q } from '@/lib/db'
import type { FormState } from './auth'
import { track } from '@/lib/track'

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const opt = <T extends z.ZodType>(s: T) => z.preprocess(blank, s.optional())
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Time is invalid')

const sessionSchema = z
  .object({
    program_id: z.uuid('Choose a program'),
    level_id: opt(z.uuid()),
    curriculum_item_id: opt(z.uuid()),
    coach_id: opt(z.uuid()),
    location_id: opt(z.uuid()),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date is required'),
    start: time,
    end: time,
    max_athletes: z.coerce.number().int().min(1, 'Max athletes must be at least 1').max(500),
    session_plan: opt(z.string().trim()),
    focus: opt(z.string().trim()),
    notes: opt(z.string().trim()),
    auto_enroll: z.preprocess((v) => v === 'on', z.boolean()),
    repeat_weeks: z.coerce.number().int().min(1).max(12).default(1),
  })
  .refine((d) => d.end > d.start, { message: 'End time must be after start time' })

type Input = z.infer<typeof sessionSchema>

async function validateRefs(q: Q, d: Input) {
  if (d.level_id) {
    const ok = await q('select 1 from program_levels where id = $1 and program_id = $2', [d.level_id, d.program_id])
    if (!ok.length) throw new Error('That level does not belong to the chosen program.')
  }
  if (d.curriculum_item_id) {
    if (!d.level_id) throw new Error('Choose a level before choosing a curriculum week.')
    const ok = await q('select 1 from curriculum_items where id = $1 and level_id = $2', [d.curriculum_item_id, d.level_id])
    if (!ok.length) throw new Error('That curriculum week does not belong to the chosen level.')
  }
}

/** Fill focus + plan from the curriculum week when the admin left them blank. */
async function fromCurriculum(q: Q, d: Input) {
  if (!d.curriculum_item_id) return { focus: d.focus ?? null, plan: d.session_plan ?? null }
  const r = await q<{ title: string; drills: string[] }>('select title, drills from curriculum_items where id = $1', [d.curriculum_item_id])
  const plan = r[0]?.drills.map((x, i) => `${i + 1}. ${x}`).join('\n') || null
  return { focus: d.focus ?? r[0]?.title ?? null, plan: d.session_plan ?? plan }
}

const parse = (fd: FormData) => {
  const r = sessionSchema.safeParse(Object.fromEntries(fd))
  return r.success ? ({ ok: true, data: r.data } as const) : ({ ok: false, error: r.error.issues[0].message } as const)
}

export async function createSession(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = parse(fd)
  if (!p.ok) return { error: p.error }
  const d = p.data
  let firstId: string
  try {
    firstId = await withUser(s.userId, async (q) => {
      await validateRefs(q, d)
      const { focus, plan } = await fromCurriculum(q, d)
      const ids: string[] = []
      for (let w = 0; w < d.repeat_weeks; w++) {
        const r = await q<{ id: string }>(
          `insert into sessions (organization_id, program_id, level_id, curriculum_item_id, coach_id, location_id,
                                 starts_at, ends_at, max_athletes, session_plan, focus, notes)
           values ($1,$2,$3,$4,$5,$6,
                   (($7::date + $13::int * 7) + $8::time) at time zone $14,
                   (($7::date + $13::int * 7) + $9::time) at time zone $14,
                   $10,$11,$12,$15) returning id`,
          [s.orgId, d.program_id, d.level_id ?? null, d.curriculum_item_id ?? null, d.coach_id ?? null,
           d.location_id ?? null, d.date, d.start, d.end, d.max_athletes, plan, focus, w, s.timezone, d.notes ?? null],
        )
        ids.push(r[0].id)
        if (d.auto_enroll && d.level_id) {
          await q(
            `insert into session_athletes (organization_id, session_id, athlete_id)
             select $1, $2, a.id from athletes a
              where a.current_level_id = $3 and a.status in ('active','trial')
              order by a.last_name, a.first_name limit $4`,
            [s.orgId, r[0].id, d.level_id, d.max_athletes],
          )
        }
      }
      return ids[0]
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the session.' }
  }
  revalidatePath('/schedule')
  await track(s, 'session_created', { repeat_weeks: d.repeat_weeks })
  redirect(`/schedule/${firstId}`)
}

export async function updateSession(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = parse(fd)
  if (!p.ok) return { error: p.error }
  const d = p.data
  try {
    await withUser(s.userId, async (q) => {
      await validateRefs(q, d)
      const r = await q(
        `update sessions set program_id=$2, level_id=$3, curriculum_item_id=$4, coach_id=$5, location_id=$6,
                starts_at = ($7::date + $8::time) at time zone $13, ends_at = ($7::date + $9::time) at time zone $13,
                max_athletes=$10, session_plan=$11, focus=$12, notes=$14
          where id = $1 returning id`,
        [id, d.program_id, d.level_id ?? null, d.curriculum_item_id ?? null, d.coach_id ?? null, d.location_id ?? null,
         d.date, d.start, d.end, d.max_athletes, d.session_plan ?? null, d.focus ?? null, s.timezone, d.notes ?? null],
      )
      if (!r.length) throw new Error('Session not found.')
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the session.' }
  }
  revalidatePath('/schedule')
  revalidatePath(`/schedule/${id}`)
  redirect(`/schedule/${id}`)
}

export async function deleteSession(id: string) {
  const s = await requireAdmin()
  await withUser(s.userId, (q) => q('delete from sessions where id = $1', [id]))
  revalidatePath('/schedule')
  redirect('/schedule')
}

// ---------------------------------------------------------------- roster

export async function enrollAthlete(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const athleteId = String(fd.get('athlete_id') ?? '')
  if (!z.uuid().safeParse(athleteId).success) return { error: 'Choose an athlete.' }
  const r = await withUser(s.userId, (q) =>
    q<{ ok: boolean }>(
      `with cap as (
         select se.max_athletes > (select count(*) from session_athletes where session_id = se.id) as ok
           from sessions se where se.id = $2)
       insert into session_athletes (organization_id, session_id, athlete_id)
       select $1, $2, $3 from cap where cap.ok
       on conflict do nothing returning true as ok`,
      [s.orgId, sessionId, athleteId],
    ),
  )
  if (!r.length) return { error: 'This session is full (or the athlete is already enrolled).' }
  revalidatePath(`/schedule/${sessionId}`)
  return { message: 'Enrolled' }
}

export async function unenrollAthlete(sessionId: string, athleteId: string) {
  const s = await requireAdmin()
  await withUser(s.userId, async (q) => {
    await q('delete from attendance where session_id = $1 and athlete_id = $2', [sessionId, athleteId])
    await q('delete from session_athletes where session_id = $1 and athlete_id = $2', [sessionId, athleteId])
  })
  revalidatePath(`/schedule/${sessionId}`)
}

// ---------------------------------------------------------------- attendance + notes (coaches too)

const ATTENDANCE = z.enum(['present', 'absent', 'late'])

function revalidateSession(id: string) {
  revalidatePath(`/schedule/${id}`)
  revalidatePath(`/coach/sessions/${id}`)
  revalidatePath('/coach/today')
}

/** Sets (or clears, when status is null) one athlete's attendance. Only roster athletes can be marked. */
export async function setAttendance(sessionId: string, athleteId: string, status: string | null) {
  const s = await requireStaff()
  if (status !== null && !ATTENDANCE.safeParse(status).success) return { error: 'Invalid status' }
  await withUser(s.userId, (q) =>
    status === null
      ? q('delete from attendance where session_id = $1 and athlete_id = $2', [sessionId, athleteId])
      : q(
          `insert into attendance (organization_id, session_id, athlete_id, status, marked_by)
           select sa.organization_id, sa.session_id, sa.athlete_id, $3, $4
             from session_athletes sa where sa.session_id = $1 and sa.athlete_id = $2
           on conflict (session_id, athlete_id)
           do update set status = excluded.status, marked_by = excluded.marked_by, marked_at = now()`,
          [sessionId, athleteId, status, s.userId],
        ),
  )
  revalidateSession(sessionId)
  await track(s, 'attendance_marked', { status })
  return { ok: true }
}

/** Marks every roster athlete who has no attendance yet as present. */
export async function markRestPresent(sessionId: string) {
  const s = await requireStaff()
  await withUser(s.userId, (q) =>
    q(
      `insert into attendance (organization_id, session_id, athlete_id, status, marked_by)
       select sa.organization_id, sa.session_id, sa.athlete_id, 'present', $2
         from session_athletes sa where sa.session_id = $1
       on conflict (session_id, athlete_id) do nothing`,
      [sessionId, s.userId],
    ),
  )
  revalidateSession(sessionId)
  await track(s, 'attendance_bulk')
}

const noteSchema = z.object({
  body: z.string().trim().min(1, 'Write a note first').max(4000),
  athlete_id: opt(z.uuid()),
  shareable: z.preprocess((v) => v === 'on', z.boolean()),
})

/** General session note (no athlete) or athlete-specific note tied to this session. */
export async function addSessionNote(sessionId: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff()
  const p = noteSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  const d = p.data
  const r = await withUser(s.userId, (q) =>
    q(
      `insert into coach_notes (organization_id, athlete_id, session_id, author_id, body, shareable)
       select se.organization_id, $2, se.id, $3, $4, $5 from sessions se
        where se.id = $1
          and ($2::uuid is null or exists (select 1 from session_athletes sa where sa.session_id = se.id and sa.athlete_id = $2))
       returning id`,
      [sessionId, d.athlete_id ?? null, s.userId, d.body, d.athlete_id ? d.shareable : false],
    ),
  )
  if (!r.length) return { error: 'Could not save the note.' }
  revalidateSession(sessionId)
  await track(s, 'note_added', { athlete: Boolean(d.athlete_id), shareable: d.shareable })
  if (d.athlete_id) {
    revalidatePath(`/athletes/${d.athlete_id}`)
    revalidatePath(`/coach/athletes/${d.athlete_id}`)
  }
  return { message: 'Note saved' }
}
