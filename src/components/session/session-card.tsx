import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui'
import { fmtTime } from '@/lib/format'
import type { SessionCard } from '@/lib/queries/sessions'

/** Attendance progress label: "Not started" / "5 of 7 marked" / "Done". */
export function attendanceLabel(c: SessionCard, isPast: boolean) {
  if (c.enrolled === 0) return { text: 'No roster', tone: 'neutral' as const }
  if (c.marked >= c.enrolled) return { text: `${c.attended}/${c.enrolled} attended`, tone: 'ok' as const }
  if (c.marked > 0) return { text: `${c.marked} of ${c.enrolled} marked`, tone: 'warn' as const }
  return { text: isPast ? 'Attendance not taken' : 'Not started', tone: isPast ? ('bad' as const) : ('neutral' as const) }
}

/** Big tappable card used on the coach Today screen. */
export function CoachSessionCard({ c, tz, href, now }: { c: SessionCard; tz: string; href: string; now: number }) {
  const past = new Date(c.ends_at).getTime() < now
  const a = attendanceLabel(c, past)
  return (
    <Link href={href} className="block">
      <div className="flex items-center gap-4 rounded-xl border border-line bg-card p-4 active:bg-stone-50">
        <div className="w-[4.75rem] shrink-0">
          <p className="whitespace-nowrap text-base font-semibold tabular-nums leading-tight">{fmtTime(c.starts_at, tz)}</p>
          <p className="text-xs text-muted">{fmtTime(c.ends_at, tz)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{c.program}</p>
          <p className="truncate text-sm text-muted">{c.level ?? 'All levels'} · {c.focus ?? 'No focus set'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{c.enrolled} athletes</span>
            <Badge tone={a.tone}>{a.text}</Badge>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </div>
    </Link>
  )
}
