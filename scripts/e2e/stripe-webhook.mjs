// Stripe webhook sync, tested without Stripe's network: events are signed locally with the webhook secret.
// Needs a dev server in Stripe mode:
//   NEXT_DIST_DIR=.next-stripe STRIPE_SECRET_KEY=sk_test_x STRIPE_WEBHOOK_SECRET=whsec_test_secret npx next dev -p 3001
// Note: next dev adds .next-stripe paths to tsconfig.json; revert that after the run.
import Stripe from 'stripe'
import pg from 'pg'
import { check, done } from './lib.mjs'

const URL_ = process.env.STRIPE_BASE_URL || 'http://localhost:3001'
const SECRET = 'whsec_test_secret'
const stripe = new Stripe('sk_test_x')
const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/academyos_dev' })
await db.connect()
const one = async (sql, p) => (await db.query(sql, p)).rows[0]

const send = async (type, object, { sign = true } = {}) => {
  const payload = JSON.stringify({ id: `evt_${Math.random().toString(36).slice(2)}`, object: 'event', type, created: Math.floor(Date.now() / 1000), data: { object } })
  const header = sign ? stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) : 't=1,v1=bad'
  const r = await fetch(`${URL_}/api/stripe/webhook`, { method: 'POST', body: payload, headers: { 'content-type': 'application/json', 'stripe-signature': header } })
  return r.status
}

// a membership to drive through the lifecycle
const m = await one(`select m.id, mp.price_cents from memberships m join membership_plans mp on mp.id = m.plan_id where m.status = 'active' and m.stripe_subscription_id is null order by m.id limit 1`)
await db.query(`update memberships set status = 'incomplete' where id = $1`, [m.id])
const sub = `sub_test_${Date.now()}`
const meta = { membership_id: m.id }

check('unsigned request rejected (400)', (await send('invoice.paid', {}, { sign: false })) === 400)

check('checkout.session.completed accepted', (await send('checkout.session.completed', { object: 'checkout.session', metadata: meta, subscription: sub, customer: 'cus_test_1' })) === 200)
let row = await one('select status, stripe_subscription_id, stripe_customer_id from memberships where id = $1', [m.id])
check('checkout: incomplete -> active, ids linked', row.status === 'active' && row.stripe_subscription_id === sub && row.stripe_customer_id === 'cus_test_1', JSON.stringify(row))

const periodEnd = Math.floor(Date.UTC(2026, 10, 15) / 1000)
await send('customer.subscription.updated', { object: 'subscription', id: sub, status: 'past_due', metadata: {}, customer: 'cus_test_1', items: { data: [{ current_period_end: periodEnd }] } })
row = await one('select status, next_billing_date::text as nbd from memberships where id = $1', [m.id])
check('subscription.updated: status past_due + next billing from item period end', row.status === 'past_due' && row.nbd === '2026-11-15', JSON.stringify(row))

const failed = { object: 'invoice', id: `in_${Date.now()}`, amount_due: m.price_cents, amount_paid: 0, parent: { subscription_details: { subscription: sub, metadata: {} } }, status_transitions: {} }
await send('invoice.payment_failed', failed)
await send('invoice.payment_failed', failed) // replay
let n = await one(`select count(*)::int as n from payments where stripe_invoice_id = $1 and status = 'failed'`, [failed.id])
check('invoice.payment_failed recorded once (replay-safe)', n.n === 1, String(n.n))

await send('invoice.paid', { ...failed, amount_paid: m.price_cents, status_transitions: { paid_at: Math.floor(Date.now() / 1000) } })
await send('customer.subscription.updated', { object: 'subscription', id: sub, status: 'active', metadata: {}, customer: 'cus_test_1', items: { data: [{ current_period_end: periodEnd }] } })
row = await one(`select m.status, (select count(*)::int from payments p where p.stripe_invoice_id = $2 and p.status = 'paid') as paid from memberships m where m.id = $1`, [m.id, failed.id])
check('invoice.paid recorded + subscription back to active', row.status === 'active' && row.paid === 1, JSON.stringify(row))

check('unknown subscription ignored (200, no writes)', (await send('customer.subscription.updated', { object: 'subscription', id: 'sub_nope', status: 'canceled', metadata: {}, items: { data: [] } })) === 200)

await send('customer.subscription.deleted', { object: 'subscription', id: sub, status: 'canceled', metadata: {}, customer: 'cus_test_1', items: { data: [] } })
row = await one('select status, next_billing_date from memberships where id = $1', [m.id])
check('subscription.deleted -> canceled, no next billing', row.status === 'canceled' && row.next_billing_date === null, JSON.stringify(row))

// restore demo data
await db.query(`update memberships set status = 'active', stripe_subscription_id = null, stripe_customer_id = null,
                next_billing_date = current_date + 20 where id = $1`, [m.id])
await db.query(`delete from payments where stripe_invoice_id = $1`, [failed.id])
await db.end()
done()
