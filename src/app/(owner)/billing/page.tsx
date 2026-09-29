import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { billingMode } from '@/lib/billing/stripe'
import { athletesForMembership, listMemberships, listPlans } from '@/lib/queries/billing'
import { financeStats } from '@/lib/queries/dashboard'
import { cancelMembership, savePlan, setPlanActive, simulatePayment } from '@/lib/actions/billing'
import { ActionForm, ConfirmButton } from '@/components/form'
import { AssignMembershipForm } from '@/components/billing/assign-form'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Stat } from '@/components/ui'
import { fmtDate, money } from '@/lib/format'
import { cn } from '@/lib/cn'

export const metadata = { title: 'Billing' }

const STATUS_TONE = { active: 'ok', trialing: 'volt', past_due: 'bad', incomplete: 'warn', canceled: 'neutral' } as const
const STATUS_LABEL = { active: 'Active', trialing: 'Trialing', past_due: 'Past due', incomplete: 'Awaiting payment', canceled: 'Canceled' }
const FILTERS = [['', 'All'], ['past_due', 'Past due'], ['active', 'Active'], ['incomplete', 'Awaiting payment'], ['canceled', 'Canceled']] as const

function PlanFields({ p }: { p?: { name: string; price_cents: number; interval: string } }) {
  return (
    <div className="grid grid-cols-[1fr_7rem_7rem] gap-3">
      <Field label="Name"><Input name="name" defaultValue={p?.name} placeholder="Speed Development Monthly" required /></Field>
      <Field label="Price ($)"><Input name="price" type="number" min={0} step="0.01" defaultValue={p ? p.price_cents / 100 : ''} required /></Field>
      <Field label="Every">
        <Select name="interval" defaultValue={p?.interval ?? 'month'}>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </Select>
      </Field>
    </div>
  )
}

export default async function BillingPage({ searchParams }: PageProps<'/billing'>) {
  // Billing settings are owner/admin only (coaches never reach the owner shell).
  const s = await requireRole('owner', 'admin')
  const sp = await searchParams
  const status = typeof sp.status === 'string' && FILTERS.some(([v]) => v === sp.status) ? sp.status : ''
  const mode = billingMode()
  const [plans, memberships, athletes, finance] = await Promise.all([
    listPlans(s), listMemberships(s, status), athletesForMembership(s), financeStats(s),
  ])
  const activePlans = plans.filter((p) => p.active)

  return (
    <>
      <PageHeader title="Billing" subtitle="Simple memberships: a plan, a price, a status." />
      {mode === 'dev' ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Dev mode.</span> No Stripe key is configured, so no real money moves. Memberships and payments are
          stored in the database and you can simulate charges below. Set <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> to go live.
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-line bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Stripe connected.</span> New memberships create a Checkout link for the parent; status and payments sync from Stripe webhooks.
        </div>
      )}

      {finance && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Monthly recurring revenue" value={money(finance.mrr_cents)} />
          <Stat label="Active memberships" value={finance.active} />
          <Stat label="Trialing" value={finance.trialing} />
          <Stat label="Past due" value={<span className={cn(finance.past_due > 0 && 'text-bad')}>{finance.past_due}</span>} />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Memberships</h2>
            <nav className="flex flex-wrap gap-1" aria-label="Filter memberships">
              {FILTERS.map(([v, label]) => (
                <Link key={v} href={v ? `/billing?status=${v}` : '/billing'}
                  className={cn('rounded-full px-3 py-1 text-sm', status === v ? 'bg-ink text-white' : 'bg-stone-100 text-stone-700')}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {memberships.length === 0 ? (
            <EmptyState title="No memberships here" />
          ) : (
            <Card className="divide-y divide-line">
              {memberships.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
                  <div className="min-w-48 flex-1">
                    <Link href={`/athletes/${m.athlete_id}`} className="font-medium hover:underline">{m.athlete}</Link>
                    <p className="text-xs text-muted">{m.guardian ?? 'No guardian'} · {m.plan} · {money(m.price_cents)}/{m.interval === 'year' ? 'yr' : 'mo'}</p>
                  </div>
                  <div className="w-36 text-sm">
                    <p className="text-xs text-muted">Next billing</p>
                    <p>{m.next_billing_date ? fmtDate(m.next_billing_date) : '—'}</p>
                  </div>
                  <div className="w-36 text-sm">
                    <p className="text-xs text-muted">Last payment</p>
                    <p className={cn(m.last_payment?.status === 'failed' && 'text-bad')}>
                      {m.last_payment ? `${money(m.last_payment.amount_cents)} ${m.last_payment.status}` : '—'}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[m.status]} className="w-32 justify-center">{STATUS_LABEL[m.status]}</Badge>
                  {m.status !== 'canceled' && (
                    <div className="flex gap-1.5">
                      {mode === 'dev' && (
                        <>
                          <form action={simulatePayment.bind(null, m.id, 'paid')}><Button size="sm" variant="ghost" title="Dev mode: record a successful charge">Sim. paid</Button></form>
                          <form action={simulatePayment.bind(null, m.id, 'failed')}><Button size="sm" variant="ghost" title="Dev mode: record a failed charge">Sim. failed</Button></form>
                        </>
                      )}
                      <ConfirmButton action={cancelMembership.bind(null, m.id)} label="Cancel" confirm={`Cancel ${m.athlete}'s ${m.plan} membership?`} />
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </section>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Start a membership</h2>
            <AssignMembershipForm
              athletes={athletes}
              plans={activePlans.map((p) => ({ id: p.id, name: p.name, price: `${money(p.price_cents)}/${p.interval === 'year' ? 'yr' : 'mo'}` }))}
            />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Plans</h2>
            <ul className="mb-5 divide-y divide-line">
              {plans.map((p) => (
                <li key={p.id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="font-medium">{p.name}</span>{!p.active && <Badge className="ml-2">Archived</Badge>}
                        <span className="block text-xs text-muted">{money(p.price_cents)}/{p.interval === 'year' ? 'yr' : 'mo'} · {p.members} members</span>
                      </span>
                      <span className="text-xs text-muted">Edit</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <ActionForm action={savePlan.bind(null, p.id)} submit="Save plan" size="sm"><PlanFields p={p} /></ActionForm>
                      <form action={setPlanActive.bind(null, p.id, !p.active)}>
                        <Button size="sm" variant="ghost">{p.active ? 'Archive plan' : 'Restore plan'}</Button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            <ActionForm action={savePlan.bind(null, null)} submit="Add plan" variant="secondary" resetOnSuccess><PlanFields /></ActionForm>
          </Card>
        </div>
      </div>
    </>
  )
}
