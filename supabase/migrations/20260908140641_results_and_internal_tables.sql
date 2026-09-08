-- T3-m1-data-core §2.2/§2.4: results, honesty, tombstones, billing
-- reference, developer grants. All deny-by-default.
create table results (
  session_id uuid primary key references sessions(id),
  payload jsonb not null,
  engine_version text not null,
  algorithm_version text not null,
  computed_at timestamptz not null default now()
);
alter table results enable row level security;

create table honesty_signal_storage (
  session_id uuid not null references sessions(id),
  direction text not null check (direction in ('low-preferring', 'high-preferring')),
  signals jsonb not null,
  signal_set_version text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, direction)
);
alter table honesty_signal_storage enable row level security;

create table purge_tombstone_log (
  id bigserial primary key,
  identity_id uuid not null references identities(id),
  purged_at timestamptz not null default now(),
  cascade_summary jsonb not null,
  replayed_on_restore_at timestamptz
);
alter table purge_tombstone_log enable row level security;

create table billing_reference (
  id bigserial primary key,
  account_identity_id uuid not null references identities(id),
  provider text not null,
  provider_event_id text not null,
  event_kind text not null,
  occurred_at timestamptz not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
alter table billing_reference enable row level security;

create table developer_grants (
  auth_uid uuid primary key,
  granted_by text not null,
  granted_at timestamptz not null default now()
);
alter table developer_grants enable row level security;
