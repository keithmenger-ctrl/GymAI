import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getAthlete, programOptions, sportOptions } from '@/lib/queries/athletes'
import { updateAthlete } from '@/lib/actions/athletes'
import { AthleteForm } from '@/components/athlete/athlete-form'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Edit athlete' }

export default async function EditAthletePage({ params }: PageProps<'/athletes/[id]/edit'>) {
  const s = await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [athlete, programs, sports] = await Promise.all([getAthlete(s, id), programOptions(s), sportOptions(s)])
  if (!athlete) notFound()
  return (
    <div className="max-w-2xl">
      <PageHeader title={`Edit ${athlete.first_name} ${athlete.last_name}`} />
      <AthleteForm
        action={updateAthlete.bind(null, id)}
        programs={programs}
        sports={sports}
        athlete={athlete}
        cancelHref={`/athletes/${id}`}
      />
    </div>
  )
}
