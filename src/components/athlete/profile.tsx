import Link from 'next/link'
import { Badge, Card, buttonClass } from '@/components/ui'
import { StatusBadge } from './status-badge'
import { InviteParent } from './invite-parent'
import { fmtDate, fmtShortDate, initials, num, relativeDays } from '@/lib/format'
import type { Session } from '@/lib/auth'
import {
  assessmentSeries, athleteNotes, athleteTimeline, attendanceSummary, currentFocus, getAthlete,
  improvement, recentAttendance,
} from '@/lib/queries/athletes'

const KIND_LABEL: Record<string, string> = {
  level_change: 'Level', assessment: 'Assessment', note: 'Note', milestone: 'Milestone', program_change: 'Program',
}
const ATT_TONE = { present: 'ok', late: 'warn', absent: 'bad' } as const

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  )
}

/**
 * Shared athlete profile. `viewer` decides which cards render; row-level visibility
 * (e.g. parents only see shareable notes) is enforced by the database, not here.
 */
export async function AthleteProfile({
  session, id, viewer, editHref, tz,
}: { session: Session; id: string; viewer: 'admin' | 'coach' | 'parent'; editHref?: string; tz: string }) {
  const [a, att, recent, series, notes, timeline, focus] = await Promise.all([
    getAthlete(session, id),
    attendanceSummary(session, id),
    recentAttendance(session, id),
    assessmentSeries(session, id),
    athleteNotes(session, id),
    athleteTimeline(session, id),
    currentFocus(session, id),
  ])
  if (!a) return null
  const pct = att.total ? Math.round((att.attended / att.total) * 100) : 0
  const highlights = series.map((s) => ({ s, imp: improvement(s) })).filter((x) => x.imp).slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-ink text-lg font-semibold text-white">
            {initials(a.first_name, a.last_name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{a.first_name} {a.last_name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {[a.age !== null && `Age ${a.age}`, a.sport, a.position, a.school_team].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        {editHref && <Link href={editHref} className={buttonClass('secondary')}>Edit athlete</Link>}
      </div>

      {/* Progress snapshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current program</p>
          <p className="mt-2 text-lg font-semibold">{a.program_name ?? 'Not enrolled'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current level</p>
          <p className="mt-2 text-lg font-semibold">{a.level_name ?? '—'}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Attendance · 90 days</p>
          <p className="mt-2 text-lg font-semibold tabular-nums">
            {att.attended} <span className="font-normal text-muted">/ {att.total} sessions</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-stone-100" role="img" aria-label={`${pct}% attendance`}>
            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current focus</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {focus.length ? focus.map((f) => <Badge key={f} tone="volt">{f}</Badge>) : <span className="text-sm text-muted">Nothing scheduled</span>}
          </div>
        </Card>
      </div>

      {highlights.length > 0 && (
        <Section title="Assessment progress">
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {highlights.map(({ s, imp }) => (
              <div key={s.type_id} className="flex items-baseline justify-between border-b border-line pb-2">
                <span className="text-sm">{s.name}</span>
                <span className="text-sm font-medium tabular-nums">
                  {num(imp!.first)} → {num(imp!.last)} <span className="text-muted">{s.unit}</span>{' '}
                  {imp!.better !== null && (
                    <span className={imp!.better ? 'text-ok' : 'text-bad'}>{imp!.better ? '▲' : '▼'}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Section title="Progress timeline">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {timeline.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-ink" />
                    <p className="text-xs text-muted">
                      {fmtDate(e.occurred_at, tz)} · {KIND_LABEL[e.kind] ?? e.kind}
                    </p>
                    <p className="text-sm">{e.title}</p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Assessment history">
            {series.length === 0 ? (
              <p className="text-sm text-muted">No assessments recorded yet.</p>
            ) : (
              <div className="space-y-6">
                {series.map((s) => {
                  const imp = improvement(s)
                  return (
                    <div key={s.type_id}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <h3 className="text-sm font-medium">{s.name} <span className="text-muted">({s.unit}{s.direction === 'lower' ? ', lower is better' : ''})</span></h3>
                        {imp && imp.better !== null && (
                          <Badge tone={imp.better ? 'ok' : 'bad'}>
                            {imp.diff > 0 ? '+' : ''}{num(Number(imp.diff.toFixed(2)))} {s.unit}
                          </Badge>
                        )}
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {[...s.results].reverse().map((r, i, arr) => {
                            const prev = arr[i + 1]
                            return (
                              <tr key={r.id} className="border-t border-line">
                                <td className="py-1.5 text-muted">{fmtDate(r.recorded_on)}</td>
                                <td className="py-1.5 text-right font-medium tabular-nums">{num(r.value)} {s.unit}</td>
                                <td className="w-16 py-1.5 text-right text-xs tabular-nums text-muted">
                                  {prev ? `${Number(r.value) - Number(prev.value) > 0 ? '+' : ''}${num(Number((Number(r.value) - Number(prev.value)).toFixed(2)))}` : ''}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          {viewer !== 'parent' && (
            <Section title="Parent / guardian">
              {a.guardians.length === 0 ? (
                <p className="text-sm text-muted">No guardian on file.</p>
              ) : (
                a.guardians.map((g) => (
                  <div key={g.id} className="text-sm">
                    <p className="font-medium">{g.name}</p>
                    {g.email && <p className="text-muted">{g.email}</p>}
                    {g.phone && <p className="text-muted">{g.phone}</p>}
                    {viewer === 'admin' && <InviteParent guardianId={g.id} hasLogin={g.has_login} />}
                    {viewer !== 'admin' && <p className="mt-1 text-xs text-muted">{g.has_login ? 'Has portal access' : 'No portal access yet'}</p>}
                  </div>
                ))
              )}
            </Section>
          )}

          <Section title="Coach notes">
            {notes.length === 0 ? (
              <p className="text-sm text-muted">No notes yet.</p>
            ) : (
              <ul className="space-y-4">
                {notes.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p>{n.body}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      {fmtShortDate(n.created_at, tz)}{n.author ? ` · ${n.author}` : ''}
                      {viewer !== 'parent' && n.shareable && <Badge tone="volt">Shared with parent</Badge>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent attendance">
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No attendance recorded yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {recent.map((r) => (
                  <li key={r.session_id} className="flex items-center justify-between py-2">
                    <span>
                      {fmtShortDate(r.starts_at, tz)}
                      <span className="text-muted"> · {r.program}{r.level ? ` ${r.level}` : ''}</span>
                    </span>
                    <Badge tone={ATT_TONE[r.status]} className="capitalize">{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Joined</dt><dd>{fmtDate(a.join_date)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Date of birth</dt><dd>{fmtDate(a.date_of_birth)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Last attended</dt><dd>{relativeDays(att.last_attended)}</dd></div>
            </dl>
            {viewer !== 'parent' && a.notes && <p className="mt-4 whitespace-pre-wrap border-t border-line pt-4 text-sm text-muted">{a.notes}</p>}
          </Section>
        </div>
      </div>
    </div>
  )
}
