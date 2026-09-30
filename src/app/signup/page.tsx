import Link from 'next/link'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { signup } from '@/lib/actions/auth'

export const metadata = { title: 'Create your academy' }

export default function SignupPage() {
  return (
    <AuthCard title="Create your academy" subtitle="You'll be the owner. Add coaches and athletes next.">
      <AuthForm
        action={signup}
        submit="Create academy"
        fields={[
          { name: 'orgName', label: 'Facility name', placeholder: 'Vegas Elite Performance' },
          { name: 'fullName', label: 'Your name', autoComplete: 'name' },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
          {
            name: 'demo', type: 'checkbox', defaultChecked: true, label: 'Start with demo data',
            hint: '30 athletes, 3 coaches, programs, curriculum and 8 weeks of history, so you can explore every view. Leave unchecked to start empty with your own data.',
          },
        ]}
      />
      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </AuthCard>
  )
}
