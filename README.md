# AcademyOS

An operating system for independent sports-performance facilities, built around athlete development rather than just memberships and booking.

```
PROGRAM → LEVEL → CURRICULUM → SESSION → ATHLETE → ASSESSMENT → PROGRESS
```

This repo is an **MVP** meant to be put in front of 3–5 facility owners. It is not the long-term company.

## Scope

**In (MVP):** athlete management, programs/levels/curriculum, sessions + attendance, coach "Today" view (mobile-first), assessments, athlete progress timeline, parent progress reports, owner dashboard, basic Stripe memberships (with a dev/mock mode), predefined read-only AI queries.

**Out (on purpose):** payroll, accounting, CRM/marketing, website builder, POS, nutrition, athlete workout logging, wearables, franchise tools, native apps, agentic AI, lending/marketplace features.

## Roles
| Role | Can |
|---|---|
| owner / admin | everything in their organization (owner also manages roles) |
| coach | see athletes + sessions, mark attendance, add notes, record assessments, edit notes/plan on own sessions. No finance unless `can_view_finance` |
| parent | only their own athletes: schedule, attendance, assessments, shareable notes, shared reports, own membership |

## Architecture
Single Next.js (App Router, TypeScript, Tailwind) monolith on Supabase (Postgres + Auth + RLS) with Stripe.

- **Tenancy:** every tenant table has `organization_id`. Composite FKs `(organization_id, id)` make cross-org references impossible at the database level.
- **Authorization:** enforced by Postgres RLS (`supabase/migrations/0002_rls.sql`) using `auth_org_id()` / `auth_role()` / `is_guardian_of()`. The app talks to the DB with the signed-in user's session so RLS always applies. The service-role key is used only for invites, the Stripe webhook and seeding. Server code also checks roles; nothing trusts the client.
- **Timeline:** DB triggers write `athlete_progress_events` for assessments, notes and program/level changes.
- **AI:** predefined, typed, read-only queries over structured data. AI never writes without explicit user confirmation. (Phase 12.)

## Database
Migrations live in `supabase/migrations`:
`organizations, profiles, user_roles, locations, sports, coaches, guardians, athletes, athlete_guardians, programs, program_levels, curriculum_items, sessions, session_athletes, attendance, coach_notes, assessment_types, assessment_results, athlete_progress_events, membership_plans, memberships, payments, progress_reports`.

Seed data (`supabase/seed.sql`): "Vegas Elite Performance", 3 programs × 3 levels, 36 curriculum items, 3 coaches, 30 athletes, 26 guardians, 110 sessions (8 weeks back through next week), attendance, notes, ~400 assessment results, memberships and payments. Demo logins (password `academyos-demo`): `owner@`, `keith@`, `mike@`, `sarah@`, `parent1@`…`parent6@` `vegaselite.test`.

## Testing the database locally
Needs a local Postgres 16 (no Supabase required; an auth stub stands in for Supabase's `auth` schema):

```bash
bash supabase/tests/reset.sh                       # rebuild db, run migrations + seed
su postgres -c "psql -q academyos_test -f supabase/tests/rls.sql"   # 49 tenant/role isolation checks
```

## Development plan
- [x] 0. Repo + Next.js scaffold
- [x] 1. Schema, RLS, seed, isolation tests
- [x] 2. Auth, org signup, role routing, app shells
- [x] 3. Athletes (list/search/filter, create/edit, full profile incl. attendance, assessment history, notes, timeline, parent invite links)
- [x] 4. Programs / levels / curriculum (create/edit/archive programs, levels with capacity, weekly curriculum with drills, cues, objectives, video link)
- [ ] 5. Sessions + attendance
- [ ] 6. Coach Today
- [ ] 7. Assessments
- [ ] 8. Athlete progress
- [ ] 9. Parent progress reports
- [ ] 10. Owner dashboard
- [ ] 11. Stripe memberships
- [ ] 12. AI queries

Anything not checked above is **not implemented**.

## Data access design
Supabase Auth handles identity (`@supabase/ssr` cookies, verified with `auth.getUser()` on every request). Data is read/written with plain SQL through `pg`, inside a transaction that first sets the caller's identity and switches to the `authenticated` role (`src/lib/db.ts → withUser`). Row level security therefore applies to every query the app makes, while dashboards/reports can use real SQL joins and aggregates. `withServiceRole` (bypasses RLS) exists only for server-side jobs (invites, Stripe webhook).

## Local development
Against a real Supabase project: copy `.env.example` to `.env.local`, fill it in, run the SQL in `supabase/migrations` then `supabase/seed.sql` (SQL editor or `supabase db push`), `npm install && npm run dev`.

Without Docker/Supabase (what this repo's CI-less dev loop uses): `bash scripts/dev-up.sh` starts Postgres + a locally built GoTrue with the migrations and seed loaded. Then create `.env.local` with the values from `scripts/dev-keys.mjs` (see `.env.example`; `DEV_GOTRUE_URL` proxies `/auth/v1` to it) and `npm run dev`. Browser checks (dev server running): `node scripts/e2e/phase2.mjs`, `node scripts/e2e/phase3.mjs`, `node scripts/e2e/phase4.mjs`.
