-- T3-m1-data-core §2.2 (D4): authoritative membership.
create table session_participants (
  session_id uuid not null references sessions(id),
  direction text check (direction in ('low-preferring', 'high-preferring')),
  is_host boolean not null default false,
  invite_id uuid references invites(id),
  bound_auth_uid uuid,
  created_at timestamptz not null default now(),
  check (is_host = false or direction is null),
  check (is_host = true or direction is not null),
  unique (session_id, direction)
);
create unique index session_participants_one_host
  on session_participants (session_id) where is_host;
alter table session_participants enable row level security;
