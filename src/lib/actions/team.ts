'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireRole } from '@/lib/auth'
import { withServiceRole, withUser } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { passwordLink } from '@/lib/links'
import { emailHtml, orgMayEmail, sendMail } from '@/lib/mail'
import { track } from '@/lib/track'

export type TeamState = { error?: string; message?: string; link?: string } | undefined

const adminSchema = z.object({ name: z.string().trim().min(1, 'Name is required'), email: z.email('Email is invalid') })

/** Owner only: creates a login for a new admin in this organization and returns (and emails) a set-password link. */
export async function addAdmin(_: TeamState, fd: FormData): Promise<TeamState> {
  const s = await requireRole('owner')
  const p = adminSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  const email = p.data.email.toLowerCase()
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email, email_confirm: true, user_metadata: { full_name: p.data.name },
  })
  if (error || !data.user) {
    return { error: /already|registered|exists/i.test(error?.message ?? '') ? 'That email already has an AcademyOS account.' : (error?.message ?? 'Could not create the login.') }
  }
  const uid = data.user.id
  await withServiceRole(async (q) => {
    await q('insert into profiles (id, full_name, email) values ($1, $2, $3) on conflict (id) do nothing', [uid, p.data.name, email])
    await q(`insert into user_roles (user_id, organization_id, role, can_view_finance) values ($1, $2, 'admin', true)`, [uid, s.orgId])
  })
  const willEmail = await orgMayEmail(s.orgId, s.isDemo)
  const link = await passwordLink(email, willEmail)
  let message = `${p.data.name} was added as an admin. Share this one-time link so they can set a password.`
  if (willEmail) {
    try {
      await sendMail(email, `You're now an admin of ${s.orgName} on AcademyOS`,
        `${s.fullName} added you as an admin of ${s.orgName}. Set your password (the link works once): ${link}`,
        emailHtml(`You're an admin of ${s.orgName}`, `${s.fullName} added you as an admin on AcademyOS. Set a password to get started.`, 'Set your password', link))
      message = `${p.data.name} was added as an admin and emailed a sign-in link.`
      await track(s, 'email_sent', { kind: 'invite_admin' })
    } catch {
      message += ' (Email failed.)'
    }
  }
  revalidatePath('/settings')
  return { message, link }
}

/** Owner only: removes an admin's access to this organization (their login remains, with no academy). */
export async function removeAdmin(userId: string) {
  const s = await requireRole('owner')
  if (!z.uuid().safeParse(userId).success || userId === s.userId) return
  await withServiceRole((q) =>
    q(`delete from user_roles where user_id = $1 and organization_id = $2 and role = 'admin'`, [userId, s.orgId]))
  revalidatePath('/settings')
}

/** Owners/admins: let a coach see membership/billing status (read-only). Enforced by RLS via can_see_finance(). */
export async function setCoachFinance(coachId: string, allow: boolean) {
  const s = await requireAdmin()
  if (!z.uuid().safeParse(coachId).success) return
  // Resolve the coach under RLS first (proves it belongs to this org), then update the role with the service role.
  const [c] = await withUser(s.userId, (q) => q<{ profile_id: string | null }>('select profile_id from coaches where id = $1', [coachId]))
  if (!c?.profile_id) return
  await withServiceRole((q) =>
    q(`update user_roles set can_view_finance = $1 where user_id = $2 and organization_id = $3 and role = 'coach'`,
      [allow, c.profile_id, s.orgId]))
  revalidatePath('/coaches')
}
