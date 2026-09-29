import { requireAdmin } from '@/lib/auth'
import { programOptions, sportOptions } from '@/lib/queries/athletes'
import { createAthlete } from '@/lib/actions/athletes'
import { AthleteForm } from '@/components/athlete/athlete-form'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Add athlete' }

export default async function NewAthletePage() {
  const s = await requireAdmin()
  const [programs, sports] = await Promise.all([programOptions(s), sportOptions(s)])
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add athlete" />
      <AthleteForm action={createAthlete} programs={programs} sports={sports} cancelHref="/athletes" />
    </div>
  )
}
