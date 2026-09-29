import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { getSessionDetail } from '@/lib/queries/sessions'
import { AttendanceRoster } from '@/components/session/attendance'
import { SessionNotes } from '@/components/session/notes'
import { SessionPlan } from '@/components/session/plan'
import { fmtTime } from '@/lib/format'

export const metadata = { title: 'Session' }

export default async function CoachSessionPage({ params }: PageProps<'/coach/sessions/[id]'>) {
  const s = await requireStaff()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const session = await getSessionDetail(s, id)
  if (!session) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach/today" className="text-sm text-muted">← Today</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{session.program}</h1>
        <p className="text-muted">
          {session.level ?? 'All levels'} · {fmtTime(session.starts_at, s.timezone)}–{fmtTime(session.ends_at, s.timezone)}
          {session.location ? ` · ${session.location}` : ''}
        </p>
      </div>
      <SessionPlan session={session} />
      <section>
        <h2 className="mb-3 text-lg font-semibold">Athletes <span className="font-normal text-muted">({session.roster.length})</span></h2>
        <AttendanceRoster sessionId={id} roster={session.roster} athleteBase="/coach/athletes" />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Session notes</h2>
        <SessionNotes sessionId={id} notes={session.session_notes} tz={s.timezone} />
      </section>
    </div>
  )
}
