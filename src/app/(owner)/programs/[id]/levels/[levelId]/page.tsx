import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getLevel } from '@/lib/queries/programs'
import { deleteCurriculumItem, deleteLevel, saveCurriculumItem } from '@/lib/actions/programs'
import { CurriculumForm } from '@/components/program/curriculum-form'
import { ConfirmButton } from '@/components/form'
import { Card, EmptyState, PageHeader } from '@/components/ui'

export const metadata = { title: 'Curriculum' }

export default async function LevelPage({ params }: PageProps<'/programs/[id]/levels/[levelId]'>) {
  const s = await requireAdmin()
  const { id, levelId } = await params
  if (![id, levelId].every((v) => /^[0-9a-f-]{36}$/i.test(v))) notFound()
  const level = await getLevel(s, levelId)
  if (!level || level.program_id !== id) notFound()
  const nextWeek = level.items.reduce((m, i) => Math.max(m, i.week_number), 0) + 1

  return (
    <>
      <Link href={`/programs/${id}`} className="mb-4 inline-block text-sm text-muted hover:text-ink">← {level.program_name}</Link>
      <PageHeader
        title={`${level.name} curriculum`}
        subtitle={`${level.program_name} · ${level.enrolled} / ${level.capacity} athletes enrolled`}
        actions={
          <ConfirmButton
            action={deleteLevel.bind(null, id, levelId)}
            label="Delete level"
            confirm={`Delete ${level.name} and its ${level.items.length} curriculum weeks? This cannot be undone.`}
            disabled={level.enrolled > 0}
          />
        }
      />
      {level.enrolled > 0 && <p className="-mt-4 mb-6 text-xs text-muted">Move enrolled athletes to another level before deleting.</p>}

      <div className="grid gap-8 lg:grid-cols-[1fr_26rem]">
        <div className="space-y-4">
          {level.items.length === 0 ? (
            <EmptyState title="No curriculum yet" body="Add the first week on the right. Drills become the session plan coaches see." />
          ) : (
            level.items.map((i) => (
              <Card key={i.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">Week {i.week_number}</p>
                    <h3 className="mt-0.5 font-semibold">{i.title}</h3>
                  </div>
                  <ConfirmButton
                    action={deleteCurriculumItem.bind(null, id, levelId, i.id)}
                    label="Delete"
                    confirm={`Delete week ${i.week_number}: ${i.title}?`}
                  />
                </div>
                {i.description && <p className="mt-2 text-sm text-muted">{i.description}</p>}
                {i.objectives && (
                  <p className="mt-3 text-sm"><span className="font-medium">Objectives: </span>{i.objectives}</p>
                )}
                {i.drills.length > 0 && (
                  <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm">
                    {i.drills.map((d, n) => <li key={n}>{d}</li>)}
                  </ol>
                )}
                {i.cues && <p className="mt-3 text-sm"><span className="font-medium">Cues: </span>{i.cues}</p>}
                {i.video_url && (
                  <a href={i.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline underline-offset-4">Watch video</a>
                )}
                <details className="mt-4 border-t border-line pt-3">
                  <summary className="cursor-pointer text-sm font-medium">Edit</summary>
                  <div className="mt-4">
                    <CurriculumForm action={saveCurriculumItem.bind(null, id, levelId, i.id)} item={i} submit="Save changes" />
                  </div>
                </details>
              </Card>
            ))
          )}
        </div>
        <Card className="h-fit p-5 lg:sticky lg:top-24">
          <h2 className="mb-4 font-semibold">Add a week</h2>
          <CurriculumForm action={saveCurriculumItem.bind(null, id, levelId, null)} nextWeek={nextWeek} submit="Add week" />
        </Card>
      </div>
    </>
  )
}
