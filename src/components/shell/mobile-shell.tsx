import type { Session } from '@/lib/auth'
import { BottomTabs, type NavItem } from '@/components/nav'
import { UserMenu, Wordmark } from './user-menu'

/** Phone-first shell used by coaches and parents: slim top bar + big bottom tabs. */
export function MobileShell({ session, nav, children }: { session: Session; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Wordmark org={session.orgName} />
          <UserMenu session={session} />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
      <BottomTabs items={nav} />
    </div>
  )
}
