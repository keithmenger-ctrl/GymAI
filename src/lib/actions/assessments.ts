'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireStaff } from '@/lib/auth'
import { withUser } from '@/lib/db'
import type { FormState } from './auth'
import { track } from '@/lib/track'

const typeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  unit: z.string().trim().min(1, 'Unit is required'),
  direction: z.enum(['lower', 'higher']),
  category: z.string().trim().min(1).default('General'),
  reassess_days: z.coerce.number().int().min(7, 'Reassess every 7+ days').max(365),
})

export async function saveAssessmentType(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = typeSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  const d = p.data
  const r = await withUser(s.userId, (q) =>
    id
      ? q('update assessment_types set name=$2, unit=$3, direction=$4, category=$5, reassess_days=$6 where id=$1 returning id',
          [id, d.name, d.unit, d.direction, d.category, d.reassess_days])
      : q('insert into assessment_types (organization_id, name, unit, direction, category, reassess_days) values ($1,$2,$3,$4,$5,$6) returning id',
          [s.orgId, d.name, d.unit, d.direction, d.category, d.reassess_days]),
  )
  if (!r.length) return { error: 'Metric not found.' }
  revalidatePath('/assessments')
  return { message: id ? 'Saved' : `${d.name} added` }
}

/** Only metrics without any results can be deleted (history is never destroyed from the UI). */
export async function deleteAssessmentType(id: string) {
  const s = await requireAdmin()
  await withUser(s.userId, (q) =>
    q('delete from assessment_types t where t.id = $1 and not exists (select 1 from assessment_results r where r.type_id = t.id)', [id]),
  )
  revalidatePath('/assessments')
}

export type RecordState = { error?: string; saved?: number } | undefined

/**
 * Saves a batch of results for one metric. Form fields: type_id, recorded_on, and `v:<athleteId>` = value.
 * Blank values are skipped. Timeline events are written by the DB trigger.
 */
export async function recordResults(_: RecordState, fd: FormData): Promise<RecordState> {
  const s = await requireStaff()
  const typeId = z.uuid().safeParse(fd.get('type_id'))
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(fd.get('recorded_on'))
  if (!typeId.success) return { error: 'Choose a metric.' }
  if (!date.success) return { error: 'Choose a date.' }
  const entries: [string, number][] = []
  for (const [k, raw] of fd.entries()) {
    if (!k.startsWith('v:') || String(raw).trim() === '') continue
    const athleteId = k.slice(2)
    const value = Number(String(raw).replace(',', '.'))
    if (!z.uuid().safeParse(athleteId).success) continue
    if (!Number.isFinite(value) || value < 0 || value > 100000) return { error: `"${raw}" is not a valid number.` }
    entries.push([athleteId, value])
  }
  if (entries.length === 0) return { error: 'Enter at least one result.' }
  const inserted = await withUser(s.userId, (q) =>
    q(
      `insert into assessment_results (organization_id, athlete_id, type_id, value, recorded_on, recorded_by)
       select a.organization_id, a.id, $1, x.value, $2, $3
         from unnest($4::uuid[], $5::numeric[]) as x(athlete_id, value)
         join athletes a on a.id = x.athlete_id
         join assessment_types t on t.id = $1
       returning id`,
      [typeId.data, date.data, s.userId, entries.map((e) => e[0]), entries.map((e) => e[1])],
    ),
  )
  await track(s, 'assessments_recorded', { count: inserted.length })
  revalidatePath('/assessments')
  revalidatePath('/coach/assessments')
  for (const [id] of entries) {
    revalidatePath(`/athletes/${id}`)
    revalidatePath(`/coach/athletes/${id}`)
  }
  return { saved: inserted.length }
}
