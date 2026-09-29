import type Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { withServiceRole, type Q } from '@/lib/db'
import { invoiceSubscriptionId, mapStatus, periodEnd, stripe } from '@/lib/billing/stripe'

/**
 * Stripe → database sync. Signature-verified; runs with the service role because there is no user.
 * Every write is keyed on our membership id (from metadata) or the Stripe subscription id, and scoped
 * to that membership's organization. Replays are harmless (upserts / unique indexes).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'Stripe not configured' }, { status: 501 })
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  await withServiceRole((q) => handle(q, event))
  return NextResponse.json({ received: true })
}

async function membershipFor(q: Q, byId: string | null | undefined, bySub: string | null | undefined) {
  const r = await q<{ id: string; organization_id: string; price_cents: number }>(
    `select m.id, m.organization_id, mp.price_cents from memberships m join membership_plans mp on mp.id = m.plan_id
      where ($1::uuid is not null and m.id = $1::uuid) or ($2::text is not null and m.stripe_subscription_id = $2)
      limit 1`,
    [byId && /^[0-9a-f-]{36}$/i.test(byId) ? byId : null, bySub ?? null],
  )
  return r[0] ?? null
}

async function handle(q: Q, event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const cs = event.data.object
      const m = await membershipFor(q, cs.metadata?.membership_id, null)
      if (!m) return
      const sub = typeof cs.subscription === 'string' ? cs.subscription : cs.subscription?.id
      const cust = typeof cs.customer === 'string' ? cs.customer : cs.customer?.id
      await q(`update memberships set stripe_subscription_id = coalesce($2, stripe_subscription_id),
                 stripe_customer_id = coalesce($3, stripe_customer_id),
                 status = case when status = 'incomplete' then 'active' else status end
               where id = $1`, [m.id, sub ?? null, cust ?? null])
      return
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const m = await membershipFor(q, sub.metadata?.membership_id, sub.id)
      if (!m) return
      const status = event.type === 'customer.subscription.deleted' ? 'canceled' : mapStatus(sub.status)
      await q(`update memberships set status = $2, next_billing_date = $3, stripe_subscription_id = $4,
                 stripe_customer_id = coalesce($5, stripe_customer_id) where id = $1`,
        [m.id, status, status === 'canceled' ? null : periodEnd(sub), sub.id,
         typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null])
      return
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const inv = event.data.object
      const m = await membershipFor(q, inv.parent?.subscription_details?.metadata?.membership_id, invoiceSubscriptionId(inv))
      if (!m) return
      const paid = event.type === 'invoice.paid'
      await q(`insert into payments (organization_id, membership_id, amount_cents, status, paid_at, stripe_invoice_id)
               values ($1, $2, $3, $4, $5, $6)
               on conflict (stripe_invoice_id, status) where stripe_invoice_id is not null do nothing`,
        [m.organization_id, m.id, paid ? inv.amount_paid : inv.amount_due, paid ? 'paid' : 'failed',
         paid ? new Date((inv.status_transitions?.paid_at ?? event.created) * 1000) : null, inv.id])
      if (!paid) await q(`update memberships set status = 'past_due' where id = $1 and status <> 'canceled'`, [m.id])
      return
    }
  }
}
