'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Field, Input, Select, Textarea, buttonClass } from '@/components/ui'
import type { FormState } from '@/lib/actions/auth'
import type { AthleteDetail, ProgramOption } from '@/lib/queries/athletes'

type Props = {
  action: (s: FormState, fd: FormData) => Promise<FormState>
  programs: ProgramOption[]
  sports: { id: string; name: string }[]
  athlete?: AthleteDetail
  cancelHref: string
}

export function AthleteForm({ action, programs, sports, athlete, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [programId, setProgramId] = useState(athlete?.current_program_id ?? '')
  const levels = programs.find((p) => p.id === programId)?.levels ?? []
  const g = athlete?.guardians[0]

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Athlete</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><Input name="first_name" defaultValue={athlete?.first_name} required /></Field>
          <Field label="Last name"><Input name="last_name" defaultValue={athlete?.last_name} required /></Field>
          <Field label="Date of birth"><Input name="date_of_birth" type="date" defaultValue={athlete?.date_of_birth ?? ''} /></Field>
          <Field label="Join date"><Input name="join_date" type="date" defaultValue={athlete?.join_date} /></Field>
          <Field label="Sport">
            <Select name="sport_id" defaultValue={athlete?.sport_id ?? ''}>
              <option value="">—</option>
              {sports.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Position"><Input name="position" defaultValue={athlete?.position ?? ''} /></Field>
          <Field label="School / team"><Input name="school_team" defaultValue={athlete?.school_team ?? ''} /></Field>
          <Field label="Status">
            <Select name="status" defaultValue={athlete?.status ?? 'active'}>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="paused">Paused</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Program</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current program">
            <Select name="program_id" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">None</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Current level">
            <Select name="level_id" defaultValue={athlete?.current_level_id ?? ''} key={programId} disabled={!programId}>
              <option value="">None</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Parent / guardian</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input name="guardian_name" defaultValue={g?.name ?? ''} /></Field>
          <Field label="Email"><Input name="guardian_email" type="email" defaultValue={g?.email ?? ''} /></Field>
          <Field label="Phone"><Input name="guardian_phone" type="tel" defaultValue={g?.phone ?? ''} /></Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-semibold">Notes</h2>
        <Textarea name="notes" defaultValue={athlete?.notes ?? ''} placeholder="Internal notes about this athlete" />
      </Card>

      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={pending}>{pending ? 'Saving…' : athlete ? 'Save changes' : 'Add athlete'}</Button>
        <Link href={cancelHref} className={buttonClass('secondary', 'lg')}>Cancel</Link>
      </div>
    </form>
  )
}
