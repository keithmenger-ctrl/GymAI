import { Badge, Card } from '@/components/ui'
import type { SessionDetail } from '@/lib/queries/sessions'

/** "Today's focus" + numbered session plan + curriculum objectives/cues. */
export function SessionPlan({ session }: { session: SessionDetail }) {
  const steps = (session.session_plan ?? '')
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean)
  const c = session.curriculum
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Today&apos;s focus</p>
        <p className="mt-1 text-xl font-semibold tracking-tight">{session.focus ?? 'No focus set'}</p>
        {c && <Badge className="mt-2">Curriculum week {c.week_number}</Badge>}
        {c?.objectives && <p className="mt-3 text-sm"><span className="font-medium">Objective: </span>{c.objectives}</p>}
        {c?.cues && <p className="mt-2 text-sm"><span className="font-medium">Cues: </span>{c.cues}</p>}
        {c?.video_url && (
          <a href={c.video_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline underline-offset-4">Watch demo video</a>
        )}
      </Card>
      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Session plan</p>
        {steps.length ? (
          <ol className="mt-3 space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold tabular-nums">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">No plan written for this session.</p>
        )}
        {session.notes && <p className="mt-4 border-t border-line pt-3 text-sm text-muted">{session.notes}</p>}
      </Card>
    </div>
  )
}
