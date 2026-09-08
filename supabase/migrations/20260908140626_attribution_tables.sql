-- T3-m1-data-core §2.2: attribution funnel tables, created BEFORE
-- sessions (sessions.visit_id references visits).
create table share_refs (
  ref_code text primary key,
  issued_for_session_id uuid,  -- FK added after sessions exists
  created_at timestamptz not null default now()
);
create table visits (
  id uuid primary key default gen_random_uuid(),
  ref_code text references share_refs(ref_code),
  created_at timestamptz not null default now()
);
create table events (
  id bigserial primary key,
  session_id uuid,
  event_type text not null,
  sequence bigint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  unique (session_id, event_type, sequence),
  check (session_id is not null or idempotency_key is not null)
);
create unique index events_one_completion_per_session
  on events (session_id)
  where event_type = 'reconciliation_completed';
create unique index events_one_casual_completion_per_idempotency_key
  on events (idempotency_key)
  where session_id is null and event_type = 'reconciliation_completed';
alter table share_refs enable row level security;
alter table visits enable row level security;
alter table events enable row level security;
