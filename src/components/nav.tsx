'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity, BarChart3, CalendarDays, ClipboardList, CreditCard, FileText, Home, LayoutDashboard,
  Layers, Settings, Sparkles, Timer, TrendingUp, UserCog, Users, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const ICONS = {
  dashboard: LayoutDashboard, athletes: Users, programs: Layers, schedule: CalendarDays, coaches: UserCog,
  assessments: Timer, reports: FileText, billing: CreditCard, settings: Settings, today: Activity,
  home: Home, progress: TrendingUp, clipboard: ClipboardList, chart: BarChart3, assistant: Sparkles,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS
export type NavItem = { href: string; label: string; icon?: IconName }

function Icon({ name, className }: { name?: IconName; className?: string }) {
  if (!name) return null
  const C = ICONS[name]
  return <C className={className ?? 'size-[18px]'} aria-hidden />
}

const isActive = (path: string, href: string) =>
  path === href || (href !== '/' && path.startsWith(href + '/'))

export function SidebarNav({ items }: { items: NavItem[] }) {
  const path = usePathname()
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={isActive(path, i.href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive(path, i.href) ? 'bg-volt text-ink' : 'text-stone-600 hover:bg-stone-100 hover:text-ink',
          )}
        >
          <Icon name={i.icon} />
          {i.label}
        </Link>
      ))}
    </nav>
  )
}

/** Horizontal scroller used for the owner nav on small screens. */
export function PillNav({ items }: { items: NavItem[] }) {
  const path = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={cn(
            'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium',
            isActive(path, i.href) ? 'bg-ink text-white' : 'bg-stone-100 text-stone-700',
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  )
}

export function BottomTabs({ items }: { items: NavItem[] }) {
  const path = usePathname()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-xl">
        {items.map((i) => {
          const active = isActive(path, i.href)
          return (
            <li key={i.href} className="flex-1">
              <Link
                href={i.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                  active ? 'text-ink' : 'text-muted',
                )}
              >
                <span className={cn('rounded-full px-4 py-1', active && 'bg-volt')}><Icon name={i.icon} className="size-5" /></span>
                {i.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
