import Link from 'next/link'
import type { Session } from '@/lib/auth'
import { getReport } from '@/lib/queries/reports'
import { deleteReport, saveReport, setReportShared } from '@/lib/actions/reports'
import { ActionForm, ConfirmButton } from '@/components/form'
import { Badge, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { ReportDocument } from './document'
import { PrintButton } from './print-button'
import { fmtDate } from '@/lib/format'

/** Staff view: edit the text on the left, live-rendered report on the right, share when ready. */
export async function ReportEditor({ session, id, backHref, athleteHref }: {
  session: Session; id: string; backHref: string; athleteHref: string
}) {
  const r = await getReport(session, id)
  if (!r) return null
  const shared = r.status === 'shared'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href={backHref} className="text-sm text-muted hover:text-ink">← Back</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{r.title}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <Badge tone={shared ? 'ok' : 'neutral'}>{shared ? `Shared ${fmtDate(r.shared_at, session.timezone)}` : 'Draft · not visible to parents'}</Badge>
            <Link href={athleteHref} className="underline underline-offset-4">{r.athlete}</Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <form action={setReportShared.bind(null, id, !shared)}>
            <Button variant={shared ? 'secondary' : 'primary'}>{shared ? 'Unshare' : 'Share with parent'}</Button>
          </form>
          {!shared && <ConfirmButton action={deleteReport.bind(null, id)} label="Delete draft" confirm="Delete this draft report?" />}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <Card className="h-fit p-5 print:hidden">
          <h2 className="mb-1 font-semibold">Edit before sharing</h2>
          <p className="mb-4 text-sm text-muted">Numbers come from attendance and assessment records. The text is a starting draft — make it sound like you.</p>
          <ActionForm action={saveReport.bind(null, id)} submit="Save">
            <Field label="Title"><Input name="title" defaultValue={r.title} required /></Field>
            <Field label="Coach summary"><Textarea name="summary" defaultValue={r.sections.summary} className="min-h-48" required /></Field>
            <Field label="Next focus"><Textarea name="next_focus" defaultValue={r.sections.next_focus} className="min-h-24" /></Field>
          </ActionForm>
        </Card>
        <ReportDocument title={r.title} org={r.org_name} snapshot={r.snapshot} sections={r.sections} sharedAt={r.shared_at} />
      </div>
    </div>
  )
}
