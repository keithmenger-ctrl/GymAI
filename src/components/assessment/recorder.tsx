import Link from 'next/link'
import type { Session } from '@/lib/auth'
import { listAssessmentTypes, recorderAthletes } from '@/lib/queries/assessments'
import { todaysSessions, weekStart } from '@/lib/queries/sessions'
import { programOptions } from '@/lib/queries/athletes'
import { withUser } from '@/lib/db'
import { RecorderForm } from './recorder-form'
import { Card, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fmtTime } from '@/lib/format'

const uuid = (v: unknown) => (typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined)

/**
 * Three steps driven by the URL (?session= | ?level=, &metric=) so each step is a plain link:
 * pick a group → pick a metric → enter values.
 */
export async function Recorder({ session: s, basePath, params }: {
  session: Session
  basePath: string
  params: Record<string, string | string[] | undefined>
}) {
  const sessionId = uuid(params.session)
  const levelId = sessionId ? undefined : uuid(params.level)
  const types = await listAssessmentTypes(s)
  if (types.length === 0) {
    return <EmptyState title="No assessment metrics yet" body="An owner or admin needs to add metrics (e.g. 10-yard sprint) first." />
  }

  // step 1: choose a group
  if (!sessionId && !levelId) {
    const [today, programs] = await Promise.all([todaysSessions(s), programOptions(s)])
    return (
      <div className="space-y-6">
        {today.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Today&apos;s sessions</h2>
            <div className="space-y-2">
              {today.map((t) => (
                <Link key={t.id} href={`${basePath}?session=${t.id}`}>
                  <Card className="mb-2 flex items-center justify-between p-4 active:bg-stone-50">
                    <span>
                      <span className="font-medium">{t.program}</span>
                      <span className="block text-sm text-muted">{t.level ?? 'All levels'} · {fmtTime(t.starts_at, s.timezone)}</span>
                    </span>
                    <span className="text-sm text-muted">{t.enrolled} athletes</span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">By program level</h2>
          <Card className="divide-y divide-line">
            {programs.flatMap((p) =>
              p.levels.map((l) => (
                <Link key={l.id} href={`${basePath}?level=${l.id}`} className="flex justify-between px-4 py-3.5 active:bg-stone-50">
                  <span>{p.name}</span><span className="text-muted">{l.name}</span>
                </Link>
              )),
            )}
          </Card>
        </section>
      </div>
    )
  }

  // step 2 + 3: metric chips, then the entry form
  const metric = types.find((t) => t.id === uuid(params.metric)) ?? types[0]
  const src = sessionId ? `session=${sessionId}` : `level=${levelId}`
  const [athletes, wk, label] = await Promise.all([
    recorderAthletes(s, { sessionId, levelId }, metric.id),
    weekStart(s),
    withUser(s.userId, async (q) => {
      const r = sessionId
        ? await q<{ label: string }>(
            `select p.name || coalesce(' · ' || l.name, '') as label from sessions se
               join programs p on p.id = se.program_id left join program_levels l on l.id = se.level_id where se.id = $1`, [sessionId])
        : await q<{ label: string }>(
            `select p.name || ' · ' || l.name as label from program_levels l join programs p on p.id = l.program_id where l.id = $1`, [levelId])
      return r[0]?.label ?? 'Group'
    }),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{label}</p>
        <Link href={basePath} className="text-sm text-muted underline underline-offset-4">Change group</Link>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Metric">
        {types.map((t) => (
          <Link
            key={t.id}
            href={`${basePath}?${src}&metric=${t.id}`}
            role="tab"
            aria-selected={t.id === metric.id}
            className={cn('shrink-0 rounded-full border px-4 py-2 text-sm font-medium',
              t.id === metric.id ? 'border-ink bg-ink text-white' : 'border-line bg-card')}
          >
            {t.name}
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted">
        {metric.name} in {metric.unit} · {metric.direction === 'lower' ? 'lower is better' : 'higher is better'}
      </p>
      {athletes.length === 0 ? (
        <EmptyState title="No athletes in this group" />
      ) : (
        <RecorderForm key={metric.id} typeId={metric.id} unit={metric.unit} direction={metric.direction} athletes={athletes} today={wk.today} />
      )}
    </div>
  )
}
