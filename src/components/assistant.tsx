'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { ask, saveDraftReport, type AskState } from '@/lib/actions/assistant'
import { Badge, Button, Card, Field, Input, Textarea } from '@/components/ui'

type Props = { suggestions: { id: string; label: string; needsAthlete?: boolean }[]; aiOn: boolean }

export function Assistant({ suggestions, aiOn }: Props) {
  const [state, action, pending] = useActionState(async (p: AskState, fd: FormData) => ask(p, fd), undefined)
  const r = state?.result
  return (
    <div className="space-y-6">
      <form action={action} className="flex gap-2">
        <Input name="question" placeholder="Ask about your athletes, e.g. “Summarize Johnny’s last 60 days”" className="h-12 text-base" aria-label="Question" />
        <Button type="submit" size="lg" disabled={pending}>{pending ? 'Thinking…' : 'Ask'}</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {suggestions.filter((q) => !q.needsAthlete).map((q) => (
          <form key={q.id} action={action}>
            <input type="hidden" name="query" value={q.id} />
            <button className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm hover:bg-stone-100" disabled={pending}>{q.label}</button>
          </form>
        ))}
      </div>
      <p className="text-xs text-muted">
        Answers come from your academy&apos;s data (read-only). {aiOn ? 'Drafted text is written by Claude from those facts.' : 'AI drafting is off (no ANTHROPIC_API_KEY): drafts use a built-in template.'} The assistant never changes anything on its own.
      </p>

      {r && (
        <Card className="p-6" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{r.title}</h2>
            {'source' in r && <Badge tone={r.source === 'claude' ? 'volt' : 'neutral'}>{r.source === 'claude' ? 'Drafted by Claude' : 'Template draft'}</Badge>}
          </div>
          {r.kind === 'help' && <p className="text-sm text-muted">{r.text}</p>}
          {r.kind === 'table' && (
            <>
              <p className="mb-4 text-sm">{r.summary}</p>
              {r.table.rows.length > 0 && <ResultTable table={r.table} />}
            </>
          )}
          {r.kind === 'summary' && (
            <>
              <p className="mb-5 leading-relaxed">{r.text}</p>
              <ResultTable table={r.facts} />
            </>
          )}
          {r.kind === 'draft' && (
            <form action={saveDraftReport} className="space-y-4">
              <input type="hidden" name="athlete_id" value={r.athleteId} />
              <Field label="Coach summary"><Textarea name="summary" defaultValue={r.sections.summary} className="min-h-40" key={r.sections.summary} /></Field>
              <Field label="Next focus"><Textarea name="next_focus" defaultValue={r.sections.next_focus} className="min-h-20" /></Field>
              <p className="text-xs text-muted">Review and edit. Saving creates a <strong>draft</strong> report you can check before sharing with the parent.</p>
              <Button type="submit">Save as draft report</Button>
            </form>
          )}
        </Card>
      )}
    </div>
  )
}

function ResultTable({ table }: { table: { columns: string[]; rows: { cells: string[]; href?: string }[] } }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">{table.columns.map((c) => <th key={c} className="py-2 pr-4 font-medium">{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              {row.cells.map((c, j) => (
                <td key={j} className="py-2 pr-4">{j === 0 && row.href ? <Link href={row.href} className="font-medium hover:underline">{c}</Link> : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
