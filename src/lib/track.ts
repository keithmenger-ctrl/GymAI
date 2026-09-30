import 'server-only'
import type { Session } from '@/lib/auth'
import { withUser } from '@/lib/db'

export type EventName =
  | 'login' | 'attendance_marked' | 'attendance_bulk' | 'note_added' | 'assessments_recorded'
  | 'report_generated' | 'report_shared' | 'athletes_imported' | 'demo_created' | 'session_created'

/**
 * Records a usage event for the pilot readout. Never throws: analytics must not break the action
 * that triggered it. Runs under RLS (users can only insert events for themselves in their org).
 */
export async function track(s: Session, name: EventName, props: Record<string, unknown> = {}) {
  try {
    await withUser(s.userId, (q) =>
      q('insert into usage_events (organization_id, user_id, role, name, props) values ($1, $2, $3, $4, $5)',
        [s.orgId, s.userId, s.role, name, props]),
    )
  } catch (e) {
    console.error('track failed', name, e)
  }
}
