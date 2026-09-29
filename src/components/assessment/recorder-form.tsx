'use client'

import { useActionState, useState } from 'react'
import { Button, Input } from '@/components/ui'
import { recordResults, type RecordState } from '@/lib/actions/assessments'
import { cn } from '@/lib/cn'
import type { RecorderAthlete } from '@/lib/queries/assessments'

const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const fmt = (n: number) => String(Number(n.toFixed(2)))

/** Testing-day entry: one numeric field per athlete, previous result + live delta beside it. */
export function RecorderForm({
  typeId, unit, direction, athletes, today,
}: { typeId: string; unit: string; direction: 'lower' | 'higher'; athletes: RecorderAthlete[]; today: string }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [state, action, pending] = useActionState(async (prev: RecordState, fd: FormData) => {
    const r = await recordResults(prev, fd)
    if (r?.saved) setValues({})
    return r
  }, undefined)
  const filled = Object.values(values).filter((v) => v.trim() !== '').length

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type_id" value={typeId} />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">Test date</span>
        <Input type="date" name="recorded_on" defaultValue={today} max={today} className="h-12 w-44" required />
      </label>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {athletes.map((a) => {
          const v = values[a.id] ?? ''
          const n = Number(v.replace(',', '.'))
          const prev = a.previous === null ? null : Number(a.previous)
          const diff = v.trim() !== '' && Number.isFinite(n) && prev !== null ? n - prev : null
          const better = diff === null || diff === 0 ? null : direction === 'lower' ? diff < 0 : diff > 0
          return (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.name}</p>
                <p className="text-xs text-muted">
                  {prev === null ? 'No previous result' : <>Last: {fmt(prev)} {unit} · {short(a.previous_on!)}</>}
                  {diff !== null && diff !== 0 && (
                    <span className={cn('ml-2 font-medium', better ? 'text-ok' : 'text-bad')}>
                      {diff > 0 ? '+' : ''}{fmt(diff)} {better ? '▲' : '▼'}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  name={`v:${a.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={v}
                  onChange={(e) => setValues((s) => ({ ...s, [a.id]: e.target.value }))}
                  aria-label={`${a.name} result in ${unit}`}
                  className="h-12 w-24 text-right text-base tabular-nums"
                  placeholder="—"
                />
                <span className="w-9 text-sm text-muted">{unit}</span>
              </div>
            </li>
          )
        })}
      </ul>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-ok">Saved {state.saved} {state.saved === 1 ? 'result' : 'results'}.</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending || filled === 0}>
        {pending ? 'Saving…' : filled ? `Save ${filled} ${filled === 1 ? 'result' : 'results'}` : 'Enter results to save'}
      </Button>
    </form>
  )
}
