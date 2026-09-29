import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'

export type Plan = {
  id: string; name: string; price_cents: number; interval: 'month' | 'year'; active: boolean
  stripe_price_id: string | null; members: number
}

export const listPlans = (s: Session) =>
  withUser(s.userId, (q) =>
    q<Plan>(
      `select mp.id, mp.name, mp.price_cents, mp.interval, mp.active, mp.stripe_price_id,
              (select count(*)::int from memberships m where m.plan_id = mp.id and m.status in ('active','trialing','past_due')) as members
         from membership_plans mp order by mp.active desc, mp.name`,
    ),
  )

export type MembershipRow = {
  id: string; athlete_id: string; athlete: string; guardian: string | null; plan: string; price_cents: number
  interval: string; status: 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled'
  next_billing_date: string | null; last_payment: { status: string; amount_cents: number; at: string | null } | null
  stripe_subscription_id: string | null
}

export const listMemberships = (s: Session, status?: string) =>
  withUser(s.userId, (q) =>
    q<MembershipRow>(
      `select m.id, m.athlete_id, a.first_name || ' ' || a.last_name as athlete, g.name as guardian, mp.name as plan,
              mp.price_cents, mp.interval, m.status, m.next_billing_date::text as next_billing_date, m.stripe_subscription_id,
              (select json_build_object('status', p.status, 'amount_cents', p.amount_cents, 'at', coalesce(p.paid_at, p.created_at))
                 from payments p where p.membership_id = m.id order by p.created_at desc limit 1) as last_payment
         from memberships m
         join athletes a on a.id = m.athlete_id
         join membership_plans mp on mp.id = m.plan_id
         left join guardians g on g.id = m.guardian_id
        where ($1::text is null or m.status = $1)
        order by case m.status when 'past_due' then 0 when 'incomplete' then 1 when 'trialing' then 2 when 'active' then 3 else 4 end,
                 a.last_name, a.first_name`,
      [status || null],
    ),
  )

export type ParentMembership = MembershipRow & {
  payments: { id: string; status: string; amount_cents: number; at: string }[]
  has_customer: boolean
}

/** RLS limits this to memberships where the signed-in parent is the guardian. */
export const myMemberships = (s: Session) =>
  withUser(s.userId, (q) =>
    q<ParentMembership>(
      `select m.id, m.athlete_id, a.first_name || ' ' || a.last_name as athlete, null as guardian, mp.name as plan,
              mp.price_cents, mp.interval, m.status, m.next_billing_date::text as next_billing_date, null as stripe_subscription_id,
              null as last_payment, m.stripe_customer_id is not null as has_customer,
              coalesce((select json_agg(json_build_object('id', p.id, 'status', p.status, 'amount_cents', p.amount_cents,
                                                          'at', coalesce(p.paid_at, p.created_at)) order by p.created_at desc)
                          from (select * from payments p where p.membership_id = m.id order by p.created_at desc limit 6) p), '[]') as payments
         from memberships m
         join athletes a on a.id = m.athlete_id
         join membership_plans mp on mp.id = m.plan_id
        order by (m.status = 'canceled'), a.first_name`,
    ),
  )

export const athletesForMembership = (s: Session) =>
  withUser(s.userId, (q) =>
    q<{ id: string; name: string; program: string | null }>(
      `select a.id, a.first_name || ' ' || a.last_name as name, p.name as program
         from athletes a left join programs p on p.id = a.current_program_id
        where a.status in ('active','trial') order by a.last_name, a.first_name`,
    ),
  )
