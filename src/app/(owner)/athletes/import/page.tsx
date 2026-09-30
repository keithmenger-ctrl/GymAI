import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { ImportForm } from '@/components/athlete/import-form'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Import athletes' }

export default async function ImportAthletesPage() {
  await requireAdmin()
  return (
    <div className="max-w-5xl">
      <Link href="/athletes" className="mb-4 inline-block text-sm text-muted hover:text-ink">← Athletes</Link>
      <PageHeader
        title="Import athletes"
        subtitle="Upload a CSV exported from your current system or a spreadsheet. You'll see every row before anything is saved."
      />
      <ImportForm />
    </div>
  )
}
