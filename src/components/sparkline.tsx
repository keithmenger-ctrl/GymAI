import { num } from '@/lib/format'

type Point = { value: number; label: string }

/**
 * Tiny trend line for 2+ values (oldest first). True orientation (higher value = higher), one ink series,
 * 2px line, 8px end markers, first/last values labelled in text colours, native per-point tooltips on
 * 20px hit targets, and an aria-label summary. The surrounding table is the accessible data view.
 */
export function Sparkline({ points, unit, name, width = 132, height = 36 }: {
  points: Point[]; unit: string; name: string; width?: number; height?: number
}) {
  if (points.length < 2) return null
  const pad = 5
  const vals = points.map((p) => p.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const x = (i: number) => pad + (i * (width - pad * 2)) / (points.length - 1)
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const summary = `${name}: ${points.map((p) => `${num(p.value)} ${unit} on ${p.label}`).join(', ')}`

  return (
    <span className="inline-flex items-center gap-2 text-xs tabular-nums">
      <span className="text-muted">{num(first.value)}</span>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary} className="overflow-visible">
        <line x1={pad} x2={width - pad} y1={height - 1} y2={height - 1} stroke="var(--line)" strokeWidth={1} />
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            {(i === 0 || i === points.length - 1) && (
              <circle cx={x(i)} cy={y(p.value)} r={4} fill={i === 0 ? 'var(--card)' : 'var(--ink)'}
                stroke="var(--ink)" strokeWidth={2} />
            )}
            <circle cx={x(i)} cy={y(p.value)} r={10} fill="transparent" className="cursor-default">
              <title>{`${p.label}: ${num(p.value)} ${unit}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <span className="font-medium text-ink">{num(last.value)} <span className="font-normal text-muted">{unit}</span></span>
    </span>
  )
}
