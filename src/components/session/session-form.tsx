'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button, Card, Field, Input, Select, Textarea, buttonClass } from '@/components/ui'
import type { FormState } from '@/lib/actions/auth'
import type { ProgramOption } from '@/lib/queries/athletes'
import type { CurriculumOption, Option, SessionDetail } from '@/lib/queries/sessions'

type Props = {
  action: (s: FormState, fd: FormData) => Promise<FormState>
  programs: ProgramOption[]
  coaches: Option[]
  locations: Option[]
  curriculum: CurriculumOption[]
  session?: SessionDetail
  defaultDate: string
  cancelHref: string
}

export function SessionForm({ action, programs, coaches, locations, curriculum, session, defaultDate, cancelHref }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [programId, setProgramId] = useState(session?.program_id ?? programs[0]?.id ?? '')
  const [levelId, setLevelId] = useState(session?.level_id ?? '')
  const levels = programs.find((p) => p.id === programId)?.levels ?? []
  const weeks = curriculum.filter((c) => c.level_id === levelId)
  const editing = Boolean(session)

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Program">
            <Select name="program_id" value={programId} onChange={(e) => { setProgramId(e.target.value); setLevelId('') }} required>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Level">
            <Select name="level_id" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
              <option value="">All levels</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Curriculum week" hint={editing ? undefined : 'Fills the focus and session plan if you leave them blank.'}>
            <Select name="curriculum_item_id" defaultValue={session?.curriculum_item_id ?? ''} key={levelId} disabled={!levelId}>
              <option value="">None</option>
              {weeks.map((w) => <option key={w.id} value={w.id}>Week {w.week_number}: {w.title}</option>)}
            </Select>
          </Field>
          <Field label="Coach">
            <Select name="coach_id" defaultValue={session?.coach_id ?? ''}>
              <option value="">Unassigned</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date"><Input name="date" type="date" defaultValue={session?.date_local ?? defaultDate} required /></Field>
          <Field label="Start"><Input name="start" type="time" defaultValue={session?.start_local ?? '15:00'} required /></Field>
          <Field label="End"><Input name="end" type="time" defaultValue={session?.end_local ?? '16:00'} required /></Field>
          <Field label="Location">
            <Select name="location_id" defaultValue={session?.location_id ?? locations[0]?.id ?? ''}>
              <option value="">—</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Max athletes"><Input name="max_athletes" type="number" min={1} defaultValue={session?.max_athletes ?? 12} required /></Field>
          {!editing && (
            <Field label="Repeat weekly">
              <Select name="repeat_weeks" defaultValue="1">
                {[1, 2, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Just once' : `${n} weeks`}</option>)}
              </Select>
            </Field>
          )}
        </div>
        {!editing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="auto_enroll" defaultChecked className="size-4 accent-ink" />
            Enroll the level&apos;s active athletes automatically (up to max)
          </label>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <Field label="Focus"><Input name="focus" defaultValue={session?.focus ?? ''} placeholder={editing ? '' : 'From curriculum week'} /></Field>
        <Field label="Session plan" hint="One step per line.">
          <Textarea name="session_plan" defaultValue={session?.session_plan ?? ''} placeholder={editing ? '' : 'From curriculum week'} className="min-h-32" />
        </Field>
        <Field label="Notes for the coach"><Textarea name="notes" defaultValue={session?.notes ?? ''} className="min-h-16" /></Field>
      </Card>

      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <div className="flex gap-3">
        <Button type="submit" size="lg" disabled={pending}>{pending ? 'Saving…' : editing ? 'Save changes' : 'Create session'}</Button>
        <Link href={cancelHref} className={buttonClass('secondary', 'lg')}>Cancel</Link>
      </div>
    </form>
  )
}
