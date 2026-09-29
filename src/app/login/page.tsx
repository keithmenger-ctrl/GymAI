import Link from 'next/link'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { DemoLogins } from '@/components/demo-logins'
import { login } from '@/lib/actions/auth'

export const metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <AuthCard title="Sign in" subtitle="Run your academy from one place.">
      <AuthForm
        action={login}
        submit="Sign in"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
        ]}
      />
      <p className="mt-6 text-sm text-muted">
        New facility?{' '}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">Create your academy</Link>
      </p>
      <DemoLogins />
    </AuthCard>
  )
}
