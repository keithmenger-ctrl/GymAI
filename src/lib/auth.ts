import { cache } from 'react'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { withUser } from '@/lib/db'

export type Role = 'owner' | 'admin' | 'coach' | 'parent'

export type Session = {
  userId: string
  email: string
  fullName: string
  orgId: string
  orgName: string
  timezone: string
  role: Role
  canViewFinance: boolean
}

/** Where each role lands after login. */
export const homeFor = (role: Role) =>
  role === 'coach' ? '/coach/today' : role === 'parent' ? '/parent' : '/dashboard'

/**
 * The signed-in user, verified with the auth server (not just decoded from the cookie),
 * plus their role/org read from the database under RLS. Returns null when signed out or
 * when the user has no organization yet.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return null
  const rows = await withUser(user.id, (q) =>
    q<{ organization_id: string; org_name: string; timezone: string; role: Role; can_view_finance: boolean; full_name: string | null }>(
      `select r.organization_id, o.name as org_name, o.timezone, r.role, r.can_view_finance, p.full_name
         from user_roles r
         join organizations o on o.id = r.organization_id
         left join profiles p on p.id = r.user_id
        where r.user_id = $1`,
      [user.id],
    ),
  )
  const r = rows[0]
  if (!r) return null
  return {
    userId: user.id,
    email: user.email ?? '',
    fullName: r.full_name || user.email || '',
    orgId: r.organization_id,
    orgName: r.org_name,
    timezone: r.timezone,
    role: r.role,
    canViewFinance: r.can_view_finance || r.role === 'owner' || r.role === 'admin',
  }
})

/** For pages/actions: must be signed in with a role in `roles`, else redirect. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!roles.includes(s.role)) redirect(homeFor(s.role))
  return s
}

export const requireAdmin = () => requireRole('owner', 'admin')
export const requireStaff = () => requireRole('owner', 'admin', 'coach')
