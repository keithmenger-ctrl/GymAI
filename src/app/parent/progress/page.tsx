import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { myAthletes } from '@/lib/queries/parent'
import { Card, EmptyState } from '@/components/ui'

export const metadata = { title: 'Progress' }

export default async function ParentProgressIndex() {
  const s = await requireRole('parent')
  const athletes = await myAthletes(s)
  if (athletes.length === 1) redirect(`/parent/progress/${athletes[0].id}`)
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Progress</h1>
      {athletes.length === 0 ? (
        <EmptyState title="No athletes linked yet" />
      ) : (
        <div className="space-y-2">
          {athletes.map((a) => (
            <Link key={a.id} href={`/parent/progress/${a.id}`}>
              <Card className="mb-2 p-4 font-medium">{a.first_name} {a.last_name}</Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
