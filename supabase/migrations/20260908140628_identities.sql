-- T3-m1-data-core §2.2: identities (PII-bearing, purgeable).
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
