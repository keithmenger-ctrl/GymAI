import { requireStaff } from '@/lib/auth'
import { MobileShell } from '@/components/shell/mobile-shell'
import type { NavItem } from '@/components/nav'

const NAV: NavItem[] = [
  { href: '/coach/today', label: 'Today', icon: 'today' },
  { href: '/coach/athletes', label: 'Athletes', icon: 'athletes' },
  { href: '/coach/assessments', label: 'Assessments', icon: 'assessments' },
]

// Owners/admins may open the coach view too (handy for demos); parents may not.
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff()
  return <MobileShell session={session} nav={NAV}>{children}</MobileShell>
}
