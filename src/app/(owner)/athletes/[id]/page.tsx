import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { AthleteProfile } from '@/components/athlete/profile'
import { getAthlete } from '@/lib/queries/athletes'

export const metadata = { title: 'Athlete' }

export default async function AthletePage({ params }: PageProps<'/athletes/[id]'>) {
  const s = await requireAdmin()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(await getAthlete(s, id))) notFound()
  return <AthleteProfile session={s} id={id} viewer="admin" tz={s.timezone} editHref={`/athletes/${id}/edit`} />
}
