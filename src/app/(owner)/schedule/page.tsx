import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { requireAdmin } from '@/lib/auth'
import { sessionsBetween, weekStart } from '@/lib/queries/sessions'
import { Badge, Card, PageHeader, buttonClass } from '@/components/ui'
import { attendanceLabel } from '@/components/session/session-card'
import { fmtTime } from '@/lib/format'

export const metadata = { title: 'Schedule' }

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })

export default async function SchedulePage({ searchParams }: PageProps<'/schedule'>) {
  const s = await requireAdmin()
  const sp = await searchParams
  const w = typeof sp.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : undefined
  const { monday, today } = await weekStart(s, w)
  const sessions = await sessionsBetween(s, monday, addDays(monday, 7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const localDate = (d: Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: s.timezone })

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Week of ${dayLabel(monday)} · ${sessions.length} sessions`}
        actions={
          <>
            <Link href={`/schedule?week=${addDays(monday, -7)}`} className={buttonClass('secondary')} aria-label="Previous week"><ChevronLeft className="size-4" /></Link>
            <Link href="/schedule" className={buttonClass('secondary')}>This week</Link>
            <Link href={`/schedule?week=${addDays(monday, 7)}`} className={buttonClass('secondary')} aria-label="Next week"><ChevronRight className="size-4" /></Link>
            <Link href={`/schedule/new?date=${monday > today ? monday : today}`} className={buttonClass()}>New session</Link>
          </>
        }
      />
      <div className="space-y-6">
        {days.map((day) => {
          const list = sessions.filter((x) => localDate(x.starts_at) === day)
          const isToday = day === today
          return (
            <section key={day}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {dayLabel(day)} {isToday && <Badge tone="volt">Today</Badge>}
              </h2>
              {list.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">No sessions</p>
              ) : (
                <Card className="divide-y divide-line">
                  {list.map((c) => {
                    const a = attendanceLabel(c, new Date(c.ends_at).getTime() < Date.now())
                    return (
                      <Link key={c.id} href={`/schedule/${c.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 hover:bg-stone-50">
                        <span className="w-32 text-sm font-medium tabular-nums">{fmtTime(c.starts_at, s.timezone)} – {fmtTime(c.ends_at, s.timezone)}</span>
                        <span className="min-w-48 flex-1">
                          <span className="font-medium">{c.program}{c.level ? ` · ${c.level}` : ''}</span>
                          <span className="block text-xs text-muted">{c.focus ?? 'No focus'}{c.location ? ` · ${c.location}` : ''}</span>
                        </span>
                        <span className="w-28 text-sm text-muted">{c.coach ?? 'Unassigned'}</span>
                        <span className="w-16 text-right text-sm tabular-nums">{c.enrolled}/{c.max_athletes}</span>
                        <Badge tone={a.tone} className="w-40 justify-center">{a.text}</Badge>
                      </Link>
                    )
                  })}
                </Card>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
