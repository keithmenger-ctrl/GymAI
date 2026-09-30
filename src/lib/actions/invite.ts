'use server'

import { requireAdmin } from '@/lib/auth'
import { withServiceRole, withUser } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { passwordLink } from '@/lib/links'
import { emailHtml, mailEnabled, sendMail } from '@/lib/mail'

export type InviteResult = { link?: string; error?: string; emailedTo?: string; emailError?: string }

type Invitee = { id: string; name: string; email: string | null; profile_id: string | null }

/**
 * Creates an auth user for a guardian/coach record (if it has none), assigns the role in this org,
 * links the record, and returns a one-time set-password link. Idempotent: an already-linked
 * person just gets a fresh link. The link is always shown to the owner; when SMTP is configured the
 * same link is also emailed.
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
    // One link for both: generating a second recovery link would invalidate the first.
    const url = await passwordLink(person.email, mailEnabled())
    const result: InviteResult = { link: url }
    if (mailEnabled()) {
      try {
        const [org] = await withUser(s.userId, (q) => q<{ name: string }>('select name from organizations where id = $1', [s.orgId]))
        const who = role === 'coach' ? 'the coach app' : 'the parent portal'
        await sendMail(person.email, `You're invited to ${org.name} on AcademyOS`,
          `${org.name} invited you to ${who}. Set your password here (the link works once): ${url}`,
          emailHtml(`You're invited to ${org.name}`, `${org.name} invited you to ${who} on AcademyOS. Set a password to get started.`, 'Set your password', url))
        result.emailedTo = person.email
      } catch (e) {
        result.emailError = e instanceof Error ? e.message : 'Email could not be sent.'
      }
    }
    return result
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
