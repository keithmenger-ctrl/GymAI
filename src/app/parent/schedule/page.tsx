import { requireRole } from '@/lib/auth'
import { mySchedule } from '@/lib/queries/parent'
import { Badge, Card, EmptyState } from '@/components/ui'
import { fmtTime, fmtWeekday } from '@/lib/format'

export const metadata = { title: 'Schedule' }

export default async function ParentSchedule() {
  const s = await requireRole('parent')
  const sessions = await mySchedule(s)
  const byDay = new Map<string, typeof sessions>()
  for (const x of sessions) {
    const k = fmtWeekday(x.starts_at, s.timezone)
    byDay.set(k, [...(byDay.get(k) ?? []), x])
  }
  const multi = new Set(sessions.map((x) => x.athlete)).size > 1
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
      <p className="mt-1 text-sm text-muted">Today and the next two weeks</p>
      <div className="mt-6 space-y-6">
        {sessions.length === 0 ? (
          <EmptyState title="Nothing scheduled" body="Upcoming sessions will show up here." />
        ) : (
          [...byDay].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold">{day}</h2>
              <Card className="divide-y divide-line">
                {list.map((x) => (
                  <div key={`${x.id}-${x.athlete}`} className="flex items-center gap-4 p-4">
                    <div className="w-[4.75rem] shrink-0 text-sm font-semibold tabular-nums">{fmtTime(x.starts_at, s.timezone)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{x.program}</p>
                      <p className="truncate text-sm text-muted">
                        {[multi && x.athlete, x.level, x.focus].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {x.status && <Badge tone={x.status === 'present' ? 'ok' : x.status === 'late' ? 'warn' : 'bad'} className="capitalize">{x.status}</Badge>}
                  </div>
                ))}
              </Card>
            </section>
          ))
        )}
      </div>
    </>
  )
}
