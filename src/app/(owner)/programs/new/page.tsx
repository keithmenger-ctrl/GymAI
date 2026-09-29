import { requireAdmin } from '@/lib/auth'
import { sportOptions } from '@/lib/queries/athletes'
import { createProgram } from '@/lib/actions/programs'
import { ProgramForm } from '@/components/program/program-form'
import { Card, PageHeader } from '@/components/ui'

export const metadata = { title: 'New program' }

export default async function NewProgramPage() {
  const s = await requireAdmin()
  const sports = await sportOptions(s)
  return (
    <div className="max-w-xl">
      <PageHeader title="New program" subtitle="A Level 1 is created automatically. Add more levels next." />
      <Card className="p-6"><ProgramForm action={createProgram} sports={sports} submit="Create program" /></Card>
    </div>
  )
}
