import { requireAdmin } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { billingMode } from '@/lib/billing/stripe'
import { addLocation, updateOrganization } from '@/lib/actions/settings'
import { ActionForm } from '@/components/form'
import { Badge, Card, Field, Input, PageHeader, Select } from '@/components/ui'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const s = await requireAdmin()
  const [locations, team] = await Promise.all([
    withUser(s.userId, (q) => q<{ id: string; name: string; address: string | null }>('select id, name, address from locations order by name')),
    withUser(s.userId, (q) => q<{ role: string; n: number }>(
      `select role, count(*)::int as n from user_roles where organization_id = $1 group by role`, [s.orgId])),
  ])
  const count = (r: string) => team.find((t) => t.role === r)?.n ?? 0
  const zones = Intl.supportedValuesOf('timeZone').filter((z) => z.startsWith('America/') || z.startsWith('Pacific/Honolulu') || z === 'UTC')

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" />
      <Card className="p-6">
        <h2 className="mb-4 font-semibold">Facility</h2>
        {s.role === 'owner' ? (
          <ActionForm action={updateOrganization} submit="Save">
            <Field label="Facility name"><Input name="name" defaultValue={s.orgName} required /></Field>
            <Field label="Timezone" hint="Defines what “today” means for schedules and dashboards.">
              <Select name="timezone" defaultValue={s.timezone}>
                {zones.map((z) => <option key={z} value={z}>{z.replace('_', ' ')}</option>)}
              </Select>
            </Field>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted">{s.orgName} · {s.timezone}. Only the owner can change these.</p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-semibold">Locations</h2>
        <ul className="mb-5 divide-y divide-line text-sm">
          {locations.map((l) => (
            <li key={l.id} className="py-2"><span className="font-medium">{l.name}</span>{l.address && <span className="text-muted"> · {l.address}</span>}</li>
          ))}
          {locations.length === 0 && <li className="py-2 text-muted">No locations yet.</li>}
        </ul>
        <ActionForm action={addLocation} submit="Add location" variant="secondary" resetOnSuccess className="grid gap-3 space-y-0 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Name"><Input name="name" placeholder="Turf 2" required /></Field>
          <Field label="Address"><Input name="address" /></Field>
        </ActionForm>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 font-semibold">Access</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">Owners/admins</dt><dd className="text-xl font-semibold">{count('owner') + count('admin')}</dd></div>
          <div><dt className="text-muted">Coaches</dt><dd className="text-xl font-semibold">{count('coach')}</dd></div>
          <div><dt className="text-muted">Parents</dt><dd className="text-xl font-semibold">{count('parent')}</dd></div>
          <div><dt className="text-muted">Billing</dt><dd className="mt-1"><Badge tone={billingMode() === 'stripe' ? 'ok' : 'warn'}>{billingMode() === 'stripe' ? 'Stripe' : 'Dev mode'}</Badge></dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          Coaches get app access from the Coaches page; parents from an athlete&apos;s profile. Coaches never see billing.
          Adding more admins and per-coach finance access is not implemented yet.
        </p>
      </Card>
    </div>
  )
}
