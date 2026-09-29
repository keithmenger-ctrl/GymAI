import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { Recorder } from '@/components/assessment/recorder'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Record results' }

export default async function OwnerRecordPage({ searchParams }: PageProps<'/assessments/record'>) {
  const s = await requireAdmin()
  return (
    <div className="max-w-2xl">
      <Link href="/assessments" className="mb-4 inline-block text-sm text-muted hover:text-ink">← Assessments</Link>
      <PageHeader title="Record results" />
      <Recorder session={s} basePath="/assessments/record" params={await searchParams} />
    </div>
  )
}
