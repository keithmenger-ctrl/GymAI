-- Stripe support: "incomplete" memberships wait for the parent to finish checkout;
-- webhook writes are idempotent.
alter table memberships drop constraint memberships_status_check;
alter table memberships add constraint memberships_status_check
  check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled'));
create unique index memberships_stripe_subscription_key on memberships (stripe_subscription_id)
  where stripe_subscription_id is not null;
create unique index payments_invoice_status_key on payments (stripe_invoice_id, status)
  where stripe_invoice_id is not null;
alter table membership_plans add column stripe_product_id text;
