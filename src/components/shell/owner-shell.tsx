import type { Session } from '@/lib/auth'
import { PillNav, SidebarNav, type NavItem } from '@/components/nav'
import { UserMenu, Wordmark } from './user-menu'

export const OWNER_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/athletes', label: 'Athletes', icon: 'athletes' },
  { href: '/programs', label: 'Programs', icon: 'programs' },
  { href: '/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/coaches', label: 'Coaches', icon: 'coaches' },
  { href: '/assessments', label: 'Assessments', icon: 'assessments' },
  { href: '/reports', label: 'Reports', icon: 'reports' },
  { href: '/billing', label: 'Billing', icon: 'billing' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
]

export function OwnerShell({ session, children }: { session: Session; children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-line bg-card md:flex md:flex-col md:gap-8 md:p-4">
        <div className="px-3 pt-2"><Wordmark org={session.orgName} /></div>
        <SidebarNav items={OWNER_NAV} />
        <p className="mt-auto px-3 text-xs text-muted">MVP build</p>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 md:justify-end md:px-8">
            <div className="md:hidden"><Wordmark org={session.orgName} /></div>
            <UserMenu session={session} />
          </div>
          <div className="md:hidden"><PillNav items={OWNER_NAV} /></div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  )
}
