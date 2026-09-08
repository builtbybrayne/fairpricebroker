-- T3-m1-data-core §2.2 (D1 protocol): hashed single-use tokens.
create table invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  role text not null,
  email text,
  email_bound boolean not null default true,
  token_hash text not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  redeemed_by_auth_uid uuid,
  redeemed_by_identity_id uuid references identities(id),
  created_at timestamptz not null default now(),
  unique (token_hash)
);
alter table invites enable row level security;
create index invites_session_id_idx on invites (session_id);
