'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { commitImport, previewImport, type ImportPreview } from '@/lib/import/athletes'
import { track } from '@/lib/track'

export type ImportState = (ImportPreview & { text: string; imported?: number }) | undefined

const MAX_BYTES = 1_000_000

async function readText(fd: FormData) {
  const file = fd.get('file')
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) throw new Error('That file is too large (max 1 MB).')
    return await file.text()
  }
  return String(fd.get('text') ?? '')
}

/** Step 1: parse + validate, nothing is written. */
export async function previewAthleteImport(_: ImportState, fd: FormData): Promise<ImportState> {
  const s = await requireAdmin()
  let text: string
  try { text = await readText(fd) } catch (e) { return { rows: [], unknownHeaders: [], text: '', error: (e as Error).message } }
  if (!text.trim()) return { rows: [], unknownHeaders: [], text: '', error: 'Choose a CSV file or paste the rows.' }
  const preview = await withUser(s.userId, (q) => previewImport(q, text))
  return { ...preview, text }
}

/** Step 2: re-parse the same text server-side (never trusts the preview) and import valid rows atomically. */
export async function commitAthleteImport(_: ImportState, fd: FormData): Promise<ImportState> {
  const s = await requireAdmin()
  const text = String(fd.get('text') ?? '')
  if (text.length > MAX_BYTES) return { rows: [], unknownHeaders: [], text: '', error: 'That file is too large (max 1 MB).' }
  const result = await withUser(s.userId, async (q) => {
    const preview = await previewImport(q, text)
    if (preview.error) return { ...preview, imported: 0 }
    return { ...preview, imported: await commitImport(q, s.orgId, preview.rows) }
  })
  revalidatePath('/athletes')
  revalidatePath('/dashboard')
  if (result.imported) await track(s, 'athletes_imported', { count: result.imported })
  return { ...result, text }
}
