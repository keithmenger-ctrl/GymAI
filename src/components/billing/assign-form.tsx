'use client'

import { useActionState } from 'react'
import { Button, Field, Select } from '@/components/ui'
import { assignMembership, type AssignState } from '@/lib/actions/billing'

export function AssignMembershipForm({
  athletes, plans,
}: { athletes: { id: string; name: string; program: string | null }[]; plans: { id: string; name: string; price: string }[] }) {
  const [state, action, pending] = useActionState(async (p: AssignState, fd: FormData) => assignMembership(p, fd), undefined)
  return (
    <form action={action} className="space-y-4">
      <Field label="Athlete">
        <Select name="athlete_id" required>
          {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}{a.program ? ` · ${a.program}` : ''}</option>)}
        </Select>
      </Field>
      <Field label="Plan">
        <Select name="plan_id" required>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.price}</option>)}
        </Select>
      </Field>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
      {state?.checkoutUrl && (
        <input readOnly value={state.checkoutUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Checkout link"
          className="h-9 w-full rounded-lg border border-line bg-paper px-2 text-xs" />
      )}
      <Button type="submit" disabled={pending || plans.length === 0}>{pending ? 'Creating…' : 'Start membership'}</Button>
    </form>
  )
}
