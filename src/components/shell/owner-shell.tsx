import type { Session } from '@/lib/auth'
import { PillNav, SidebarNav, type NavItem } from '@/components/nav'
import { UserMenu, Wordmark } from './user-menu'
import { DemoBar } from './demo-bar'
import { flags } from '@/lib/flags'

const ownerNav = (): NavItem[] => [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/athletes', label: 'Athletes', icon: 'athletes' },
  { href: '/programs', label: 'Programs', icon: 'programs' },
  { href: '/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/coaches', label: 'Coaches', icon: 'coaches' },
  { href: '/assessments', label: 'Assessments', icon: 'assessments' },
  { href: '/reports', label: 'Reports', icon: 'reports' },
  ...(flags.billing() ? [{ href: '/billing', label: 'Billing', icon: 'billing' } as const] : []),
  { href: '/settings', label: 'Settings', icon: 'settings' },
]

export function OwnerShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const nav = ownerNav()
  return (
    <>
    <DemoBar session={session} />
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr] print:block">
      <aside className="hidden print:!hidden border-r border-line bg-card md:flex md:flex-col md:gap-8 md:p-4">
        <div className="px-3 pt-2"><Wordmark org={session.orgName} /></div>
        <SidebarNav items={nav} />
        <p className="mt-auto px-3 text-xs text-muted">MVP build</p>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur print:hidden">
          <div className="flex items-center justify-between px-4 py-3 md:justify-end md:px-8">
            <div className="md:hidden"><Wordmark org={session.orgName} /></div>
            <UserMenu session={session} />
          </div>
          <div className="md:hidden"><PillNav items={nav} /></div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
    </>
  )
}
