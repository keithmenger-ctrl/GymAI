/** Neutral placeholder shown while a server page loads. */
export function PageSkeleton({ rows = 4, compact = false }: { rows?: number; compact?: boolean }) {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-48 rounded-md bg-stone-200" />
      {!compact && <div className="h-4 w-72 rounded bg-stone-100" />}
      <div className="space-y-3 pt-2">
        {Array.from({ length: rows }, (_, i) => <div key={i} className="h-16 rounded-xl bg-stone-100" />)}
      </div>
    </div>
  )
}
