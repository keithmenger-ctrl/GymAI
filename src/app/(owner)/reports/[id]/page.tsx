import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getReport } from '@/lib/queries/reports'
import { ReportEditor } from '@/components/report/editor'

export const metadata = { title: 'Progress report' }

export default async function OwnerReportPage({ params }: PageProps<'/reports/[id]'>) {
  const s = await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const r = await getReport(s, id)
  if (!r) notFound()
  return <ReportEditor session={s} id={id} backHref="/reports" athleteHref={`/athletes/${r.athlete_id}`} />
}
