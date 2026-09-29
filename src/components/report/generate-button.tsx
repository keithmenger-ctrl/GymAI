import { generateReport } from '@/lib/actions/reports'
import { Button } from '@/components/ui'

export function GenerateReportButton({ athleteId }: { athleteId: string }) {
  return (
    <form action={generateReport.bind(null, athleteId)}>
      <Button variant="secondary">Generate progress report</Button>
    </form>
  )
}
