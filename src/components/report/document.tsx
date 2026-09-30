import type { ReportSections, ReportSnapshot } from '@/lib/queries/reports'
import { fmtDate, num } from '@/lib/format'
import { Sparkline } from '@/components/sparkline'

/** The report as a parent sees it. Also the print layout (Save as PDF from the browser). */
export function ReportDocument({
  title, org, snapshot: s, sections, sharedAt,
}: { title: string; org: string; snapshot: ReportSnapshot; sections: ReportSections; sharedAt?: Date | null }) {
  const pct = s.attendance.total ? Math.round((s.attendance.attended / s.attendance.total) * 100) : null
  return (
    <article className="mx-auto max-w-2xl rounded-2xl border border-line bg-card p-6 sm:p-10 print:border-0 print:p-0">
      <header className="border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{org} · Progress report</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{s.athlete}</h1>
        <p className="mt-1 text-muted">
          {s.program ?? 'No program'}{s.level ? ` · ${s.level}` : ''} · {fmtDate(sharedAt ?? s.generated_on)}
        </p>
        <p className="sr-only">{title}</p>
      </header>

      <section className="grid grid-cols-2 gap-4 border-b border-line py-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Attendance</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{s.attendance.attended}<span className="text-base font-normal text-muted"> / {s.attendance.total}</span></p>
          <p className="text-xs text-muted">sessions, last {s.period_days} days{pct !== null ? ` · ${pct}%` : ''}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Level</p>
          <p className="mt-1 text-2xl font-semibold">{s.level ?? '—'}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Current focus</p>
          <p className="mt-1 text-sm font-medium">{s.focus.length ? s.focus.join(', ') : '—'}</p>
        </div>
      </section>

      {s.improvements.length > 0 && (
        <section className="border-b border-line py-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Assessment results</h2>
          <table className="w-full text-sm">
            <tbody>
              {s.improvements.map((i) => (
                <tr key={i.name} className="border-t border-line first:border-0">
                  <td className="py-2">{i.name}</td>
                  <td className="py-2 text-right tabular-nums">
                    {i.series && i.series.length >= 2 ? (
                      <Sparkline name={i.name} unit={i.unit} points={i.series} width={96} height={28} />
                    ) : (
                      <>{num(i.first)} → <span className="font-semibold">{num(i.last)}</span> <span className="text-muted">{i.unit}</span></>
                    )}
                  </td>
                  <td className="w-8 py-2 text-right">
                    {i.better !== null && <span className={i.better ? 'text-ok' : 'text-bad'} aria-label={i.better ? 'improved' : 'declined'}>{i.better ? '▲' : '▼'}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="border-b border-line py-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Coach summary</h2>
        <p className="whitespace-pre-wrap leading-relaxed">{sections.summary}</p>
      </section>
      {sections.next_focus && (
        <section className="pt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Next focus</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{sections.next_focus}</p>
        </section>
      )}
    </article>
  )
}
