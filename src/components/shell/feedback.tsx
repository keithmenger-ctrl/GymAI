'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { submitFeedback } from '@/lib/actions/feedback'
import type { FormState } from '@/lib/actions/auth'
import { Button, Textarea } from '@/components/ui'

/** Small "Feedback" button + popover. Stores the message with the current page and role. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const path = usePathname()
  const ref = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(async (p: FormState, fd: FormData) => {
    const r = await submitFeedback(p, fd)
    if (r?.message) ref.current?.reset()
    return r
  }, undefined)
  useEffect(() => {
    if (!state?.message) return
    const t = setTimeout(() => setOpen(false), 1500)
    return () => clearTimeout(t)
  }, [state])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-line text-stone-600 hover:bg-stone-100"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <MessageCircle className="size-4" />
      </button>
      {open && (
        <form ref={ref} action={action} className="absolute right-0 top-11 z-30 w-72 space-y-3 rounded-xl border border-line bg-card p-4 shadow-lg">
          <p className="text-sm font-medium">What would make this better?</p>
          <input type="hidden" name="page" value={path} />
          <Textarea name="body" className="min-h-24" placeholder="Anything confusing, missing or annoying…" required autoFocus />
          {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
          {state?.message && <p role="status" className="text-sm text-ok">{state.message}</p>}
          <Button type="submit" size="sm" disabled={pending}>{pending ? 'Sending…' : 'Send feedback'}</Button>
        </form>
      )}
    </div>
  )
}
