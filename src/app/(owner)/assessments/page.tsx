import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { dueForReassessment, dueLabel, listAssessmentTypes, recentResults } from '@/lib/queries/assessments'
import { deleteAssessmentType, saveAssessmentType } from '@/lib/actions/assessments'
import { ActionForm, ConfirmButton } from '@/components/form'
import { Badge, Card, EmptyState, Field, Input, PageHeader, Select, buttonClass } from '@/components/ui'
import { fmtDate, num } from '@/lib/format'

export const metadata = { title: 'Assessments' }

function MetricFields({ t }: { t?: { name: string; unit: string; direction: string; category: string; reassess_days: number } }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input name="name" defaultValue={t?.name} placeholder="10 Yard Sprint" required /></Field>
        <Field label="Unit"><Input name="unit" defaultValue={t?.unit} placeholder="sec" required /></Field>
        <Field label="Better when">
          <Select name="direction" defaultValue={t?.direction ?? 'lower'}>
            <option value="lower">Lower</option>
            <option value="higher">Higher</option>
          </Select>
        </Field>
        <Field label="Category"><Input name="category" defaultValue={t?.category ?? 'General'} required /></Field>
      </div>
      <Field label="Reassess every (days)"><Input name="reassess_days" type="number" min={7} defaultValue={t?.reassess_days ?? 60} required /></Field>
    </>
  )
}

export default async function AssessmentsPage() {
  const s = await requireAdmin()
  const [types, due, recent] = await Promise.all([listAssessmentTypes(s), dueForReassessment(s), recentResults(s, 15)])

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Metrics you test, who is due, and the latest results."
        actions={<Link href="/assessments/record" className={buttonClass()}>Record results</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Due for reassessment</h2>
            <span className="text-sm text-muted">{due.length} athletes</span>
          </div>
          {due.length === 0 ? (
            <p className="text-sm text-muted">Everyone is up to date.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {due.map((d) => (
                <li key={d.athlete_id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <Link href={`/athletes/${d.athlete_id}`} className="font-medium hover:underline">{d.name}</Link>
                    <span className="block truncate text-xs text-muted">
                      {d.program ? `${d.program} · ${d.level ?? ''}` : 'No program'}
                    </span>
                  </span>
                  <Badge tone={d.last_assessed ? 'warn' : 'neutral'} className="shrink-0">{dueLabel(d)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Recent results</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">No results recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recent.map((r) => {
                const diff = r.previous === null ? null : Number(r.value) - Number(r.previous)
                const better = diff === null || diff === 0 ? null : r.direction === 'lower' ? diff < 0 : diff > 0
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <Link href={`/athletes/${r.athlete_id}`} className="font-medium hover:underline">{r.athlete}</Link>
                      <span className="block text-xs text-muted">{r.metric} · {fmtDate(r.recorded_on)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {num(r.value)} {r.unit}
                      {better !== null && <span className={better ? 'ml-1.5 text-ok' : 'ml-1.5 text-bad'}>{better ? '▲' : '▼'}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-10 font-semibold">Metrics</h2>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {types.length === 0 ? (
          <EmptyState title="No metrics yet" body="Add the tests you run, like 10-yard sprint or vertical jump." />
        ) : (
          <Card className="divide-y divide-line">
            {types.map((t) => (
              <details key={t.id} className="group px-5 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span>
                    <span className="font-medium">{t.name}</span>{' '}
                    <span className="text-sm text-muted">{t.unit} · {t.direction === 'lower' ? 'lower' : 'higher'} is better</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <Badge>{t.category}</Badge>
                    <span className="tabular-nums">{t.result_count} results</span>
                  </span>
                </summary>
                <div className="mt-4 max-w-md space-y-3">
                  <ActionForm action={saveAssessmentType.bind(null, t.id)} submit="Save" size="sm">
                    <MetricFields t={t} />
                  </ActionForm>
                  {t.result_count === 0 && (
                    <ConfirmButton action={deleteAssessmentType.bind(null, t.id)} label="Delete metric" confirm={`Delete ${t.name}?`} />
                  )}
                </div>
              </details>
            ))}
          </Card>
        )}
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-semibold">Add a metric</h2>
          <ActionForm action={saveAssessmentType.bind(null, null)} submit="Add metric" resetOnSuccess>
            <MetricFields />
          </ActionForm>
        </Card>
      </div>
    </>
  )
}
