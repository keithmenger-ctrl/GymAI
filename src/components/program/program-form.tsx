import { ActionForm } from '@/components/form'
import { Field, Input, Select, Textarea } from '@/components/ui'
import type { FormState } from '@/lib/actions/auth'

export function ProgramForm({
  action, sports, program, submit,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>
  sports: { id: string; name: string }[]
  program?: { name: string; description: string | null; sport_id: string | null }
  submit: string
}) {
  return (
    <ActionForm action={action} submit={submit}>
      <Field label="Program name"><Input name="name" defaultValue={program?.name} placeholder="Youth Speed Development" required /></Field>
      <Field label="Description"><Textarea name="description" defaultValue={program?.description ?? ''} placeholder="What athletes learn in this program" /></Field>
      <Field label="Sport" hint="Optional. Leave blank for multi-sport programs.">
        <Select name="sport_id" defaultValue={program?.sport_id ?? ''}>
          <option value="">Any sport</option>
          {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
    </ActionForm>
  )
}
