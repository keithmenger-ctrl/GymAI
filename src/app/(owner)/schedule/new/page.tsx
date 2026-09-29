import { requireAdmin } from '@/lib/auth'
import { programOptions } from '@/lib/queries/athletes'
import { coachOptions, curriculumOptions, locationOptions, weekStart } from '@/lib/queries/sessions'
import { createSession } from '@/lib/actions/sessions'
import { SessionForm } from '@/components/session/session-form'
import { EmptyState, PageHeader } from '@/components/ui'
import Link from 'next/link'
import { buttonClass } from '@/components/ui'

export const metadata = { title: 'New session' }

export default async function NewSessionPage({ searchParams }: PageProps<'/schedule/new'>) {
  const s = await requireAdmin()
  const sp = await searchParams
  const [programs, coaches, locations, curriculum, wk] = await Promise.all([
    programOptions(s), coachOptions(s), locationOptions(s), curriculumOptions(s), weekStart(s),
  ])
  const date = typeof sp.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : wk.today
  return (
    <div className="max-w-3xl">
      <PageHeader title="New session" />
      {programs.length === 0 ? (
        <EmptyState title="Create a program first" body="Sessions belong to a program." action={<Link href="/programs/new" className={buttonClass()}>New program</Link>} />
      ) : (
        <SessionForm action={createSession} programs={programs} coaches={coaches} locations={locations}
          curriculum={curriculum} defaultDate={date} cancelHref="/schedule" />
      )}
    </div>
  )
}
