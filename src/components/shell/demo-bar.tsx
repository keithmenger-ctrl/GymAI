import { switchDemoView } from '@/lib/actions/demo'
import type { Session } from '@/lib/auth'
import { cn } from '@/lib/cn'

const VIEWS = [
  { role: 'owner', label: 'Owner' },
  { role: 'coach', label: 'Coach' },
  { role: 'parent', label: 'Parent' },
] as const

/** Shown only in demo academies: jump between the owner, coach and parent experience. */
export function DemoBar({ session }: { session: Session }) {
  if (!session.isDemo) return null
  const current = session.role === 'admin' ? 'owner' : session.role
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-sm text-white print:hidden">
      <span className="text-white/70">Demo academy · view as</span>
      <div className="flex gap-1">
        {VIEWS.map((v) => (
          <form key={v.role} action={switchDemoView.bind(null, v.role)}>
            <button
              aria-pressed={current === v.role}
              className={cn('rounded-full px-3 py-0.5 font-medium',
                current === v.role ? 'bg-volt text-ink' : 'text-white hover:bg-white/10')}
            >
              {v.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}
