import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getProgram } from '@/lib/queries/programs'
import { sportOptions } from '@/lib/queries/athletes'
import { createLevel, setProgramActive, updateLevel, updateProgram } from '@/lib/actions/programs'
import { ProgramForm } from '@/components/program/program-form'
import { ActionForm } from '@/components/form'
import { Badge, Button, Card, Field, Input, PageHeader, buttonClass } from '@/components/ui'

export const metadata = { title: 'Program' }

export default async function ProgramPage({ params }: PageProps<'/programs/[id]'>) {
  const s = await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [program, sports] = await Promise.all([getProgram(s, id), sportOptions(s)])
  if (!program) notFound()

  return (
    <>
      <Link href="/programs" className="mb-4 inline-block text-sm text-muted hover:text-ink">← Programs</Link>
      <PageHeader
        title={program.name}
        subtitle={program.description ?? undefined}
        actions={
          <form action={setProgramActive.bind(null, id, !program.active)}>
            <Button variant="secondary">{program.active ? 'Archive' : 'Restore'}</Button>
          </form>
        }
      />
      {!program.active && <Badge className="mb-4">Archived</Badge>}

      <h2 className="mb-3 font-semibold">Levels</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {program.levels.map((l) => {
          const pct = Math.min(100, Math.round((l.enrolled / l.capacity) * 100))
          return (
            <Card key={l.id} className="p-5">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{l.name}</h3>
                <Link href={`/programs/${id}/levels/${l.id}`} className={buttonClass('secondary', 'sm')}>Curriculum</Link>
              </div>
              <p className="mt-3 text-sm tabular-nums">
                {l.enrolled} <span className="text-muted">/ {l.capacity} athletes</span>
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-stone-100">
                <div className={`h-full rounded-full ${pct >= 90 ? 'bg-warn' : 'bg-ink'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-xs text-muted">{l.weeks} {l.weeks === 1 ? 'week' : 'weeks'} of curriculum</p>
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-medium">Edit level</summary>
                <ActionForm action={updateLevel.bind(null, id, l.id)} submit="Save" size="sm" className="mt-3">
                  <Field label="Name"><Input name="name" defaultValue={l.name} required /></Field>
                  <Field label="Capacity"><Input name="capacity" type="number" min={1} defaultValue={l.capacity} required /></Field>
                </ActionForm>
              </details>
            </Card>
          )
        })}
        <Card className="border-dashed p-5">
          <h3 className="font-semibold">Add a level</h3>
          <ActionForm action={createLevel.bind(null, id)} submit="Add level" size="sm" className="mt-3" resetOnSuccess>
            <Field label="Name"><Input name="name" placeholder={`Level ${program.levels.length + 1}`} required /></Field>
            <Field label="Capacity"><Input name="capacity" type="number" min={1} defaultValue={12} required /></Field>
          </ActionForm>
        </Card>
      </div>

      <h2 className="mb-3 mt-10 font-semibold">Program details</h2>
      <Card className="max-w-xl p-6">
        <ProgramForm action={updateProgram.bind(null, id)} sports={sports} program={program} submit="Save changes" />
      </Card>
    </>
  )
}
