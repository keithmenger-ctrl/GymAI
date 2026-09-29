import { requireRole } from '@/lib/auth'
import { billingMode } from '@/lib/billing/stripe'
import { myMemberships } from '@/lib/queries/billing'
import { parentBillingPortal, parentCheckout } from '@/lib/actions/billing'
import { Badge, Button, Card, EmptyState } from '@/components/ui'
import { fmtDate, money } from '@/lib/format'

export const metadata = { title: 'Billing' }

const TONE = { active: 'ok', trialing: 'volt', past_due: 'bad', incomplete: 'warn', canceled: 'neutral' } as const
const LABEL = { active: 'Active', trialing: 'Trial', past_due: 'Past due', incomplete: 'Awaiting payment', canceled: 'Canceled' }

export default async function ParentBilling({ searchParams }: PageProps<'/parent/billing'>) {
  const s = await requireRole('parent')
  const sp = await searchParams
  const memberships = await myMemberships(s)
  const stripeMode = billingMode() === 'stripe'
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      {sp.checkout === 'success' && <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Thanks! Your payment was received. It can take a minute to show here.</p>}
      <div className="mt-6 space-y-4">
        {memberships.length === 0 ? (
          <EmptyState title="No memberships" body={`Contact ${s.orgName} to set one up.`} />
        ) : (
          memberships.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">{m.athlete}</p>
                  <p className="mt-1 text-lg font-semibold">{m.plan}</p>
                  <p className="text-sm text-muted">{money(m.price_cents)} / {m.interval}</p>
                </div>
                <Badge tone={TONE[m.status]}>{LABEL[m.status]}</Badge>
              </div>
              {m.next_billing_date && m.status !== 'canceled' && (
                <p className="mt-4 text-sm"><span className="text-muted">Next billing: </span><span className="font-medium">{fmtDate(m.next_billing_date)}</span></p>
              )}
              {m.status === 'past_due' && (
                <p className="mt-3 text-sm text-bad">Your last payment didn&apos;t go through. {stripeMode ? 'Please update your payment method.' : `Please contact ${s.orgName}.`}</p>
              )}
              {stripeMode && m.status === 'incomplete' && (
                <form action={parentCheckout.bind(null, m.id)} className="mt-4"><Button size="lg" className="w-full">Complete payment</Button></form>
              )}
              {stripeMode && m.has_customer && m.status !== 'incomplete' && (
                <form action={parentBillingPortal} className="mt-4"><Button variant="secondary" className="w-full">Manage payment method</Button></form>
              )}
              {m.payments.length > 0 && (
                <div className="mt-5 border-t border-line pt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Recent payments</p>
                  <ul className="text-sm">
                    {m.payments.map((p) => (
                      <li key={p.id} className="flex justify-between py-1">
                        <span className="text-muted">{fmtDate(p.at, s.timezone)}</span>
                        <span className={p.status === 'failed' ? 'text-bad' : ''}>{money(p.amount_cents)} · {p.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))
        )}
      </div>
      {!stripeMode && <p className="mt-6 text-xs text-muted">Online payments are not enabled for this academy yet.</p>}
    </>
  )
}
