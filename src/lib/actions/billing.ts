'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireRole } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { billingMode, stripe } from '@/lib/billing/stripe'
import { baseUrl } from '@/lib/links'
import type { FormState } from './auth'


const refresh = () => {
  revalidatePath('/billing')
  revalidatePath('/dashboard')
  revalidatePath('/parent/billing')
  revalidatePath('/parent')
}

// ---------------------------------------------------------------- plans

const planSchema = z.object({
  name: z.string().trim().min(1, 'Plan name is required'),
  price: z.coerce.number().min(0, 'Price must be positive').max(100000),
  interval: z.enum(['month', 'year']),
})

export async function savePlan(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const s = await requireAdmin()
  const p = planSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  const cents = Math.round(p.data.price * 100)
  try {
    await withUser(s.userId, async (q) => {
      const existing = id
        ? (await q<{ price_cents: number; interval: string; stripe_product_id: string | null; stripe_price_id: string | null }>(
            'select price_cents, interval, stripe_product_id, stripe_price_id from membership_plans where id = $1', [id]))[0]
        : undefined
      if (id && !existing) throw new Error('Plan not found.')
      let productId = existing?.stripe_product_id ?? null
      let priceId = existing?.stripe_price_id ?? null
      if (billingMode() === 'stripe') {
        // Stripe prices are immutable: a new amount/interval means a new price. Existing subscribers keep theirs.
        if (!productId) productId = (await stripe().products.create({ name: p.data.name, metadata: { organization_id: s.orgId } })).id
        else await stripe().products.update(productId, { name: p.data.name })
        if (!priceId || existing!.price_cents !== cents || existing!.interval !== p.data.interval) {
          priceId = (await stripe().prices.create({
            product: productId, currency: 'usd', unit_amount: cents, recurring: { interval: p.data.interval },
          })).id
        }
      }
      if (id) {
        await q('update membership_plans set name=$2, price_cents=$3, interval=$4, stripe_product_id=$5, stripe_price_id=$6 where id=$1',
          [id, p.data.name, cents, p.data.interval, productId, priceId])
      } else {
        await q('insert into membership_plans (organization_id, name, price_cents, interval, stripe_product_id, stripe_price_id) values ($1,$2,$3,$4,$5,$6)',
          [s.orgId, p.data.name, cents, p.data.interval, productId, priceId])
      }
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save the plan.' }
  }
  refresh()
  return { message: id ? 'Saved' : `${p.data.name} added` }
}

export async function setPlanActive(id: string, active: boolean) {
  const s = await requireAdmin()
  await withUser(s.userId, (q) => q('update membership_plans set active = $2 where id = $1', [id, active]))
  refresh()
}

// ---------------------------------------------------------------- memberships

export type AssignState = { error?: string; message?: string; checkoutUrl?: string } | undefined

/** Stripe Checkout for an existing (incomplete) membership. Metadata ties everything back to our row. */
async function checkoutFor(m: { id: string; organization_id: string; stripe_price_id: string | null; stripe_customer_id: string | null; guardian_email: string | null; athlete: string }) {
  if (!m.stripe_price_id) throw new Error('This plan has no Stripe price yet. Re-save the plan to create one.')
  const base = await baseUrl()
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: m.stripe_price_id, quantity: 1 }],
    ...(m.stripe_customer_id ? { customer: m.stripe_customer_id } : { customer_email: m.guardian_email ?? undefined }),
    client_reference_id: m.id,
    metadata: { membership_id: m.id, organization_id: m.organization_id },
    subscription_data: { metadata: { membership_id: m.id, organization_id: m.organization_id }, description: m.athlete },
    success_url: `${base}/parent/billing?checkout=success`,
    cancel_url: `${base}/parent/billing?checkout=canceled`,
  })
  return session.url!
}

const assignSchema = z.object({ athlete_id: z.uuid('Choose an athlete'), plan_id: z.uuid('Choose a plan') })

