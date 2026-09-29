-- AcademyOS schema. Every tenant table carries organization_id.
-- Cross-org integrity is enforced with composite FKs (organization_id, id).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- core
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);

create table user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade, -- MVP: one org per user
  organization_id uuid not null references organizations (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'coach', 'parent')),
  can_view_finance boolean not null default false,
  created_at timestamptz not null default now()
);
create index on user_roles (organization_id);

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  address text,
  unique (organization_id, id)
);

create table sports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  unique (organization_id, id),
  unique (organization_id, name)
);

create table coaches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  name text not null,
  email text,
  bio text,
  active boolean not null default true,
  unique (organization_id, id)
);
create index on coaches (organization_id);
create index on coaches (profile_id);

create table guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  name text not null,
  email text,
  phone text,
  unique (organization_id, id)
);
create index on guardians (organization_id);
create index on guardians (profile_id);

-- ---------------------------------------------------------------- programs
create table programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  description text,
  sport_id uuid,
  active boolean not null default true,
  unique (organization_id, id),
  foreign key (organization_id, sport_id) references sports (organization_id, id)
);
create index on programs (organization_id);

create table program_levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  program_id uuid not null,
  name text not null,
  sort_order int not null default 0,
  capacity int not null default 20,
  unique (organization_id, id),
  foreign key (organization_id, program_id) references programs (organization_id, id) on delete cascade
);
create index on program_levels (organization_id, program_id);

create table curriculum_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  level_id uuid not null,
  week_number int not null default 1,
  title text not null,
  description text,
  objectives text,
  drills jsonb not null default '[]'::jsonb, -- array of strings
  cues text,
  notes text,
  video_url text,
  unique (organization_id, id),
  foreign key (organization_id, level_id) references program_levels (organization_id, id) on delete cascade
);
create index on curriculum_items (organization_id, level_id, week_number);

-- ---------------------------------------------------------------- athletes
create table athletes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  sport_id uuid,
  position text,
  school_team text,
  status text not null default 'active' check (status in ('active', 'trial', 'paused', 'inactive')),
  join_date date not null default current_date,
  notes text,
  current_program_id uuid,
  current_level_id uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, sport_id) references sports (organization_id, id),
  foreign key (organization_id, current_program_id) references programs (organization_id, id) on delete set null (current_program_id),
  foreign key (organization_id, current_level_id) references program_levels (organization_id, id) on delete set null (current_level_id)
);
create index on athletes (organization_id, status);

create table athlete_guardians (
  organization_id uuid not null references organizations (id) on delete cascade,
  athlete_id uuid not null,
  guardian_id uuid not null,
  primary key (athlete_id, guardian_id),
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade,
  foreign key (organization_id, guardian_id) references guardians (organization_id, id) on delete cascade
);
create index on athlete_guardians (guardian_id);
create index on athlete_guardians (organization_id);

-- ---------------------------------------------------------------- sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  program_id uuid not null,
  level_id uuid,
  curriculum_item_id uuid,
  location_id uuid,
  coach_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_athletes int not null default 20,
  session_plan text,
  focus text,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (organization_id, id),
  foreign key (organization_id, program_id) references programs (organization_id, id) on delete cascade,
  foreign key (organization_id, level_id) references program_levels (organization_id, id) on delete set null (level_id),
  foreign key (organization_id, curriculum_item_id) references curriculum_items (organization_id, id) on delete set null (curriculum_item_id),
  foreign key (organization_id, location_id) references locations (organization_id, id) on delete set null (location_id),
  foreign key (organization_id, coach_id) references coaches (organization_id, id) on delete set null (coach_id)
);
create index on sessions (organization_id, starts_at);
create index on sessions (coach_id);

create table session_athletes (
  organization_id uuid not null references organizations (id) on delete cascade,
  session_id uuid not null,
  athlete_id uuid not null,
  primary key (session_id, athlete_id),
  foreign key (organization_id, session_id) references sessions (organization_id, id) on delete cascade,
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade
);
create index on session_athletes (athlete_id);
create index on session_athletes (organization_id);

create table attendance (
  organization_id uuid not null references organizations (id) on delete cascade,
  session_id uuid not null,
  athlete_id uuid not null,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_by uuid references profiles (id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (session_id, athlete_id),
  foreign key (organization_id, session_id) references sessions (organization_id, id) on delete cascade,
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade
);
create index on attendance (athlete_id);
create index on attendance (organization_id);

create table coach_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  athlete_id uuid, -- null = general session note
  session_id uuid,
  author_id uuid references profiles (id) on delete set null,
  body text not null,
  shareable boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade,
  foreign key (organization_id, session_id) references sessions (organization_id, id) on delete cascade
);
create index on coach_notes (organization_id, athlete_id, created_at desc);

-- ---------------------------------------------------------------- assessments
create table assessment_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  unit text not null,
  direction text not null check (direction in ('lower', 'higher')),
  category text not null default 'General',
  reassess_days int not null default 60,
  unique (organization_id, id)
);
create index on assessment_types (organization_id);

create table assessment_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  athlete_id uuid not null,
  type_id uuid not null,
  value numeric not null,
  recorded_on date not null default current_date,
  recorded_by uuid references profiles (id) on delete set null,
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade,
  foreign key (organization_id, type_id) references assessment_types (organization_id, id) on delete cascade
);
create index on assessment_results (organization_id, athlete_id, type_id, recorded_on);

create table athlete_progress_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  athlete_id uuid not null,
  kind text not null check (kind in ('level_change', 'assessment', 'note', 'milestone', 'program_change')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade
);
create index on athlete_progress_events (organization_id, athlete_id, occurred_at desc);

-- ---------------------------------------------------------------- money
create table membership_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  price_cents int not null check (price_cents >= 0),
  interval text not null default 'month' check (interval in ('month', 'year')),
  stripe_price_id text,
  active boolean not null default true,
  unique (organization_id, id)
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  athlete_id uuid not null,
  guardian_id uuid,
  plan_id uuid not null,
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  next_billing_date date,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade,
  foreign key (organization_id, guardian_id) references guardians (organization_id, id) on delete set null (guardian_id),
  foreign key (organization_id, plan_id) references membership_plans (organization_id, id)
);
create index on memberships (organization_id, status);

create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  membership_id uuid not null,
  amount_cents int not null,
  status text not null check (status in ('paid', 'failed', 'pending', 'refunded')),
  paid_at timestamptz,
  stripe_invoice_id text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, membership_id) references memberships (organization_id, id) on delete cascade
);
create index on payments (organization_id, membership_id);

-- ---------------------------------------------------------------- reports
create table progress_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  athlete_id uuid not null,
  title text not null,
  sections jsonb not null default '{}'::jsonb, -- {summary, next_focus, ...}
  snapshot jsonb not null default '{}'::jsonb, -- attendance/assessment numbers at generation time
  status text not null default 'draft' check (status in ('draft', 'shared')),
  created_by uuid references profiles (id) on delete set null,
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, athlete_id) references athletes (organization_id, id) on delete cascade
);
create index on progress_reports (organization_id, athlete_id);
