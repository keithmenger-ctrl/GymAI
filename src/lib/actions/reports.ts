'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireStaff } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { buildSnapshot, draftSections } from '@/lib/queries/reports'
import type { FormState } from './auth'
import { track } from '@/lib/track'

const editorPath = (role: string, id: string) => (role === 'coach' ? `/coach/reports/${id}` : `/reports/${id}`)

function refresh(athleteId: string, id: string) {
  revalidatePath('/reports')
  revalidatePath(`/reports/${id}`)
  revalidatePath(`/coach/reports/${id}`)
  revalidatePath(`/athletes/${athleteId}`)
  revalidatePath(`/parent/reports/${id}`)
  revalidatePath('/parent')
}

/** Snapshot the athlete's data + deterministic draft text, save as a draft, open the editor. */
export async function generateReport(athleteId: string) {
  const s = await requireStaff()
  const snap = await buildSnapshot(s, athleteId)
  if (!snap) redirect('/')
  const sections = draftSections(snap)
  const month = new Date(`${snap.generated_on}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const [r] = await withUser(s.userId, (q) =>
    q<{ id: string }>(
      `insert into progress_reports (organization_id, athlete_id, title, sections, snapshot, status, created_by)
       values ($1, $2, $3, $4, $5, 'draft', $6) returning id`,
      [s.orgId, athleteId, `${snap.first_name}'s progress report · ${month}`, sections, snap, s.userId],
    ),
  )
  refresh(athleteId, r.id)
  await track(s, 'report_generated')
  redirect(editorPath(s.role, r.id))
}

const editSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  summary: z.string().trim().min(1, 'Write a coach summary').max(5000),
  next_focus: z.string().trim().max(2000).default(''),
})

export async function saveReport(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireStaff()
  const p = editSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  const r = await withUser(s.userId, (q) =>
    q<{ athlete_id: string }>(
      `update progress_reports set title = $2, sections = jsonb_build_object('summary', $3::text, 'next_focus', $4::text)
        where id = $1 returning athlete_id`,
      [id, p.data.title, p.data.summary, p.data.next_focus],
    ),
  )
  if (!r.length) return { error: 'Report not found.' }
  refresh(r[0].athlete_id, id)
  return { message: 'Saved' }
}

export async function setReportShared(id: string, shared: boolean) {
  const s = await requireStaff()
  const r = await withUser(s.userId, (q) =>
    q<{ athlete_id: string }>(
      `update progress_reports set status = $2, shared_at = case when $2 = 'shared' then now() else null end
        where id = $1 returning athlete_id`,
      [id, shared ? 'shared' : 'draft'],
    ),
  )
  if (r.length) {
    refresh(r[0].athlete_id, id)
    if (shared) await track(s, 'report_shared')
  }
}

export async function deleteReport(id: string) {
  const s = await requireStaff()
  await withUser(s.userId, (q) => q(`delete from progress_reports where id = $1 and status = 'draft'`, [id]))
  revalidatePath('/reports')
  redirect(s.role === 'coach' ? '/coach/today' : '/reports')
}
