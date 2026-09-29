'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { withUser } from '@/lib/db'
import type { FormState } from './auth'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.preprocess((v) => (v === '' ? undefined : v), z.email('Email is invalid').optional()),
  bio: z.string().trim().optional(),
})

export async function createCoach(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = schema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  await withUser(s.userId, (q) =>
    q('insert into coaches (organization_id, name, email, bio) values ($1,$2,$3,$4)', [
      s.orgId, p.data.name, p.data.email ?? null, p.data.bio || null,
    ]),
  )
  revalidatePath('/coaches')
  return { message: `${p.data.name} added. Use "Give app access" to send them a sign-in link.` }
}

export async function setCoachActive(id: string, active: boolean) {
  const s = await requireAdmin()
  await withUser(s.userId, (q) => q('update coaches set active = $2 where id = $1', [id, active]))
  revalidatePath('/coaches')
}
