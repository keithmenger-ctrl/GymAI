import { Badge } from '@/components/ui'

const TONE = { active: 'ok', trial: 'accent', paused: 'warn', inactive: 'neutral' } as const

export function StatusBadge({ status }: { status: keyof typeof TONE }) {
  return <Badge tone={TONE[status]} className="capitalize">{status}</Badge>
}
