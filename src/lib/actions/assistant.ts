'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { QUERIES, route, runQuery, type AssistantResult, type QueryId } from '@/lib/ai/queries'
import { buildSnapshot } from '@/lib/queries/reports'

export type AskState = { question?: string; result?: AssistantResult } | undefined

export async function ask(_: AskState, fd: FormData): Promise<AskState> {
  const s = await requireAdmin()
  const question = String(fd.get('question') ?? '').trim().slice(0, 300)
  const preset = String(fd.get('query') ?? '') as QueryId
  const athleteId = String(fd.get('athlete_id') ?? '') || undefined
  if (QUERIES.some((q) => q.id === preset)) {
    return { question: QUERIES.find((q) => q.id === preset)!.label, result: await runQuery(s, preset, athleteId) }
  }
  if (!question) return undefined
  const r = await route(s, question)
  if (!r.id) {
    return { question, result: { kind: 'help', title: "I can't answer that yet", text: 'The assistant answers a fixed set of questions for now: inactive athletes, reassessments, program capacity, progress report drafts and 60-day summaries. Try one of the suggestions.' } }
  }
  const needs = QUERIES.find((q) => q.id === r.id)?.needsAthlete
  if (needs && !r.athlete) {
    return { question, result: { kind: 'help', title: 'Which athlete?',
      text: r.ambiguous.length ? `More than one athlete matches: ${r.ambiguous.map((a) => `${a.first_name} ${a.last_name}`).join(', ')}. Use the full name.` : 'Include the athlete’s name, e.g. “Draft a progress report for Johnny”.' } }
  }
  return { question, result: await runQuery(s, r.id, r.athlete?.id) }
}

const saveSchema = z.object({ athlete_id: z.uuid(), summary: z.string().trim().min(1).max(5000), next_focus: z.string().trim().max(2000) })

/** The explicit, human-confirmed step: saves the (edited) draft as a *draft* report. Nothing is shared. */
export async function saveDraftReport(fd: FormData) {
  const s = await requireAdmin()
  const p = saveSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return
  const snap = await buildSnapshot(s, p.data.athlete_id)
  if (!snap) return
  const month = new Date(`${snap.generated_on}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const [r] = await withUser(s.userId, (q) =>
    q<{ id: string }>(
      `insert into progress_reports (organization_id, athlete_id, title, sections, snapshot, status, created_by)
       values ($1, $2, $3, jsonb_build_object('summary', $4::text, 'next_focus', $5::text), $6, 'draft', $7) returning id`,
      [s.orgId, p.data.athlete_id, `${snap.first_name}'s progress report · ${month}`, p.data.summary, p.data.next_focus, snap, s.userId],
    ))
  revalidatePath('/reports')
  redirect(`/reports/${r.id}`)
}
