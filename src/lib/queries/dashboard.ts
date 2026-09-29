import { withUser } from '@/lib/db'
import type { Session } from '@/lib/auth'

export type TodayStats = {
  sessions: number
  athletes_scheduled: number
  attended: number
  marked: number
  coaches: number
}

export const todayStats = (s: Session) =>
  withUser(s.userId, async (q) => {
    const [r] = await q<TodayStats>(
      `with today as (
         select se.id, se.coach_id from sessions se
          where (se.starts_at at time zone $1)::date = (now() at time zone $1)::date)
       select (select count(*)::int from today) as sessions,
              (select count(distinct sa.athlete_id)::int from session_athletes sa where sa.session_id in (select id from today)) as athletes_scheduled,
              (select count(*)::int from attendance a where a.session_id in (select id from today) and a.status in ('present','late')) as attended,
              (select count(*)::int from attendance a where a.session_id in (select id from today)) as marked,
              (select count(distinct coach_id)::int from today where coach_id is not null) as coaches`,
      [s.timezone],
    )
    return r
  })

export type CapacityRow = {
  program_id: string
  program: string
  level_id: string
  level: string
  enrolled: number
  capacity: number
  new_30d: number
}

export const programCapacity = (s: Session) =>
  withUser(s.userId, (q) =>
    q<CapacityRow>(
      `select p.id as program_id, p.name as program, l.id as level_id, l.name as level, l.capacity,
              (select count(*)::int from athletes a where a.current_level_id = l.id and a.status in ('active','trial')) as enrolled,
              (select count(*)::int from athletes a where a.current_level_id = l.id and a.status in ('active','trial')
                  and a.join_date > (now() at time zone $1)::date - 30) as new_30d
         from program_levels l join programs p on p.id = l.program_id
        where p.active
        order by p.name, l.sort_order`,
      [s.timezone],
    ),
  )

export type ActivityStats = { active: number; trial: number; new_this_month: number }

export const activityStats = (s: Session) =>
  withUser(s.userId, async (q) => {
    const [r] = await q<ActivityStats>(
      `select count(*) filter (where status = 'active')::int as active,
              count(*) filter (where status = 'trial')::int as trial,
              count(*) filter (where status in ('active','trial')
                and join_date >= date_trunc('month', now() at time zone $1)::date)::int as new_this_month
         from athletes`,
      [s.timezone],
    )
    return r
  })

export type InactiveAthlete = { id: string; name: string; program: string | null; last_attended: string | null; days: number | null }

/** Active/trial athletes with no present/late attendance in `days` days (the "may be disengaging" list). */
export const notAttendedSince = (s: Session, days = 14) =>
  withUser(s.userId, (q) =>
    q<InactiveAthlete>(
      `select a.id, a.first_name || ' ' || a.last_name as name, p.name as program,
              la.last::text as last_attended,
              case when la.last is null then null else (now()::date - la.last::date)::int end as days
         from athletes a
         left join programs p on p.id = a.current_program_id
         left join lateral (
           select max(se.starts_at) as last from attendance at join sessions se on se.id = at.session_id
            where at.athlete_id = a.id and at.status in ('present','late')) la on true
        where a.status in ('active','trial')
          and a.join_date < now()::date - $1::int
          and (la.last is null or la.last < now() - make_interval(days => $1))
        order by la.last nulls first`,
      [days],
    ),
  )

export type FinanceStats = {
  mrr_cents: number
  active: number
  trialing: number
  past_due: number
  past_due_list: { athlete_id: string; athlete: string; plan: string; amount_cents: number; guardian: string | null }[]
}

/** Returns null for users who may not see finance (RLS would return zeros anyway; this avoids showing a fake $0). */
export const financeStats = (s: Session) =>
  s.canViewFinance
    ? withUser(s.userId, async (q) => {
        const [r] = await q<FinanceStats>(
          `select coalesce(sum(case when mp.interval = 'year' then mp.price_cents / 12 else mp.price_cents end)
                     filter (where m.status in ('active','past_due')), 0)::int as mrr_cents,
                  count(*) filter (where m.status = 'active')::int as active,
                  count(*) filter (where m.status = 'trialing')::int as trialing,
                  count(*) filter (where m.status = 'past_due')::int as past_due,
                  coalesce(json_agg(json_build_object('athlete_id', a.id, 'athlete', a.first_name || ' ' || a.last_name,
                        'plan', mp.name, 'amount_cents', mp.price_cents, 'guardian', g.name) order by a.last_name)
                     filter (where m.status = 'past_due'), '[]') as past_due_list
             from memberships m
             join membership_plans mp on mp.id = m.plan_id
             join athletes a on a.id = m.athlete_id
             left join guardians g on g.id = m.guardian_id`,
        )
        return r
      })
    : Promise.resolve(null)
