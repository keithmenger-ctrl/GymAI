# Deploying AcademyOS (Supabase + Vercel)

Everything here was built and tested against a local Postgres + GoTrue (Supabase Auth). These are the steps to run the
same thing on hosted Supabase and Vercel. Items marked **verify** could not be exercised from the build sandbox.

## 1. Supabase project
1. Create a project (region close to your facilities). Save the database password.
2. SQL editor: run `supabase/migrations/0001` … `0008` in order. Do **not** run `supabase/tests/*` stub files; Supabase
   already has the `auth` schema and the `anon` / `authenticated` roles.
3. Optional shared demo org: run `supabase/seed.sql` (creates "Vegas Elite Performance" and the `@vegaselite.test` logins,
   password `academyos-demo`). Prospects don't need it: signup creates their own demo academy.
4. Authentication → URL configuration: Site URL = your production URL; add `https://<domain>/auth/confirm` to redirect URLs.
5. Authentication → Providers → Email: decide on "Confirm email". If on, new owners finish setup at `/onboarding` after
   confirming (already handled).

## 2. Environment variables (Vercel → Settings → Environment Variables)
| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key (server only) |
| `DATABASE_URL` | Settings → Database → **Transaction pooler** connection string (port 6543) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | optional; leave empty for dev-mode billing |
| `ANTHROPIC_API_KEY` | optional; AI drafts fall back to templates |

Do **not** set `DEV_GOTRUE_URL` or `NEXT_PUBLIC_DEMO_LOGINS` in production.

Why the transaction pooler works: every data access runs in one transaction that sets the caller's JWT claims and
`set local role authenticated` (`src/lib/db.ts`), and `pg` uses unnamed prepared statements. **Verify** with the smoke
test below.

## 3. Vercel
Import the GitHub repo, framework = Next.js, no build overrides. Deploy.

## 4. Stripe (when ready to charge)
1. Test mode first. Set `STRIPE_SECRET_KEY` (sk_test_…).
2. Developers → Webhooks → add endpoint `https://<domain>/api/stripe/webhook` with events
   `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`,
   `invoice.payment_failed`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
3. Settings → Billing → Customer portal: enable it (used by "Manage payment method").
4. In AcademyOS Billing, re-save each plan once (creates the Stripe Product/Price).
5. **Verify**: start a membership, open the checkout link, pay with `4242 4242 4242 4242`, confirm it turns Active and a
   payment appears; then use `4000 0000 0000 0341` to see past-due.

## 5. Smoke test the deployment
From a machine with Node + Playwright's Chromium:
```bash
BASE_URL=https://<domain> node scripts/e2e/phase2.mjs   # auth + role isolation
BASE_URL=https://<domain> node scripts/e2e/demo.mjs     # signup with demo data + view switcher
```
Most other suites assume the shared seed (`supabase/seed.sql`); `pilot.mjs`, `phase12.mjs` and `stripe-webhook.mjs` also
need direct database access (`DATABASE_URL`). Run the RLS test suite only against a throwaway database.

## 6. Before real families use it
- Invite emails: invites currently produce a copy-paste link. To email them, configure SMTP in Supabase (the built-in
  sender is rate-limited) and customize the "Reset password" template to link to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/set-password`. Wiring the send is not
  implemented yet.
- Rate limiting: Supabase Auth rate-limits sign-in; add limits for invite creation if exposed widely.
- Privacy policy and parental consent language (athletes are minors).
