import { requireStaff } from '@/lib/auth'
import { Recorder } from '@/components/assessment/recorder'

export const metadata = { title: 'Assessments' }

export default async function CoachAssessmentsPage({ searchParams }: PageProps<'/coach/assessments'>) {
  const s = await requireStaff()
  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Record results</h1>
      <Recorder session={s} basePath="/coach/assessments" params={await searchParams} />
    </>
  )
}
