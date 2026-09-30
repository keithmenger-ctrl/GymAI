import Link from 'next/link'
import { AuthCard } from '@/components/auth-card'
import { AuthForm } from '@/components/auth-form'
import { forgotPassword } from '@/lib/actions/auth'

export const metadata = { title: 'Forgot password' }

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" subtitle="We'll email you a link to sign in and choose a new one.">
      <AuthForm
        action={forgotPassword}
        submit="Email me a link"
        fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
      />
      <p className="mt-6 text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">Back to sign in</Link>
      </p>
    </AuthCard>
  )
}