export async function assignMembership(_: AssignState, fd: FormData): Promise<AssignState> {
  const s = await requireAdmin()
  const p = assignSchema.safeParse(Object.fromEntries(fd))
  if (!p.success) return { error: p.error.issues[0].message }
  const mode = billingMode()
  try {
    const checkoutUrl = await withUser(s.userId, async (q) => {
      const dup = await q(
        `select 1 from memberships where athlete_id = $1 and plan_id = $2 and status <> 'canceled'`, [p.data.athlete_id, p.data.plan_id])
      if (dup.length) throw new Error('This athlete already has that membership.')
      const [row] = await q<{ id: string; organization_id: string; stripe_price_id: string | null; stripe_customer_id: string | null; guardian_email: string | null; athlete: string; price_cents: number }>(
        `with g as (select ag.guardian_id from athlete_guardians ag join guardians gg on gg.id = ag.guardian_id
                     where ag.athlete_id = $2 order by gg.email is null, gg.name limit 1)
         insert into memberships (organization_id, athlete_id, guardian_id, plan_id, status, next_billing_date)
         select $1, a.id, (select guardian_id from g), mp.id, $4,
                case when $4 = 'active' then ((now() at time zone $5)::date + case mp.interval when 'year' then interval '1 year' else interval '1 month' end)::date end
           from athletes a, membership_plans mp where a.id = $2 and mp.id = $3 and mp.active
         returning id, organization_id,
           (select stripe_price_id from membership_plans where id = $3) as stripe_price_id, null::text as stripe_customer_id,
           (select gg.email from guardians gg where gg.id = memberships.guardian_id) as guardian_email,
           (select first_name || ' ' || last_name from athletes where id = $2) as athlete,
           (select price_cents from membership_plans where id = $3) as price_cents`,
        [s.orgId, p.data.athlete_id, p.data.plan_id, mode === 'dev' ? 'active' : 'incomplete', s.timezone],
      )
      if (!row) throw new Error('Athlete or plan not found (archived plans cannot be assigned).')
      if (mode === 'dev') {
        await q(`insert into payments (organization_id, membership_id, amount_cents, status, paid_at) values ($1, $2, $3, 'paid', now())`,
          [s.orgId, row.id, row.price_cents])
        return null
      }
      // Inside the transaction: if Stripe fails, the membership row is rolled back (no orphans).
      return checkoutFor(row)
    })
    refresh()
    if (!checkoutUrl) return { message: 'Membership started (dev mode: first payment recorded as paid).' }
    return { message: 'Membership created. Send the parent this checkout link to start billing:', checkoutUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the membership.' }
  }
}

export async function cancelMembership(id: string) {
  const s = await requireAdmin()
  const [m] = await withUser(s.userId, (q) =>
    q<{ stripe_subscription_id: string | null }>('select stripe_subscription_id from memberships where id = $1', [id]))
  if (!m) return
  if (m.stripe_subscription_id && billingMode() === 'stripe') await stripe().subscriptions.cancel(m.stripe_subscription_id)
  await withUser(s.userId, (q) => q(`update memberships set status = 'canceled', next_billing_date = null where id = $1`, [id]))
  refresh()
}

/** Dev mode only: record a successful or failed charge so past-due flows can be demoed. */
export async function simulatePayment(id: string, outcome: 'paid' | 'failed') {
  const s = await requireAdmin()
  if (billingMode() !== 'dev') throw new Error('Simulation is only available in dev mode.')
  await withUser(s.userId, async (q) => {
    const [m] = await q<{ price_cents: number; interval: string; status: string }>(
      `select mp.price_cents, mp.interval, m.status from memberships m join membership_plans mp on mp.id = m.plan_id where m.id = $1`, [id])
    if (!m || m.status === 'canceled') return
    await q(`insert into payments (organization_id, membership_id, amount_cents, status, paid_at)
             select organization_id, id, $2, $3, case when $3 = 'paid' then now() end from memberships where id = $1`,
      [id, m.price_cents, outcome])
    await q(
      outcome === 'paid'
        ? `update memberships set status = 'active',
             next_billing_date = (greatest(coalesce(next_billing_date, current_date), current_date)
               + case $2 when 'year' then interval '1 year' else interval '1 month' end)::date where id = $1`
        : `update memberships set status = 'past_due' where id = $1 and $2 = $2`,
      [id, m.interval],
    )
  })
  refresh()
}

// ---------------------------------------------------------------- parent self-service (Stripe mode)

export async function parentCheckout(membershipId: string) {
  const s = await requireRole('parent')
  if (billingMode() !== 'stripe') redirect('/parent/billing')
  // RLS: a parent can only read memberships where they are the guardian.
  const [m] = await withUser(s.userId, (q) =>
    q<{ id: string; organization_id: string; stripe_price_id: string | null; stripe_customer_id: string | null; guardian_email: string | null; athlete: string }>(
      `select m.id, m.organization_id, mp.stripe_price_id, m.stripe_customer_id, g.email as guardian_email,
              a.first_name || ' ' || a.last_name as athlete
         from memberships m join membership_plans mp on mp.id = m.plan_id
         join athletes a on a.id = m.athlete_id left join guardians g on g.id = m.guardian_id
        where m.id = $1 and m.status = 'incomplete'`, [membershipId]))
  if (!m) redirect('/parent/billing')
  redirect(await checkoutFor(m))
}

export async function parentBillingPortal() {
  const s = await requireRole('parent')
  if (billingMode() !== 'stripe') redirect('/parent/billing')
  const [m] = await withUser(s.userId, (q) =>
    q<{ stripe_customer_id: string }>(`select stripe_customer_id from memberships where stripe_customer_id is not null limit 1`))
  if (!m) redirect('/parent/billing')
  const portal = await stripe().billingPortal.sessions.create({ customer: m.stripe_customer_id, return_url: `${await baseUrl()}/parent/billing` })
  redirect(portal.url)
}
