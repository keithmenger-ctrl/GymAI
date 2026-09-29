import { Input, Select, Button } from '@/components/ui'
import type { ProgramOption } from '@/lib/queries/athletes'

/** GET form: filters live in the URL so lists are shareable and server-rendered. */
export function AthleteFilters({
  q, status, programId, programs,
}: { q?: string; status?: string; programId?: string; programs: ProgramOption[] }) {
  return (
    <form className="mb-6 flex flex-wrap gap-2">
      <Input name="q" defaultValue={q} placeholder="Search athletes" className="max-w-64" aria-label="Search athletes" />
      <Select name="status" defaultValue={status ?? ''} className="w-36" aria-label="Status">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="trial">Trial</option>
        <option value="paused">Paused</option>
        <option value="inactive">Inactive</option>
      </Select>
      <Select name="program" defaultValue={programId ?? ''} className="w-52" aria-label="Program">
        <option value="">All programs</option>
        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <Button type="submit" variant="secondary">Filter</Button>
    </form>
  )
}
