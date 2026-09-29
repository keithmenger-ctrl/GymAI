import { requireAdmin } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { createCoach, setCoachActive } from '@/lib/actions/coaches'
import { ActionForm } from '@/components/form'
import { InviteButton } from '@/components/athlete/invite-parent'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from '@/components/ui'

export const metadata = { title: 'Coaches' }

type CoachRow = {
  id: string; name: string; email: string | null; bio: string | null; active: boolean; has_login: boolean
  sessions_week: number; sessions_today: number; programs: string[]
}

export default async function CoachesPage() {
  const s = await requireAdmin()
  const coaches = await withUser(s.userId, (q) =>
    q<CoachRow>(
      `select c.id, c.name, c.email, c.bio, c.active, c.profile_id is not null as has_login,
              (select count(*)::int from sessions se where se.coach_id = c.id
                  and se.starts_at >= date_trunc('week', now() at time zone $1) at time zone $1
                  and se.starts_at <  (date_trunc('week', now() at time zone $1) + interval '7 days') at time zone $1) as sessions_week,
              (select count(*)::int from sessions se where se.coach_id = c.id
                  and (se.starts_at at time zone $1)::date = (now() at time zone $1)::date) as sessions_today,
              coalesce((select array_agg(distinct p.name) from sessions se join programs p on p.id = se.program_id
                  where se.coach_id = c.id and se.starts_at > now() - interval '30 days'), '{}') as programs
         from coaches c order by c.active desc, c.name`,
      [s.timezone],
    ),
  )
  return (
    <>
      <PageHeader title="Coaches" subtitle="Coaches sign in to a simple phone view: today's sessions, attendance, notes, assessments." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {coaches.length === 0 ? (
            <EmptyState title="No coaches yet" body="Add your first coach on the right." />
          ) : (
            coaches.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{c.name} {!c.active && <Badge className="ml-1">Inactive</Badge>}</p>
                    <p className="text-sm text-muted">{c.email ?? 'No email'}</p>
                    {c.bio && <p className="mt-1 text-sm">{c.bio}</p>}
                  </div>
                  <div className="text-right text-sm">
                    <p><span className="font-semibold tabular-nums">{c.sessions_today}</span> <span className="text-muted">today</span></p>
                    <p><span className="font-semibold tabular-nums">{c.sessions_week}</span> <span className="text-muted">this week</span></p>
                  </div>
                </div>
                {c.programs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">{c.programs.map((p) => <Badge key={p}>{p}</Badge>)}</div>
                )}
                <div className="mt-2 flex flex-wrap items-start justify-between gap-3 border-t border-line pt-1">
                  <div>
                    <InviteButton id={c.id} hasLogin={c.has_login} kind="coach" />
                    <p className="mt-1 text-xs text-muted">{c.has_login ? 'Has app access' : 'No app access yet'}</p>
                  </div>
                  <form action={setCoachActive.bind(null, c.id, !c.active)} className="mt-3">
                    <Button variant="ghost" size="sm">{c.active ? 'Mark inactive' : 'Reactivate'}</Button>
                  </form>
                </div>
              </Card>
            ))
          )}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-semibold">Add a coach</h2>
          <ActionForm action={createCoach} submit="Add coach" resetOnSuccess>
            <Field label="Name"><Input name="name" required /></Field>
            <Field label="Email"><Input name="email" type="email" /></Field>
            <Field label="Bio"><Textarea name="bio" className="min-h-16" /></Field>
          </ActionForm>
        </Card>
      </div>
    </>
  )
}
