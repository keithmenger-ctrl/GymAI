'use server'

import { redirect } from 'next/navigation'
import { getSession, homeFor, type Role } from '@/lib/auth'
import { withServiceRole } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Demo academies only: sign in as the org's demo owner / coach / parent so every view is real
 * (same routes, same RLS). Refused for non-demo organizations.
 */
export async function switchDemoView(role: Extract<Role, 'owner' | 'coach' | 'parent'>) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!s.isDemo || !['owner', 'coach', 'parent'].includes(role)) redirect(homeFor(s.role))
  const [target] = await withServiceRole((q) =>
    q<{ email: string }>(
      `select u.email from user_roles r join auth.users u on u.id = r.user_id
        where r.organization_id = $1 and r.role = $2
        order by u.email limit 1`,
      [s.orgId, role],
    ),
  )
  if (!target) redirect(homeFor(s.role))
  if (target.email !== s.email) {
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: 'magiclink', email: target.email })
    if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? 'Could not switch view')
    const supabase = await supabaseServer()
    const v = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token })
    if (v.error) throw new Error(v.error.message)
  }
  redirect(homeFor(role))
}
