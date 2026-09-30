'use client'

import Link from 'next/link'
import { useOptimistic, useState, useTransition } from 'react'
import { Check, Clock, MessageSquarePlus, X } from 'lucide-react'
import { addSessionNote, markRestPresent, setAttendance } from '@/lib/actions/sessions'
import { ActionForm } from '@/components/form'
import { Button, Textarea } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { RosterAthlete } from '@/lib/queries/sessions'

type Status = RosterAthlete['status']

const OPTIONS = [
  { value: 'present', label: 'Present', short: 'P', Icon: Check, on: 'bg-green-600 text-white border-green-600' },
  { value: 'late', label: 'Late', short: 'L', Icon: Clock, on: 'bg-amber-500 text-white border-amber-500' },
  { value: 'absent', label: 'Absent', short: 'A', Icon: X, on: 'bg-red-600 text-white border-red-600' },
] as const

/**
 * Phone-first attendance: one tap per athlete, optimistic updates, tap again to clear.
 * Every change is saved immediately (no separate "save" step to forget on the turf).
 */
export function AttendanceRoster({
  sessionId, roster, athleteBase, testDue = [],
}: { sessionId: string; roster: RosterAthlete[]; athleteBase: string; testDue?: string[] }) {
  const due = new Set(testDue)
  const initial = Object.fromEntries(roster.map((a) => [a.id, a.status])) as Record<string, Status>
  const [statuses, apply] = useOptimistic(initial, (state, patch: Record<string, Status>) => ({ ...state, ...patch }))
  const [, start] = useTransition()
  const [error, setError] = useState<string>()
  const [noteFor, setNoteFor] = useState<string | null>(null)

  const mark = (id: string, status: Status) =>
    start(async () => {
      const next = statuses[id] === status ? null : status
      apply({ [id]: next })
      const r = await setAttendance(sessionId, id, next)
      setError(r?.error)
    })

  const unmarked = roster.filter((a) => !statuses[a.id])
  const markRest = () =>
    start(async () => {
      apply(Object.fromEntries(unmarked.map((a) => [a.id, 'present' as Status])))
      await markRestPresent(sessionId)
    })

  const count = (v: Status) => roster.filter((a) => statuses[a.id] === v).length

  if (roster.length === 0) {
    return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No athletes enrolled in this session.</p>
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          <span className="font-medium text-ink">{count('present')}</span> present ·{' '}
          <span className="font-medium text-ink">{count('late')}</span> late ·{' '}
          <span className="font-medium text-ink">{count('absent')}</span> absent
          {unmarked.length > 0 && <> · {unmarked.length} unmarked</>}
        </p>
        {unmarked.length > 0 && (
          <Button type="button" variant="secondary" onClick={markRest}>
            Mark {unmarked.length === roster.length ? 'all' : 'rest'} present
          </Button>
        )}
      </div>
      {error && <p role="alert" className="mb-2 text-sm text-bad">{error}</p>}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {roster.map((a) => (
          <li key={a.id} className="p-3">
            <div className="flex items-center gap-3">
              <Link href={`${athleteBase}/${a.id}`} className="min-w-0 flex-1">
                <p className="font-medium leading-tight [overflow-wrap:anywhere]">{a.first_name} {a.last_name}</p>
                {(due.has(a.id) || a.last_note) && (
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    {due.has(a.id) && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800">Test due</span>}
                    {a.last_note && <span className="truncate">{a.last_note}</span>}
                  </p>
                )}
              </Link>
              <button
                type="button"
                onClick={() => setNoteFor(noteFor === a.id ? null : a.id)}
                className="flex size-12 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-stone-100"
                aria-label={`Add note for ${a.first_name}`}
                aria-expanded={noteFor === a.id}
              >
                <MessageSquarePlus className="size-5" />
              </button>
              <div className="flex shrink-0 gap-1.5" role="group" aria-label={`Attendance for ${a.first_name} ${a.last_name}`}>
                {OPTIONS.map((o) => {
                  const on = statuses[a.id] === o.value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => mark(a.id, o.value)}
                      aria-pressed={on}
                      aria-label={o.label}
                      title={o.label}
                      className={cn(
                        'flex size-12 items-center justify-center rounded-lg border text-sm font-semibold transition-colors',
                        on ? o.on : 'border-line bg-card text-stone-500 active:bg-stone-100',
                      )}
                    >
                      <o.Icon className="size-5" aria-hidden />
                    </button>
                  )
                })}
              </div>
            </div>
            {noteFor === a.id && (
              <div className="mt-3">
                <ActionForm action={addSessionNote.bind(null, sessionId)} submit="Save note" resetOnSuccess>
                  <input type="hidden" name="athlete_id" value={a.id} />
                  <Textarea name="body" placeholder={`Note about ${a.first_name}`} className="min-h-20" required autoFocus />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="shareable" className="size-5 accent-ink" />
                    Share with parent
                  </label>
                </ActionForm>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
