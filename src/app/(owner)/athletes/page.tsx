import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { listAthletes, programOptions } from '@/lib/queries/athletes'
import { Badge, Card, EmptyState, PageHeader, buttonClass } from '@/components/ui'
import { StatusBadge } from '@/components/athlete/status-badge'
import { AthleteFilters } from '@/components/athlete/filters'
import { daysSince, relativeDays } from '@/lib/format'

export const metadata = { title: 'Athletes' }

export default async function AthletesPage({ searchParams }: PageProps<'/athletes'>) {
  const s = await requireAdmin()
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const f = { q: one(sp.q), status: one(sp.status), programId: one(sp.program) }
  const [athletes, programs] = await Promise.all([listAthletes(s, f), programOptions(s)])
  const filtered = Boolean(f.q || f.status || f.programId)

  return (
    <>
      <PageHeader
        title="Athletes"
        subtitle={`${athletes.length} ${filtered ? 'matching' : 'total'}`}
        actions={<><Link href="/athletes/import" className={buttonClass('secondary')}>Import CSV</Link><Link href="/athletes/new" className={buttonClass()}>Add athlete</Link></>}
      />
      <AthleteFilters {...f} programs={programs} />
      {athletes.length === 0 ? (
        <EmptyState
          title={filtered ? 'No athletes match those filters' : 'No athletes yet'}
          body={filtered ? 'Try clearing the search or filters.' : 'Add your first athlete to start building their development record.'}
          action={!filtered && <div className="flex gap-2"><Link href="/athletes/import" className={buttonClass('secondary')}>Import CSV</Link><Link href="/athletes/new" className={buttonClass()}>Add athlete</Link></div>}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3 font-medium">Athlete</th>
                <th className="px-3 py-3 font-medium">Program</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Last attended</th>
                <th className="px-5 py-3 text-right font-medium">30 days</th>
              </tr>
            </thead>
            <tbody>
              {athletes.map((a) => {
                const stale = a.status === 'active' && (daysSince(a.last_attended) ?? 999) >= 14
                return (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-stone-50">
                    <td className="px-5 py-3">
                      <Link href={`/athletes/${a.id}`} className="font-medium after:absolute after:inset-0 relative hover:underline">
                        {a.first_name} {a.last_name}
                      </Link>
                      <p className="text-xs text-muted">
                        {[a.age !== null && `Age ${a.age}`, a.sport, a.position].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {a.program_name ? <>{a.program_name}<span className="text-muted"> · {a.level_name ?? '—'}</span></> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-3 py-3">
                      {relativeDays(a.last_attended)} {stale && <Badge tone="warn" className="ml-1">14+ days</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{a.attended_30d}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  )
}
