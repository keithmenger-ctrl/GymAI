// Small formatting helpers. Dates coming from SQL are ISO strings or Date objects (pg).
const d = (v: string | Date) => (v instanceof Date ? v : new Date(v))
// Date-only strings ('2026-09-26') are calendar dates: never shift them by a timezone.
const zone = (v: string | Date, tz?: string) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? 'UTC' : tz)

export const fmtDate = (v: string | Date | null | undefined, tz?: string) =>
  v ? d(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: zone(v, tz) }) : '—'

export const fmtShortDate = (v: string | Date | null | undefined, tz?: string) =>
  v ? d(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: zone(v, tz) }) : '—'

export const fmtTime = (v: string | Date, tz: string) =>
  d(v).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })

export const fmtWeekday = (v: string | Date, tz: string) =>
  d(v).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: tz })

export const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents % 100 ? 2 : 0 })

/** Assessment values arrive as numeric strings; trim trailing zeros. */
export const num = (v: string | number) => String(Number(v))

export const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()

/** Whole days between now and a past timestamp (null if never). */
export const daysSince = (v: string | Date | null | undefined) =>
  v ? Math.floor((Date.now() - d(v).getTime()) / 86_400_000) : null

export const relativeDays = (v: string | Date | null | undefined) => {
  const n = daysSince(v)
  if (n === null) return 'Never'
  if (n <= 0) return 'Today'
  if (n === 1) return 'Yesterday'
  return `${n} days ago`
}
