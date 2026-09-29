'use client'

import { useActionState } from 'react'
import { Button, Field, Input } from '@/components/ui'
import type { FormState } from '@/lib/actions/auth'

type Props = {
  action: (s: FormState, fd: FormData) => Promise<FormState>
  fields: { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string }[]
  submit: string
}

export function AuthForm({ action, fields, submit }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  return (
    <form action={formAction} className="space-y-4">
      {fields.map((f) => (
        <Field key={f.name} label={f.label}>
          <Input name={f.name} type={f.type ?? 'text'} autoComplete={f.autoComplete} placeholder={f.placeholder} required />
        </Field>
      ))}
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'One moment…' : submit}
      </Button>
    </form>
  )
}
