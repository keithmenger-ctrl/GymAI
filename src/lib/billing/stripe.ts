import Stripe from 'stripe'

/**
 * Billing runs in one of two modes:
 *  - 'stripe': STRIPE_SECRET_KEY is set. Plans get Stripe prices, memberships are paid via Checkout,
 *    and the webhook (/api/stripe/webhook) keeps status, next billing date and payments in sync.
 *  - 'dev': no key. Memberships and payments are plain database rows, with clearly labelled
 *    "simulate" controls so the product can be demoed without a Stripe account.
 */
export type BillingMode = 'stripe' | 'dev'

export const billingMode = (): BillingMode => (process.env.STRIPE_SECRET_KEY ? 'stripe' : 'dev')

let client: Stripe | null = null
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured (STRIPE_SECRET_KEY is empty).')
  client ??= new Stripe(key)
  return client
}

/** Stripe subscription status -> our membership status. */
export function mapStatus(s: Stripe.Subscription.Status): 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' {
  switch (s) {
    case 'active': return 'active'
    case 'trialing': return 'trialing'
    case 'past_due':
    case 'unpaid': return 'past_due'
    case 'canceled':
    case 'incomplete_expired': return 'canceled'
    default: return 'incomplete'
  }
}

/** current_period_end moved to subscription items in recent API versions. */
export function periodEnd(sub: Stripe.Subscription): string | null {
  const ts = sub.items?.data?.[0]?.current_period_end
  return ts ? new Date(ts * 1000).toISOString().slice(0, 10) : null
}

export function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const sub = inv.parent?.subscription_details?.subscription
  return typeof sub === 'string' ? sub : (sub?.id ?? null)
}
