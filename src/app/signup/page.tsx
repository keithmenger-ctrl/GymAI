import Link from 'next/link'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { signup } from '@/lib/actions/auth'
import { flags } from '@/lib/flags'

export const metadata = { title: 'Create your academy' }
export const dynamic = 'force-dynamic' // flags are read at request time

export default function SignupPage() {
  return (
    <AuthCard title="Create your academy" subtitle="You'll be the owner. Add coaches and athletes next.">
      <AuthForm
        action={signup}
        submit="Create academy"
        fields={[
          { name: 'orgName', label: 'Facility name', placeholder: 'Your facility' },
          { name: 'fullName', label: 'Your name', autoComplete: 'name' },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
          ...(flags.demo() ? [{
            name: 'demo', type: 'checkbox', label: 'Start with demo data',
            hint: '30 athletes, 3 coaches, programs, curriculum and 8 weeks of history, so you can explore every view. Leave unchecked to start empty with your own data.',
          }] : []),
        ]}
      />
      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">Sign in</Link>
      </p>
    </AuthCard>
  )
}
