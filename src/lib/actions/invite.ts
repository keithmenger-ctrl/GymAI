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

type Invitee = { id: string; name: string; email: string | null; profile_id: string | null }

/**
 * Creates an auth user for a guardian/coach record (if it has none), assigns the role in this org,
 * links the record, and returns a one-time set-password link. Idempotent: an already-linked
 * person just gets a fresh link. Email delivery is not part of the MVP; the owner shares the link.
 */
async function invite(table: 'guardians' | 'coaches', role: 'parent' | 'coach', id: string): Promise<InviteResult> {
  const s = await requireAdmin()
  const rows = await withUser(s.userId, (q) =>
    q<Invitee>(`select id, name, email, profile_id from ${table} where id = $1`, [id]),
  )
  const person = rows[0]
  if (!person) return { error: 'Not found.' }
  if (!person.email) return { error: 'Add an email address first.' }
  try {
    if (!person.profile_id) {
      const { data, error } = await supabaseAdmin().auth.admin.createUser({
        email: person.email,
        email_confirm: true,
        user_metadata: { full_name: person.name },
      })
      if (error || !data.user) {
        return { error: /already|registered|exists/i.test(error?.message ?? '') ? 'That email already has an AcademyOS account.' : (error?.message ?? 'Could not create the login.') }
      }
      const uid = data.user.id
      await withServiceRole(async (q) => {
        await q('insert into profiles (id, full_name, email) values ($1, $2, $3) on conflict (id) do nothing', [uid, person.name, person.email])
        await q('insert into user_roles (user_id, organization_id, role) values ($1, $2, $3)', [uid, s.orgId, role])
        await q(`update ${table} set profile_id = $1 where id = $2 and organization_id = $3`, [uid, person.id, s.orgId])
      })
    }
    return { link: await passwordLink(person.email) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the invite.' }
  }
}

export async function inviteParent(guardianId: string) {
  return invite('guardians', 'parent', guardianId)
}

export async function inviteCoach(coachId: string) {
  return invite('coaches', 'coach', coachId)
}
