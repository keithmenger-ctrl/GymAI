import { notFound } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { AthleteProfile } from '@/components/athlete/profile'
import { getAthlete } from '@/lib/queries/athletes'

export const metadata = { title: 'Athlete' }

export default async function CoachAthletePage({ params }: PageProps<'/coach/athletes/[id]'>) {
  const s = await requireStaff()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await getAthlete(s, id))) notFound()
  return <AthleteProfile session={s} id={id} viewer="coach" tz={s.timezone} />
}
