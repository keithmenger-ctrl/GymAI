import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { myAthletes } from '@/lib/queries/parent'
import { Badge, Card, EmptyState } from '@/components/ui'
import { fmtShortDate, fmtTime, fmtWeekday } from '@/lib/format'

export const metadata = { title: 'Home' }

const MEMBERSHIP_TONE = { active: 'ok', trialing: 'volt', past_due: 'bad', canceled: 'neutral' } as const

export default async function ParentHome() {
  const s = await requireRole('parent')
  const athletes = await myAthletes(s)
  return (
    <>
      <p className="text-sm text-muted">Hi {s.fullName.split(' ')[0]}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{athletes.length === 1 ? athletes[0].first_name : 'Your athletes'}</h1>
      <div className="mt-6 space-y-4">
        {athletes.length === 0 ? (
          <EmptyState title="No athletes linked yet" body={`Ask ${s.orgName} to link your athlete to your account.`} />
        ) : (
          athletes.map((a) => {
            const pct = a.total_90d ? Math.round((a.attended_90d / a.total_90d) * 100) : null
            return (
              <Card key={a.id} className="overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{a.first_name} {a.last_name}</p>
                      <p className="text-sm text-muted">{a.program ? `${a.program} · ${a.level ?? ''}` : 'Not enrolled in a program'}</p>
                    </div>
                    {a.membership && (
                      <Badge tone={MEMBERSHIP_TONE[a.membership.status as keyof typeof MEMBERSHIP_TONE] ?? 'neutral'} className="capitalize">
                        {a.membership.status.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Next session</dt>
                      <dd className="mt-1 text-sm">
                        {a.next_session ? (
                          <>
                            <span className="font-medium">{fmtWeekday(a.next_session.starts_at, s.timezone)}</span>
                            <span className="block text-muted">{fmtTime(a.next_session.starts_at, s.timezone)} · {a.next_session.focus ?? a.next_session.program}</span>
                          </>
                        ) : 'None scheduled'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">Attendance · 90 days</dt>
                      <dd className="mt-1 text-sm">
                        <span className="font-medium tabular-nums">{a.attended_90d} / {a.total_90d}</span>
                        {pct !== null && <span className="text-muted"> sessions ({pct}%)</span>}
                      </dd>
                    </div>
                  </dl>
                  {a.latest_note && (
                    <blockquote className="mt-5 border-l-2 border-volt pl-3 text-sm">
                      {a.latest_note.body}
                      <footer className="mt-1 text-xs text-muted">Coach note · {fmtShortDate(a.latest_note.created_at, s.timezone)}</footer>
                    </blockquote>
                  )}
                </div>
                <Link href={`/parent/progress/${a.id}`} className="flex items-center justify-between border-t border-line px-5 py-4 font-medium active:bg-stone-50">
                  View progress <ChevronRight className="size-5 text-muted" aria-hidden />
                </Link>
              </Card>
            )
          })
        )}
      </div>
    </>
  )
}
