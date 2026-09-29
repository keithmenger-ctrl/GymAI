import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { listAthletes } from '@/lib/queries/athletes'
import { Card, EmptyState, Input, Button } from '@/components/ui'
import { StatusBadge } from '@/components/athlete/status-badge'
import { relativeDays } from '@/lib/format'

export const metadata = { title: 'Athletes' }

export default async function CoachAthletes({ searchParams }: PageProps<'/coach/athletes'>) {
  const s = await requireStaff()
  const sp = await searchParams
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q
  const athletes = await listAthletes(s, { q })
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Athletes</h1>
      <form className="mt-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search athletes" className="h-12" />
        <Button type="submit" variant="secondary" size="lg">Search</Button>
      </form>
      <div className="mt-4 space-y-2">
        {athletes.length === 0 ? (
          <EmptyState title="No athletes found" />
        ) : (
          athletes.map((a) => (
            <Link key={a.id} href={`/coach/athletes/${a.id}`}>
              <Card className="flex items-center justify-between p-4 active:bg-stone-50">
                <div>
                  <p className="font-medium">{a.first_name} {a.last_name}</p>
                  <p className="text-xs text-muted">
                    {a.program_name ? `${a.program_name} · ${a.level_name ?? '—'}` : 'No program'} · {relativeDays(a.last_attended)}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </Card>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
