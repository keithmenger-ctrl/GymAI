'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { withUser, type Q } from '@/lib/db'
import type { FormState } from './auth'

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const opt = <T extends z.ZodType>(s: T) => z.preprocess(blank, s.optional())

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  date_of_birth: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth is invalid')),
  sport_id: opt(z.uuid()),
  position: opt(z.string().trim()),
  school_team: opt(z.string().trim()),
  status: z.enum(['active', 'trial', 'paused', 'inactive']),
  join_date: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Join date is invalid')),
  notes: opt(z.string().trim()),
  program_id: opt(z.uuid()),
  level_id: opt(z.uuid()),
  guardian_name: opt(z.string().trim()),
  guardian_email: opt(z.email('Parent email is invalid')),
  guardian_phone: opt(z.string().trim()),
})

function parse(fd: FormData) {
  const r = schema.safeParse(Object.fromEntries(fd))
  return r.success
    ? ({ ok: true, data: r.data } as const)
    : ({ ok: false, error: r.error.issues[0].message } as const)
}

type Input = z.infer<typeof schema>

async function assertLevelInProgram(q: Q, d: Input) {
  if (d.level_id && !d.program_id) throw new Error('Choose a program for that level.')
  if (d.level_id && d.program_id) {
    const ok = await q('select 1 from program_levels where id = $1 and program_id = $2', [d.level_id, d.program_id])
    if (!ok.length) throw new Error('That level does not belong to the chosen program.')
  }
}

/** Creates (or reuses, by email) the guardian and makes sure it's linked to the athlete. */
async function saveGuardian(q: Q, orgId: string, athleteId: string, d: Input) {
  if (!d.guardian_name) return
  const linked = await q<{ id: string }>(
    `select g.id from athlete_guardians ag join guardians g on g.id = ag.guardian_id
      where ag.athlete_id = $1 order by g.name limit 1`,
    [athleteId],
  )
  let guardianId = linked[0]?.id
  if (guardianId) {
    await q('update guardians set name = $2, email = $3, phone = $4 where id = $1', [
      guardianId, d.guardian_name, d.guardian_email ?? null, d.guardian_phone ?? null,
    ])
    return
  }
  if (d.guardian_email) {
    const existing = await q<{ id: string }>('select id from guardians where lower(email) = lower($1) limit 1', [d.guardian_email])
    guardianId = existing[0]?.id
  }
  if (!guardianId) {
    const g = await q<{ id: string }>(
      'insert into guardians (organization_id, name, email, phone) values ($1, $2, $3, $4) returning id',
      [orgId, d.guardian_name, d.guardian_email ?? null, d.guardian_phone ?? null],
    )
    guardianId = g[0].id
  }
  await q('insert into athlete_guardians (organization_id, athlete_id, guardian_id) values ($1, $2, $3) on conflict do nothing', [
    orgId, athleteId, guardianId,
  ])
}

export async function createAthlete(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = parse(fd)
  if (!p.ok) return { error: p.error }
  const d = p.data
  let id: string
  try {
    id = await withUser(s.userId, async (q) => {
      await assertLevelInProgram(q, d)
      const a = await q<{ id: string }>(
        `insert into athletes (organization_id, first_name, last_name, date_of_birth, sport_id, position, school_team,
                               status, join_date, notes, current_program_id, current_level_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9::date, current_date),$10,$11,$12) returning id`,
        [s.orgId, d.first_name, d.last_name, d.date_of_birth ?? null, d.sport_id ?? null, d.position ?? null,
         d.school_team ?? null, d.status, d.join_date ?? null, d.notes ?? null, d.program_id ?? null, d.level_id ?? null],
      )
      await q(
        `insert into athlete_progress_events (organization_id, athlete_id, kind, title)
         values ($1, $2, 'milestone', 'Joined ' || (select name from organizations where id = $1))`,
        [s.orgId, a[0].id],
      )
      await saveGuardian(q, s.orgId, a[0].id, d)
      await q('select sync_future_rosters($1)', [a[0].id])
      return a[0].id
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the athlete.' }
  }
  revalidatePath('/athletes')
  redirect(`/athletes/${id}`)
}

export async function updateAthlete(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = parse(fd)
  if (!p.ok) return { error: p.error }
  const d = p.data
  try {
    await withUser(s.userId, async (q) => {
      await assertLevelInProgram(q, d)
      const [before] = await q<{ level: string | null; status: string }>(
        'select current_level_id as level, status from athletes where id = $1', [id])
      const r = await q(
        `update athletes set first_name=$2, last_name=$3, date_of_birth=$4, sport_id=$5, position=$6, school_team=$7,
                status=$8, join_date=coalesce($9::date, join_date), notes=$10, current_program_id=$11, current_level_id=$12
          where id = $1 returning id`,
        [id, d.first_name, d.last_name, d.date_of_birth ?? null, d.sport_id ?? null, d.position ?? null,
         d.school_team ?? null, d.status, d.join_date ?? null, d.notes ?? null, d.program_id ?? null, d.level_id ?? null],
      )
      if (!r.length) throw new Error('Athlete not found.')
      await saveGuardian(q, s.orgId, id, d)
      if (before && (before.level !== (d.level_id ?? null) || before.status !== d.status)) {
        await q('select sync_future_rosters($1, $2)', [id, before.level])
      }
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the athlete.' }
  }
  revalidatePath('/athletes')
  revalidatePath(`/athletes/${id}`)
  redirect(`/athletes/${id}`)
}
