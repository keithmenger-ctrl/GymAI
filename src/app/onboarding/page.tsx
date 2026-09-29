import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { createOrganization } from '@/lib/actions/auth'
import { getSession, homeFor } from '@/lib/auth'

export const metadata = { title: 'Set up your academy' }

export default async function Onboarding() {
  const s = await getSession()
  if (s) redirect(homeFor(s.role))
  return (
    <AuthCard title="Set up your academy" subtitle="One last step before you're in.">
      <AuthForm
        action={createOrganization}
        submit="Create academy"
        fields={[
          { name: 'orgName', label: 'Facility name' },
          { name: 'fullName', label: 'Your name', autoComplete: 'name' },
        ]}
      />
    </AuthCard>
  )
}
