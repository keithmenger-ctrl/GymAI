import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { programOptions } from '@/lib/queries/athletes'
import { coachOptions, curriculumOptions, getSessionDetail, locationOptions } from '@/lib/queries/sessions'
import { updateSession } from '@/lib/actions/sessions'
import { SessionForm } from '@/components/session/session-form'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Edit session' }

export default async function EditSessionPage({ params }: PageProps<'/schedule/[id]/edit'>) {
  const s = await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [session, programs, coaches, locations, curriculum] = await Promise.all([
    getSessionDetail(s, id), programOptions(s), coachOptions(s), locationOptions(s), curriculumOptions(s),
  ])
  if (!session) notFound()
  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit session" />
      <SessionForm action={updateSession.bind(null, id)} programs={programs} coaches={coaches} locations={locations}
        curriculum={curriculum} session={session} defaultDate={session.date_local} cancelHref={`/schedule/${id}`} />
    </div>
  )
}
