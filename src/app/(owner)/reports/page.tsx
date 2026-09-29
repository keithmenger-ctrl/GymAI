import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { listReports } from '@/lib/queries/reports'
import { Badge, Card, EmptyState, PageHeader, buttonClass } from '@/components/ui'
import { fmtDate } from '@/lib/format'

export const metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const s = await requireAdmin()
  const reports = await listReports(s)
  return (
    <>
      <PageHeader title="Progress reports" subtitle="Generate a report from any athlete's profile. Drafts stay private until you share them." />
      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          body="Open an athlete and click “Generate progress report”."
          action={<Link href="/athletes" className={buttonClass()}>Go to athletes</Link>}
        />
      ) : (
        <Card className="divide-y divide-line">
          {reports.map((r) => (
            <Link key={r.id} href={`/reports/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-stone-50">
              <span>
                <span className="font-medium">{r.title}</span>
                <span className="block text-xs text-muted">{r.athlete} · {r.author ?? 'Staff'} · {fmtDate(r.created_at, s.timezone)}</span>
              </span>
              <Badge tone={r.status === 'shared' ? 'ok' : 'neutral'}>{r.status === 'shared' ? 'Shared' : 'Draft'}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </>
  )
}
