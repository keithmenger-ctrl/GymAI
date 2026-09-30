import { LogOut } from 'lucide-react'
import { logout } from '@/lib/actions/auth'
import type { Session } from '@/lib/auth'
import { FeedbackButton } from './feedback'

export function UserMenu({ session }: { session: Session }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 text-right leading-tight">
        <p className="truncate text-sm font-medium">{session.fullName}</p>
        <p className="text-xs capitalize text-muted">{session.role}</p>
      </div>
      <FeedbackButton />
      <form action={logout}>
        <button
          className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-stone-600 hover:bg-stone-100"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  )
}

export function Wordmark({ org }: { org?: string }) {
  return (
    <div className="leading-tight">
      <p className="text-base font-semibold tracking-tight">
        Academy<span className="rounded bg-volt px-1">OS</span>
      </p>
      {org && <p className="truncate text-xs text-muted">{org}</p>}
    </div>
  )
}
