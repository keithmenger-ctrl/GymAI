import Link from 'next/link'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { DemoLogins } from '@/components/demo-logins'
import { login } from '@/lib/actions/auth'

export const metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  return (
    <AuthCard title="Sign in" subtitle="Run your academy from one place.">
      {sp.error === 'invalid_link' && (
        <p role="alert" className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          That link has expired or was already used. Ask for a new one, or use “Forgot password?”.
        </p>
      )}
      <AuthForm
        action={login}
        submit="Sign in"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
        ]}
      />
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-muted underline underline-offset-4 hover:text-ink">Forgot password?</Link>
      </p>
      <p className="mt-6 text-sm text-muted">
        New facility?{' '}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">Create your academy</Link>
      </p>
      <DemoLogins />
    </AuthCard>
  )
}
