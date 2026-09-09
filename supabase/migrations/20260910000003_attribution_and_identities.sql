-- T3-m1-data-core §2.2 in the T3-m2 vocabulary: attribution funnel tables
-- (created before reconciliations, which reference visits) and identities.
create table share_refs (
  ref_code text primary key,
  issued_for_reconciliation_id uuid,  -- FK added after reconciliations exists
  created_at timestamptz not null default now()
);
create table visits (
  id uuid primary key default gen_random_uuid(),
  ref_code text references share_refs(ref_code),
  created_at timestamptz not null default now()
);
create table events (
  id bigserial primary key,
  reconciliation_id uuid,
  event_type text not null,
  sequence bigint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  unique (reconciliation_id, event_type, sequence),
  check (reconciliation_id is not null or idempotency_key is not null)
);
create unique index events_one_completion_per_reconciliation
  on events (reconciliation_id)
  where event_type = 'reconciliation_completed';
create unique index events_one_casual_completion_per_idempotency_key
  on events (idempotency_key)
  where reconciliation_id is null and event_type = 'reconciliation_completed';
create unique index events_one_demo_row_per_idempotency_key_and_type
  on events (idempotency_key, event_type)
  where reconciliation_id is null
    and event_type in ('demo_stage_answered', 'demo_completed');
alter table share_refs enable row level security;
alter table visits enable row level security;
alter table events enable row level security;

-- identities (PII-bearing, purgeable)
create table identities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('user', 'org')),
  auth_user_id uuid unique references auth.users(id),
  email text,
  display_name text,
  purged_at timestamptz,
  created_at timestamptz not null default now()
);
alter table identities enable row level security;
