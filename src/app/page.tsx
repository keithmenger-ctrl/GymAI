import { redirect } from 'next/navigation'
import { getSession, homeFor } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'

export default async function Root() {
  const s = await getSession()
  if (s) redirect(homeFor(s.role))
  const { data } = await (await supabaseServer()).auth.getUser()
  redirect(data.user ? '/onboarding' : '/login')
}
