import { ActionForm } from '@/components/form'
import { Field, Input, Textarea } from '@/components/ui'
import type { FormState } from '@/lib/actions/auth'
import type { CurriculumItem } from '@/lib/queries/programs'

export function CurriculumForm({
  action, item, nextWeek, submit,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>
  item?: CurriculumItem
  nextWeek?: number
  submit: string
}) {
  return (
    <ActionForm action={action} submit={submit} resetOnSuccess={!item}>
      <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
        <Field label="Week"><Input name="week_number" type="number" min={1} defaultValue={item?.week_number ?? nextWeek ?? 1} required /></Field>
        <Field label="Title"><Input name="title" defaultValue={item?.title} placeholder="Acceleration Mechanics" required /></Field>
      </div>
      <Field label="Description"><Textarea name="description" defaultValue={item?.description ?? ''} className="min-h-16" /></Field>
      <Field label="Coaching objectives"><Textarea name="objectives" defaultValue={item?.objectives ?? ''} className="min-h-16" /></Field>
      <Field label="Exercises / drills" hint="One per line, in session order. These become the session plan.">
        <Textarea name="drills" defaultValue={item?.drills.join('\n') ?? ''} className="min-h-28" placeholder={'Dynamic warm-up\nWall drill\nFalling starts'} />
      </Field>
      <Field label="Coaching cues"><Textarea name="cues" defaultValue={item?.cues ?? ''} className="min-h-16" /></Field>
      <Field label="Notes"><Textarea name="notes" defaultValue={item?.notes ?? ''} className="min-h-16" /></Field>
      <Field label="Video link (optional)"><Input name="video_url" type="url" defaultValue={item?.video_url ?? ''} placeholder="https://" /></Field>
    </ActionForm>
  )
}
