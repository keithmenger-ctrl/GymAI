import Link from 'next/link'
import { Wordmark } from '@/components/shell/user-menu'
import { buttonClass } from '@/components/ui'

export const metadata = { title: 'Not found' }

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Wordmark />
      <p className="mt-10 text-sm font-medium uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
      <p className="mt-2 text-muted">It may have been deleted, or it belongs to someone else&apos;s account.</p>
      <div className="mt-8"><Link href="/" className={buttonClass()}>Go to my home screen</Link></div>
    </main>
  )
}
