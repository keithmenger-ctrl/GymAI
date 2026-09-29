'use server'

import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/auth'
import { withServiceRole, withUser } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type InviteResult = { link?: string; error?: string }

async function origin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** One-time link that signs the invitee in and sends them to set a password. */
async function passwordLink(email: string) {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? 'Could not create link')
  return `${await origin()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/set-password`
}

/**
 * Gives a guardian (parent) a login. Idempotent: if they already have one, just issues a fresh link.
 * The link is shown to the owner to share; wiring transactional email is not part of the MVP.
 */
export async function inviteParent(guardianId: string): Promise<InviteResult> {
  const s = await requireAdmin()
  const g = await withUser(s.userId, (q) =>
    q<{ id: string; name: string; email: string | null; profile_id: string | null }>(
      'select id, name, email, profile_id from guardians where id = $1',
      [guardianId],
    ),
  )
  const guardian = g[0]
  if (!guardian) return { error: 'Parent not found.' }
  if (!guardian.email) return { error: 'Add a parent email to the athlete first.' }
  try {
    if (!guardian.profile_id) {
      const { data, error } = await supabaseAdmin().auth.admin.createUser({
        email: guardian.email,
        email_confirm: true,
        user_metadata: { full_name: guardian.name },
      })
      if (error || !data.user) {
        return { error: /already|registered|exists/i.test(error?.message ?? '') ? 'That email already has an AcademyOS account.' : (error?.message ?? 'Could not create the login.') }
      }
      const uid = data.user.id
      await withServiceRole(async (q) => {
        await q('insert into profiles (id, full_name, email) values ($1, $2, $3) on conflict (id) do nothing', [uid, guardian.name, guardian.email])
        await q(`insert into user_roles (user_id, organization_id, role) values ($1, $2, 'parent')`, [uid, s.orgId])
        await q('update guardians set profile_id = $1 where id = $2 and organization_id = $3', [uid, guardian.id, s.orgId])
      })
    }
    return { link: await passwordLink(guardian.email) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the invite.' }
  }
}
