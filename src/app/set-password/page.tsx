import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { setPassword } from '@/lib/actions/auth'
import { supabaseServer } from '@/lib/supabase/server'

export const metadata = { title: 'Set your password' }

export default async function SetPasswordPage() {
  const { data } = await (await supabaseServer()).auth.getUser()
  if (!data.user) redirect('/login')
  return (
    <AuthCard title="Set your password" subtitle="Choose a password to finish setting up your account.">
      <AuthForm
        action={setPassword}
        submit="Save password"
        fields={[{ name: 'password', label: 'New password', type: 'password', autoComplete: 'new-password' }]}
      />
    </AuthCard>
  )
}
