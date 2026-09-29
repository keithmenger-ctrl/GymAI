'use client'

import { useActionState, useRef } from 'react'
import { Button } from '@/components/ui'
import type { FormState } from '@/lib/actions/auth'
import { cn } from '@/lib/cn'

/**
 * Generic server-action form: shows pending state, validation error, and a success message.
 * Actions either redirect on success or return { message }.
 */
export function ActionForm({
  action, children, submit, className, resetOnSuccess, variant = 'primary', size = 'md',
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>
  children: React.ReactNode
  submit: string
  className?: string
  resetOnSuccess?: boolean
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd)
    if (resetOnSuccess && r?.message) ref.current?.reset()
    return r
  }, undefined)
  return (
    <form ref={ref} action={formAction} className={cn('space-y-4', className)}>
      {children}
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
      <Button type="submit" variant={variant} size={size} disabled={pending}>{pending ? 'Saving…' : submit}</Button>
    </form>
  )
}

/** Small button that asks for confirmation before running a destructive server action. */
export function ConfirmButton({
  action, label, confirm, disabled,
}: { action: () => Promise<FormState | void>; label: string; confirm: string; disabled?: boolean }) {
  return (
    <form
      action={async () => { await action() }}
      onSubmit={(e) => { if (!window.confirm(confirm)) e.preventDefault() }}
    >
      <Button type="submit" variant="danger" size="sm" disabled={disabled}>{label}</Button>
    </form>
  )
}
