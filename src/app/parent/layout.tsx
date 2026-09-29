import { requireRole } from '@/lib/auth'
import { MobileShell } from '@/components/shell/mobile-shell'
import type { NavItem } from '@/components/nav'

const NAV: NavItem[] = [
  { href: '/parent', label: 'Home', icon: 'home' },
  { href: '/parent/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/parent/progress', label: 'Progress', icon: 'progress' },
  { href: '/parent/billing', label: 'Billing', icon: 'billing' },
]

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('parent')
  return <MobileShell session={session} nav={NAV}>{children}</MobileShell>
}
