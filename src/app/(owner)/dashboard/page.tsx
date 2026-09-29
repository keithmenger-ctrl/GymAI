import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { activityStats, financeStats, notAttendedSince, programCapacity, todayStats } from '@/lib/queries/dashboard'
import { dueForReassessment, dueLabel } from '@/lib/queries/assessments'
import { todaysSessions } from '@/lib/queries/sessions'
import { Badge, Card, Stat, buttonClass } from '@/components/ui'
import { Sparkles } from 'lucide-react'
import { attendanceLabel } from '@/components/session/session-card'
import { fmtTime, fmtWeekday, money } from '@/lib/format'
import { cn } from '@/lib/cn'

export const metadata = { title: 'Dashboard' }

function Panel({ title, href, linkLabel, children, className }: {
  title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string
}) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {href && <Link href={href} className="text-sm text-muted hover:text-ink">{linkLabel ?? 'View all'} →</Link>}
      </div>
      {children}
    </Card>
  )
}

export default async function DashboardPage() {
  const s = await requireAdmin()
  const [today, sessions, capacity, activity, inactive, due, finance] = await Promise.all([
    todayStats(s), todaysSessions(s), programCapacity(s), activityStats(s), notAttendedSince(s, 14),
    dueForReassessment(s), financeStats(s),
  ])
  const now = new Date().getTime()
  const programs = [...new Set(capacity.map((c) => c.program))]

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{fmtWeekday(new Date(), s.timezone)}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{s.orgName}</h1>
        </div>
        <Link href="/assistant" className={buttonClass('secondary')}><Sparkles className="size-4" aria-hidden /> Ask the assistant</Link>
      </div>

      {/* TODAY */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sessions today" value={today.sessions} />
        <Stat label="Athletes scheduled" value={today.athletes_scheduled} />
        <Stat label="Attendance today" value={today.marked ? `${today.attended}` : '—'} sub={today.marked ? `of ${today.marked} marked` : 'Not taken yet'} />
        <Stat label="Coaches working" value={today.coaches} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Today's sessions" href="/schedule" linkLabel="Schedule">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted">No sessions today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((c) => {
                const a = attendanceLabel(c, new Date(c.ends_at).getTime() < now)
                return (
                  <li key={c.id}>
                    <Link href={`/schedule/${c.id}`} className="flex items-center gap-4 py-2.5 hover:bg-stone-50">
                      <span className="w-[4.5rem] text-sm font-medium tabular-nums">{fmtTime(c.starts_at, s.timezone)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.program}{c.level ? ` · ${c.level}` : ''}</span>
                        <span className="block truncate text-xs text-muted">{c.coach ?? 'Unassigned'} · {c.enrolled} athletes</span>
                      </span>
                      <Badge tone={a.tone}>{a.text}</Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Program capacity" href="/programs" linkLabel="Programs">
          <div className="space-y-5">
            {programs.map((p) => {
              const rows = capacity.filter((c) => c.program === p)
              const growth = rows.reduce((n, r) => n + r.new_30d, 0)
              return (
                <div key={p}>
                  <p className="mb-2 flex items-center justify-between text-sm font-medium">
                    {p}
                    {growth > 0 && <Badge tone="ok">+{growth} new in 30 days</Badge>}
                  </p>
                  <ul className="space-y-2">
                    {rows.map((r) => {
                      const pct = r.capacity ? Math.min(100, Math.round((r.enrolled / r.capacity) * 100)) : 0
                      return (
                        <li key={r.level_id} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-sm">
                          <span className="text-muted">{r.level}</span>
                          <span className="h-2 rounded-full bg-stone-100" role="img" aria-label={`${r.enrolled} of ${r.capacity}`}>
                            <span className={cn('block h-full rounded-full', pct >= 90 ? 'bg-warn' : 'bg-ink')} style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-right tabular-nums">{r.enrolled}/{r.capacity}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="Athlete activity" href="/athletes" linkLabel="Athletes">
          <div className="grid grid-cols-3 gap-3">
            <div><p className="text-2xl font-semibold tabular-nums">{activity.active}</p><p className="text-xs text-muted">Active</p></div>
            <div><p className="text-2xl font-semibold tabular-nums">{activity.trial}</p><p className="text-xs text-muted">On trial</p></div>
            <div><p className="text-2xl font-semibold tabular-nums">{activity.new_this_month}</p><p className="text-xs text-muted">New this month</p></div>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-medium">Haven&apos;t attended in 14+ days <span className="text-muted">({inactive.length})</span></h3>
          {inactive.length === 0 ? (
            <p className="text-sm text-muted">Everyone has trained in the last two weeks.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {inactive.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <Link href={`/athletes/${a.id}`} className="hover:underline">{a.name}<span className="text-muted"> · {a.program ?? 'No program'}</span></Link>
                  <Badge tone="warn">{a.days === null ? 'Never' : `${a.days} days`}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Due for reassessment" href="/assessments" linkLabel="Assessments">
          <p className="text-2xl font-semibold tabular-nums">{due.length} <span className="text-base font-normal text-muted">athletes</span></p>
          {due.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {due.slice(0, 6).map((d) => (
                <li key={d.athlete_id} className="flex items-center justify-between py-2">
                  <Link href={`/athletes/${d.athlete_id}`} className="hover:underline">{d.name}</Link>
                  <span className="text-muted">{dueLabel(d)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {finance && (
          <Panel title="Memberships" href="/billing" linkLabel="Billing" className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="text-2xl font-semibold tabular-nums">{money(finance.mrr_cents)}</p><p className="text-xs text-muted">Monthly recurring revenue</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{finance.active}</p><p className="text-xs text-muted">Active memberships</p></div>
              <div><p className="text-2xl font-semibold tabular-nums">{finance.trialing}</p><p className="text-xs text-muted">Trialing</p></div>
              <div><p className={cn('text-2xl font-semibold tabular-nums', finance.past_due > 0 && 'text-bad')}>{finance.past_due}</p><p className="text-xs text-muted">Past due</p></div>
            </div>
            {finance.past_due_list.length > 0 && (
              <ul className="mt-4 divide-y divide-line border-t border-line text-sm">
                {finance.past_due_list.map((p) => (
                  <li key={p.athlete_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/athletes/${p.athlete_id}`} className="hover:underline">{p.athlete}<span className="text-muted"> · {p.guardian ?? 'No guardian'}</span></Link>
                    <span className="text-muted">{p.plan} · <span className="font-medium text-bad">{money(p.amount_cents)} past due</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </>
  )
}
