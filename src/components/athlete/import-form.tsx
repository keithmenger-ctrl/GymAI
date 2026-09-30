'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { commitAthleteImport, previewAthleteImport, type ImportState } from '@/lib/actions/import'
import { Badge, Button, Card, Textarea, buttonClass } from '@/components/ui'

export function ImportForm() {
  const [preview, previewAction, previewing] = useActionState(async (p: ImportState, fd: FormData) => previewAthleteImport(p, fd), undefined)
  const [done, commitAction, committing] = useActionState(async (p: ImportState, fd: FormData) => commitAthleteImport(p, fd), undefined)

  if (done?.imported !== undefined && !done.error) {
    const skipped = done.rows.length - done.imported
    return (
      <Card className="p-6">
        <p role="status" className="text-lg font-semibold">Imported {done.imported} {done.imported === 1 ? 'athlete' : 'athletes'}.</p>
        {skipped > 0 && <p className="mt-1 text-sm text-muted">{skipped} rows were skipped (already in AcademyOS or had errors).</p>}
        <div className="mt-4 flex gap-2">
          <Link href="/athletes" className={buttonClass()}>View athletes</Link>
          <Link href="/athletes/import" className={buttonClass('secondary')}>Import another file</Link>
        </div>
      </Card>
    )
  }

  const rows = preview?.rows ?? []
  const ok = rows.filter((r) => !r.errors.length && !r.duplicate)
  const bad = rows.filter((r) => r.errors.length)
  const dup = rows.filter((r) => r.duplicate && !r.errors.length)

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <form action={previewAction} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="file">CSV file</label>
            <a href="/athletes/import/template" download className="text-sm underline underline-offset-4">Download the template</a>
          </div>
          <input id="file" name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm file:mr-3 file:h-10 file:rounded-lg file:border file:border-line file:bg-card file:px-4 file:text-sm file:font-medium" />
          <details>
            <summary className="cursor-pointer text-sm text-muted">…or paste rows from a spreadsheet (CSV)</summary>
            <Textarea name="text" className="mt-2 min-h-32 font-mono text-xs" placeholder={'First name,Last name,Date of birth,Program,Level,Parent name,Parent email\n…'} />
          </details>
          <Button type="submit" variant="secondary" disabled={previewing}>{previewing ? 'Checking…' : 'Check file'}</Button>
        </form>
      </Card>

      {preview?.error && <p role="alert" className="text-sm text-bad">{preview.error}</p>}
      {done?.error && <p role="alert" className="text-sm text-bad">{done.error}</p>}

      {rows.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="ok">{ok.length} ready</Badge>
            {dup.length > 0 && <Badge tone="neutral">{dup.length} already exist (skipped)</Badge>}
            {bad.length > 0 && <Badge tone="bad">{bad.length} with errors (skipped)</Badge>}
            {preview!.unknownHeaders.length > 0 && <span className="text-muted">Ignored columns: {preview!.unknownHeaders.join(', ')}</span>}
          </div>
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Athlete</th>
                  <th className="px-3 py-2 font-medium">Program</th><th className="px-3 py-2 font-medium">Parent</th>
                  <th className="px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-b border-line last:border-0 align-top">
                    <td className="px-3 py-2 tabular-nums text-muted">{r.line}</td>
                    <td className="px-3 py-2">{r.first_name} {r.last_name}<span className="block text-xs text-muted">{r.dob ?? 'no DOB'} · {r.status}</span></td>
                    <td className="px-3 py-2">{r.program ? `${r.program}${r.level ? ` · ${r.level}` : ''}` : '—'}</td>
                    <td className="px-3 py-2">{r.parent_name ?? '—'}{r.parent_email && <span className="block text-xs text-muted">{r.parent_email}</span>}</td>
                    <td className="px-3 py-2">
                      {r.errors.length ? <span className="text-bad">{r.errors.join('; ')}</span>
                        : r.duplicate ? <span className="text-muted">Already in AcademyOS</span>
                        : <span className="text-ok">Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={commitAction} className="mt-4 flex flex-wrap items-center gap-3">
            <input type="hidden" name="text" value={preview!.text} />
            <Button type="submit" disabled={committing || ok.length === 0}>
              {committing ? 'Importing…' : `Import ${ok.length} ${ok.length === 1 ? 'athlete' : 'athletes'}`}
            </Button>
            {bad.length > 0 && <span className="text-sm text-muted">Fix the rows with errors in your file and import again. Rows already imported are skipped.</span>}
          </form>
        </Card>
      )}
    </div>
  )
}
