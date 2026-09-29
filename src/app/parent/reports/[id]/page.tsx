import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getReport } from '@/lib/queries/reports'
import { ReportDocument } from '@/components/report/document'
import { PrintButton } from '@/components/report/print-button'

export const metadata = { title: 'Progress report' }

// RLS only returns shared reports for the parent's own athletes; anything else 404s.
export default async function ParentReportPage({ params }: PageProps<'/parent/reports/[id]'>) {
  const s = await requireRole('parent')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const r = await getReport(s, id)
  if (!r) notFound()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/parent/progress/${r.athlete_id}`} className="text-sm text-muted">← Progress</Link>
        <PrintButton />
      </div>
      <ReportDocument title={r.title} org={r.org_name} snapshot={r.snapshot} sections={r.sections} sharedAt={r.shared_at} />
    </div>
  )
}
