import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { listPrograms } from '@/lib/queries/programs'
import { Badge, Card, EmptyState, PageHeader, buttonClass } from '@/components/ui'

export const metadata = { title: 'Programs' }

export default async function ProgramsPage() {
  const s = await requireAdmin()
  const programs = await listPrograms(s)
  return (
    <>
      <PageHeader
        title="Programs"
        subtitle="Programs contain levels. Each level has its own curriculum."
        actions={<Link href="/programs/new" className={buttonClass()}>New program</Link>}
      />
      {programs.length === 0 ? (
        <EmptyState
          title="No programs yet"
          body="Create your first program, add levels, then build the curriculum coaches will follow."
          action={<Link href="/programs/new" className={buttonClass()}>New program</Link>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((p) => {
            const enrolled = p.levels.reduce((n, l) => n + l.enrolled, 0)
            const capacity = p.levels.reduce((n, l) => n + l.capacity, 0)
            return (
              <Link key={p.id} href={`/programs/${p.id}`}>
                <Card className="h-full p-5 transition-colors hover:border-stone-400">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{p.name}</h2>
                    {!p.active && <Badge>Archived</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{p.description ?? 'No description'}</p>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {p.levels.map((l) => (
                      <li key={l.id} className="flex justify-between">
                        <span>{l.name}</span>
                        <span className="tabular-nums text-muted">{l.enrolled} / {l.capacity}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                    {p.levels.length} {p.levels.length === 1 ? 'level' : 'levels'} · {enrolled} / {capacity} enrolled
                  </p>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
