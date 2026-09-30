'use client'

import { useActionState } from 'react'
import { Button, Field, Input } from '@/components/ui'
import type { FormState } from '@/lib/actions/auth'

type Props = {
  action: (s: FormState, fd: FormData) => Promise<FormState>
  fields: { name: string; label: string; type?: string; autoComplete?: string; placeholder?: string; hint?: string; defaultChecked?: boolean }[]
  submit: string
}

export function AuthForm({ action, fields, submit }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined)
  return (
    <form action={formAction} className="space-y-4">
      {fields.map((f) =>
        f.type === 'checkbox' ? (
          <label key={f.name} className="flex items-start gap-3 rounded-lg border border-line bg-card p-3 text-sm">
            <input type="checkbox" name={f.name} defaultChecked={f.defaultChecked} className="mt-0.5 size-4 accent-ink" />
            <span>
              <span className="font-medium">{f.label}</span>
              {f.hint && <span className="block text-muted">{f.hint}</span>}
            </span>
          </label>
        ) : (
          <Field key={f.name} label={f.label}>
            <Input name={f.name} type={f.type ?? 'text'} autoComplete={f.autoComplete} placeholder={f.placeholder} required />
          </Field>
        ),
      )}
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'One moment…' : submit}
      </Button>
    </form>
  )
}
