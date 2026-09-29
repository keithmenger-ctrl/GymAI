import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { getReport } from '@/lib/queries/reports'
import { ReportEditor } from '@/components/report/editor'

export const metadata = { title: 'Progress report' }

export default async function CoachReportPage({ params }: PageProps<'/coach/reports/[id]'>) {
  const s = await requireStaff()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const r = await getReport(s, id)
  if (!r) notFound()
  const athleteHref = `/coach/athletes/${r.athlete_id}`
  return <ReportEditor session={s} id={id} backHref={athleteHref} athleteHref={athleteHref} />
}
