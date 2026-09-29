'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { withUser } from '@/lib/db'
import type { FormState } from './auth'

const TIMEZONES = Intl.supportedValuesOf('timeZone')

const orgSchema = z.object({
  name: z.string().trim().min(1, 'Facility name is required').max(120),
  timezone: z.string().refine((t) => TIMEZONES.includes(t), 'Unknown timezone'),
})

/** Owner only (RLS also restricts organization updates to the owner). */
export async function updateOrganization(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireRole('owner')
  const p = orgSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  await withUser(s.userId, (q) => q('update organizations set name = $2, timezone = $3 where id = $1', [s.orgId, p.data.name, p.data.timezone]))
  revalidatePath('/', 'layout')
  return { message: 'Saved' }
}

const locSchema = z.object({ name: z.string().trim().min(1, 'Location name is required'), address: z.string().trim().optional() })

export async function addLocation(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireRole('owner', 'admin')
  const p = locSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  await withUser(s.userId, (q) => q('insert into locations (organization_id, name, address) values ($1,$2,$3)', [s.orgId, p.data.name, p.data.address || null]))
  revalidatePath('/settings')
  return { message: 'Location added' }
}
