'use client' // Error boundaries must be Client Components

import Link from 'next/link'
import { Button, buttonClass } from '@/components/ui'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-muted">Your data is safe. Try again, and if it keeps happening let us know with the feedback button.</p>
      {error.digest && <p className="mt-3 text-xs text-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className={buttonClass('secondary')}>Home</Link>
      </div>
    </main>
  )
}
