'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireStaff } from '@/lib/auth'
import { withUser } from '@/lib/db'
import type { FormState } from './auth'

const refresh = (athleteId: string) => {
  revalidatePath(`/athletes/${athleteId}`)
  revalidatePath(`/coach/athletes/${athleteId}`)
  revalidatePath(`/parent/progress/${athleteId}`)
}

/** Moves an athlete to another level of their current program. The DB trigger records the level change. */
export async function changeLevel(athleteId: string, levelId: string) {
  const s = await requireAdmin()
  await withUser(s.userId, async (q) => {
    const [before] = await q<{ level: string | null }>('select current_level_id as level from athletes where id = $1', [athleteId])
    const moved = await q(
      `update athletes a set current_level_id = l.id
         from program_levels l
        where a.id = $1 and l.id = $2 and l.program_id = a.current_program_id
        returning a.id`,
      [athleteId, levelId],
    )
    if (moved.length) await q('select sync_future_rosters($1, $2)', [athleteId, before?.level ?? null])
  })
  refresh(athleteId)
  revalidatePath('/athletes')
}

const milestone = z.object({ title: z.string().trim().min(1, 'Describe the milestone').max(200) })

export async function addMilestone(athleteId: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff()
  const p = milestone.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  const r = await withUser(s.userId, (q) =>
    q(
      `insert into athlete_progress_events (organization_id, athlete_id, kind, title, payload)
       select a.organization_id, a.id, 'milestone', $2, jsonb_build_object('by', $3::text) from athletes a where a.id = $1
       returning id`,
      [athleteId, p.data.title, s.userId],
    ),
  )
  if (!r.length) return { error: 'Athlete not found.' }
  refresh(athleteId)
  return { message: 'Milestone added' }
}
