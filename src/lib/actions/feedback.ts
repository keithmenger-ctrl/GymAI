'use server'

import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { withUser } from '@/lib/db'
import type { FormState } from './auth'

const schema = z.object({ body: z.string().trim().min(1, 'Write a few words first').max(4000), page: z.string().max(300).default('') })

export async function submitFeedback(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession()
  if (!s) return { error: 'Please sign in again.' }
  const p = schema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  await withUser(s.userId, (q) =>
    q('insert into feedback (organization_id, user_id, role, page, body) values ($1, $2, $3, $4, $5)',
      [s.orgId, s.userId, s.role, p.data.page, p.data.body]))
  return { message: 'Thanks! Your feedback was sent.' }
}
