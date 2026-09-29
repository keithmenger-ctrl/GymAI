import { requireStaff } from '@/lib/auth'
import { nextSessionForCoach, todaysSessions } from '@/lib/queries/sessions'
import { CoachSessionCard } from '@/components/session/session-card'
import { fmtWeekday } from '@/lib/format'

export const metadata = { title: 'Today' }

export default async function TodayPage() {
  const s = await requireStaff()
  const sessions = await todaysSessions(s)
  const next = sessions.length === 0 ? await nextSessionForCoach(s) : null
  const athletes = sessions.reduce((n, x) => n + x.enrolled, 0)
  const now = new Date().getTime()

  return (
    <>
      <p className="text-sm text-muted">{fmtWeekday(new Date(), s.timezone)}</p>
      <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
      {sessions.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} · {athletes} athletes
          {s.role !== 'coach' && ' · all coaches'}
        </p>
      )}
      <div className="mt-6 space-y-3">
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-8 text-center">
            <p className="font-medium">No sessions today</p>
            {next && (
              <>
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Next up · {fmtWeekday(next.starts_at, s.timezone)}</p>
                <div className="mt-2 text-left"><CoachSessionCard c={next} tz={s.timezone} href={`/coach/sessions/${next.id}`} now={now} /></div>
              </>
            )}
          </div>
        ) : (
          sessions.map((c) => <CoachSessionCard key={c.id} c={c} tz={s.timezone} href={`/coach/sessions/${c.id}`} now={now} />)
        )}
      </div>
    </>
  )
}
