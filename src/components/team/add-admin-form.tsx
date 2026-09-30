'use client'

import { useActionState } from 'react'
import { addAdmin, type TeamState } from '@/lib/actions/team'
import { Button, Field, Input } from '@/components/ui'

export function AddAdminForm() {
  const [state, action, pending] = useActionState(async (p: TeamState, fd: FormData) => addAdmin(p, fd), undefined)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input name="name" required /></Field>
        <Field label="Email"><Input name="email" type="email" required /></Field>
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
      {state?.link && (
        <input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} aria-label="Admin invite link"
          className="h-9 w-full rounded-lg border border-line bg-paper px-2 text-xs" />
      )}
      <Button type="submit" variant="secondary" disabled={pending}>{pending ? 'Adding…' : 'Add admin'}</Button>
    </form>
  )
}
