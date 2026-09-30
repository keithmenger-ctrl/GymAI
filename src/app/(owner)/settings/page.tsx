import { requireAdmin } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { billingMode } from '@/lib/billing/stripe'
import { addLocation, updateOrganization } from '@/lib/actions/settings'
import { removeAdmin } from '@/lib/actions/team'
import { AddAdminForm } from '@/components/team/add-admin-form'
import { ConfirmButton } from '@/components/form'
import { ActionForm } from '@/components/form'
import { Badge, Card, Field, Input, PageHeader, Select } from '@/components/ui'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const s = await requireAdmin()
  const [locations, team, admins] = await Promise.all([
    withUser(s.userId, (q) => q<{ id: string; name: string; address: string | null }>('select id, name, address from locations order by name')),
    withUser(s.userId, (q) => q<{ role: string; n: number }>(
      `select role, count(*)::int as n from user_roles where organization_id = $1 group by role`, [s.orgId])),
    withUser(s.userId, (q) => q<{ user_id: string; role: string; name: string | null; email: string | null }>(
      `select r.user_id, r.role, p.full_name as name, p.email from user_roles r left join profiles p on p.id = r.user_id
        where r.organization_id = $1 and r.role in ('owner','admin') order by r.role desc, p.full_name`, [s.orgId])),
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
        <h2 className="mb-1 font-semibold">Owners &amp; admins</h2>
        <p className="mb-4 text-sm text-muted">Admins can do everything except change facility settings and manage admins.</p>
        <ul className="mb-5 divide-y divide-line text-sm">
          {admins.map((a) => (
            <li key={a.user_id} className="flex items-center justify-between gap-3 py-2">
              <span><span className="font-medium">{a.name ?? a.email}</span> <span className="text-muted">· {a.email}</span></span>
              <span className="flex items-center gap-2">
                <span className="text-xs capitalize text-muted">{a.role}</span>
                {s.role === 'owner' && a.role === 'admin' && (
                  <ConfirmButton action={removeAdmin.bind(null, a.user_id)} label="Remove" confirm={`Remove ${a.name ?? a.email} as an admin?`} />
                )}
              </span>
            </li>
          ))}
        </ul>
        {s.role === 'owner' && <AddAdminForm />}
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
          Coaches can be allowed to see billing status from the Coaches page.
        </p>
      </Card>
    </div>
  )
}
