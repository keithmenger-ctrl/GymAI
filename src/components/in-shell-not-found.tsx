import Link from 'next/link'
import { buttonClass } from '@/components/ui'

/** 404 inside an app shell (the shell already shows the logo + navigation). */
export function InShellNotFound({ home }: { home: string }) {
  return (
    <div className="py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">It may have been deleted, or it isn&apos;t part of your account.</p>
      <div className="mt-6"><Link href={home} className={buttonClass('secondary')}>Back</Link></div>
    </div>
  )
}
