import 'server-only'
import { randomBytes } from 'node:crypto'
import { withServiceRole } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase/admin'

// NOT a server action: this runs with the service role for an org id it is given, so it must only be
// reachable from trusted server code (signup, right after create_organization made the caller the owner).
const COACHES = ['keith', 'mike', 'sarah']

/**
 * Fills a freshly created organization with demo data and demo coach/parent logins.
 * Server-only; called from signup right after create_organization() made the caller its owner.
 * Demo users get random passwords nobody knows: they are only reachable through switchDemoView.
 */
export async function provisionDemo(orgId: string) {
  const admin = supabaseAdmin()
  const tag = orgId.slice(0, 8)
  const make = async (slug: string, name: string) => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `demo-${tag}-${slug}@academyos.demo`,
      password: randomBytes(24).toString('base64url'),
      email_confirm: true,
      user_metadata: { full_name: name, demo: true },
    })
    if (error || !data.user) throw new Error(error?.message ?? 'Could not create demo user')
    return data.user.id
  }
  const coaches: string[] = []
  for (const c of COACHES) coaches.push(await make(`coach-${c}`, `Coach ${c[0].toUpperCase()}${c.slice(1)}`))
  const parents: string[] = []
  for (let i = 1; i <= 6; i++) parents.push(await make(`parent${i}`, `Parent ${i}`))
  await withServiceRole(async (q) => {
    await q('update organizations set is_demo = true where id = $1', [orgId])
    await q('select seed_demo_org($1, $2::uuid[], $3::uuid[])', [orgId, coaches, parents])
  })
}

