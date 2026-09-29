import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { enrollableAthletes, getSessionDetail } from '@/lib/queries/sessions'
import { deleteSession, enrollAthlete, unenrollAthlete } from '@/lib/actions/sessions'
import { AttendanceRoster } from '@/components/session/attendance'
import { SessionNotes } from '@/components/session/notes'
import { SessionPlan } from '@/components/session/plan'
import { ActionForm, ConfirmButton } from '@/components/form'
import { Card, PageHeader, Select, buttonClass } from '@/components/ui'
import { fmtTime, fmtWeekday } from '@/lib/format'

export const metadata = { title: 'Session' }

export default async function OwnerSessionPage({ params }: PageProps<'/schedule/[id]'>) {
  const s = await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [session, available] = await Promise.all([getSessionDetail(s, id), enrollableAthletes(s, id)])
  if (!session) notFound()
  const full = session.roster.length >= session.max_athletes

  return (
    <>
      <Link href="/schedule" className="mb-4 inline-block text-sm text-muted hover:text-ink">← Schedule</Link>
      <PageHeader
        title={`${session.program}${session.level ? ` · ${session.level}` : ''}`}
        subtitle={`${fmtWeekday(session.starts_at, s.timezone)} · ${fmtTime(session.starts_at, s.timezone)}–${fmtTime(session.ends_at, s.timezone)} · ${session.coach ?? 'No coach assigned'}${session.location ? ` · ${session.location}` : ''}`}
        actions={
          <>
            <Link href={`/schedule/${id}/edit`} className={buttonClass('secondary')}>Edit</Link>
            <ConfirmButton action={deleteSession.bind(null, id)} label="Delete" confirm="Delete this session, its roster and attendance?" />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 font-semibold">Roster & attendance <span className="font-normal text-muted">({session.roster.length}/{session.max_athletes})</span></h2>
            <AttendanceRoster sessionId={id} roster={session.roster} athleteBase="/athletes" />
            {session.roster.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted">Remove athletes from this session</summary>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {session.roster.map((a) => (
                    <li key={a.id}>
                      <form action={unenrollAthlete.bind(null, id, a.id)}>
                        <button className="rounded-full border border-line px-3 py-1 text-sm hover:border-bad hover:text-bad">
                          {a.first_name} {a.last_name} ✕
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Enroll an athlete</h2>
            {full ? (
              <p className="text-sm text-muted">This session is full. Raise max athletes to add more.</p>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted">Every active athlete is already enrolled.</p>
            ) : (
              <ActionForm action={enrollAthlete.bind(null, id)} submit="Enroll" variant="secondary" className="flex flex-wrap items-start gap-2 space-y-0">
                <Select name="athlete_id" className="max-w-sm flex-1" aria-label="Athlete" required>
                  {available.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.in_level ? '' : ` (${a.program ?? 'no program'}${a.level ? ` · ${a.level}` : ''})`}</option>
                  ))}
                </Select>
              </ActionForm>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Notes</h2>
            <SessionNotes sessionId={id} notes={session.session_notes} tz={s.timezone} />
          </Card>
        </div>
        <SessionPlan session={session} />
      </div>
    </>
  )
}
