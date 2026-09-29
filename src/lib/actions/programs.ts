'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { withUser } from '@/lib/db'
import type { FormState } from './auth'

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const opt = <T extends z.ZodType>(s: T) => z.preprocess(blank, s.optional())
const first = (e: z.ZodError) => e.issues[0].message

const programSchema = z.object({
  name: z.string().trim().min(1, 'Program name is required'),
  description: opt(z.string().trim()),
  sport_id: opt(z.uuid()),
})

export async function createProgram(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = programSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: first(p.error) }
  const id = await withUser(s.userId, async (q) => {
    const r = await q<{ id: string }>(
      'insert into programs (organization_id, name, description, sport_id) values ($1,$2,$3,$4) returning id',
      [s.orgId, p.data.name, p.data.description ?? null, p.data.sport_id ?? null],
    )
    // every program starts with a Level 1 so it is immediately usable
    await q(`insert into program_levels (organization_id, program_id, name, sort_order) values ($1,$2,'Level 1',1)`, [s.orgId, r[0].id])
    return r[0].id
  })
  revalidatePath('/programs')
  redirect(`/programs/${id}`)
}

export async function updateProgram(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = programSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: first(p.error) }
  const r = await withUser(s.userId, (q) =>
    q('update programs set name=$2, description=$3, sport_id=$4 where id=$1 returning id',
      [id, p.data.name, p.data.description ?? null, p.data.sport_id ?? null]),
  )
  if (!r.length) return { error: 'Program not found.' }
  revalidatePath('/programs')
  revalidatePath(`/programs/${id}`)
  return { message: 'Saved' }
}

export async function setProgramActive(id: string, active: boolean) {
  const s = await requireAdmin()
  await withUser(s.userId, (q) => q('update programs set active=$2 where id=$1', [id, active]))
  revalidatePath('/programs')
  revalidatePath(`/programs/${id}`)
}

// ---------------------------------------------------------------- levels
const levelSchema = z.object({
  name: z.string().trim().min(1, 'Level name is required'),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(500),
})

export async function createLevel(programId: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = levelSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: first(p.error) }
  const r = await withUser(s.userId, (q) =>
    q(`insert into program_levels (organization_id, program_id, name, sort_order, capacity)
       select $1, $2, $3, coalesce(max(sort_order), 0) + 1, $4 from program_levels where program_id = $2
       returning id`, [s.orgId, programId, p.data.name, p.data.capacity]),
  )
  if (!r.length) return { error: 'Program not found.' }
  revalidatePath(`/programs/${programId}`)
  return { message: 'Level added' }
}

export async function updateLevel(programId: string, levelId: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = levelSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: first(p.error) }
  const r = await withUser(s.userId, (q) =>
    q('update program_levels set name=$3, capacity=$4 where id=$1 and program_id=$2 returning id',
      [levelId, programId, p.data.name, p.data.capacity]),
  )
  if (!r.length) return { error: 'Level not found.' }
  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/levels/${levelId}`)
  return { message: 'Saved' }
}

export async function deleteLevel(programId: string, levelId: string) {
  const s = await requireAdmin()
  // Refuses (no-op) while athletes are still in the level; the UI disables the button in that case too.
  const deleted = await withUser(s.userId, (q) =>
    q(`delete from program_levels l where l.id = $1 and l.program_id = $2
         and not exists (select 1 from athletes a where a.current_level_id = l.id) returning id`, [levelId, programId]),
  )
  revalidatePath(`/programs/${programId}`)
  if (deleted.length) redirect(`/programs/${programId}`)
}

// ---------------------------------------------------------------- curriculum
const itemSchema = z.object({
  week_number: z.coerce.number().int().min(1).max(52),
  title: z.string().trim().min(1, 'Title is required'),
  description: opt(z.string().trim()),
  objectives: opt(z.string().trim()),
  drills: z.string().default(''),
  cues: opt(z.string().trim()),
  notes: opt(z.string().trim()),
  video_url: opt(z.url('Video link must be a valid URL')),
})

const drillList = (s: string) => s.split('\n').map((x) => x.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').trim()).filter(Boolean)

export async function saveCurriculumItem(
  programId: string, levelId: string, itemId: string | null, _: FormState, fd: FormData,
): Promise<FormState> {
  const s = await requireAdmin()
  const p = itemSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: first(p.error) }
  const d = p.data
  const args = [d.week_number, d.title, d.description ?? null, d.objectives ?? null,
    JSON.stringify(drillList(d.drills)), d.cues ?? null, d.notes ?? null, d.video_url ?? null]
  const r = await withUser(s.userId, (q) =>
    itemId
      ? q(`update curriculum_items set week_number=$2, title=$3, description=$4, objectives=$5, drills=$6::jsonb,
                  cues=$7, notes=$8, video_url=$9 where id=$1 and level_id=$10 returning id`, [itemId, ...args, levelId])
      : q(`insert into curriculum_items (organization_id, level_id, week_number, title, description, objectives, drills, cues, notes, video_url)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10) returning id`, [s.orgId, levelId, ...args]),
  )
  if (!r.length) return { error: 'Could not save this curriculum item.' }
  revalidatePath(`/programs/${programId}/levels/${levelId}`)
  revalidatePath(`/programs/${programId}`)
  return { message: itemId ? 'Saved' : 'Week added' }
}

export async function deleteCurriculumItem(programId: string, levelId: string, itemId: string) {
  const s = await requireAdmin()
  await withUser(s.userId, (q) => q('delete from curriculum_items where id=$1 and level_id=$2', [itemId, levelId]))
  revalidatePath(`/programs/${programId}/levels/${levelId}`)
  revalidatePath(`/programs/${programId}`)
}
