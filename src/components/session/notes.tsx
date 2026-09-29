import { ActionForm } from '@/components/form'
import { Badge, Textarea } from '@/components/ui'
import { addSessionNote } from '@/lib/actions/sessions'
import { fmtTime } from '@/lib/format'
import type { SessionNote } from '@/lib/queries/sessions'

export function SessionNotes({ sessionId, notes, tz }: { sessionId: string; notes: SessionNote[]; tz: string }) {
  return (
    <div className="space-y-4">
      <ActionForm action={addSessionNote.bind(null, sessionId)} submit="Add session note" variant="secondary" resetOnSuccess>
        <Textarea name="body" placeholder="How did the session go? Anything the next coach should know?" className="min-h-20" required />
      </ActionForm>
      {notes.length > 0 && (
        <ul className="space-y-3 border-t border-line pt-4">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              <p className="text-xs text-muted">
                {n.athlete_name ?? 'Session'} · {n.author ?? 'Staff'} · {fmtTime(n.created_at, tz)}
                {n.shareable && <Badge tone="volt" className="ml-2">Shared with parent</Badge>}
              </p>
              <p className="mt-0.5">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
