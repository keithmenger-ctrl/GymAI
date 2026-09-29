import { requireAdmin } from '@/lib/auth'
import { QUERIES, aiEnabled } from '@/lib/ai/queries'
import { Assistant } from '@/components/assistant'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Assistant' }

export default async function AssistantPage() {
  await requireAdmin()
  return (
    <div className="max-w-4xl">
      <PageHeader title="Assistant" subtitle="Quick answers from your facility's data." />
      <Assistant suggestions={QUERIES} aiOn={aiEnabled()} />
    </div>
  )
}
