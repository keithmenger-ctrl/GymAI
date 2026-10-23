import { requireRole } from '@/lib/auth'
import { MobileShell } from '@/components/shell/mobile-shell'
import type { NavItem } from '@/components/nav'
import { flags } from '@/lib/flags'

const nav = (): NavItem[] => [
  { href: '/parent', label: 'Home', icon: 'home' },
  { href: '/parent/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/parent/progress', label: 'Progress', icon: 'progress' },
  ...(flags.billing() ? [{ href: '/parent/billing', label: 'Billing', icon: 'billing' } as const] : []),
]

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('parent')
  return <MobileShell session={session} nav={nav()}>{children}</MobileShell>
}
