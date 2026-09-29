import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getAthlete } from '@/lib/queries/athletes'
import { AthleteProfile } from '@/components/athlete/profile'

export const metadata = { title: 'Progress' }

// RLS returns no row unless this parent is the athlete's guardian, so other athletes 404.
export default async function ParentAthleteProgress({ params }: PageProps<'/parent/progress/[athleteId]'>) {
  const s = await requireRole('parent')
  const { athleteId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(athleteId) || !(await getAthlete(s, athleteId))) notFound()
  return <AthleteProfile session={s} id={athleteId} viewer="parent" tz={s.timezone} />
}
