-- Pilot learning: in-app feedback and lightweight usage events.
-- Both are write-only from the app (no select policies): the founder reads them with scripts/pilot-readout.sql.
create table feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  role text,
  page text,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on feedback (organization_id, created_at desc);

create table usage_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  role text,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on usage_events (organization_id, created_at desc);
create index on usage_events (name, created_at desc);

alter table feedback enable row level security;
alter table usage_events enable row level security;

create policy feedback_insert on feedback for insert
  with check (organization_id = auth_org_id() and user_id = auth.uid());
create policy usage_insert on usage_events for insert
  with check (organization_id = auth_org_id() and user_id = auth.uid());
