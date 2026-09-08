-- T3-m1-data-core §2.2/§2.3: the fact table and its metadata trigger.
create table party_positions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  direction text not null check (direction in ('low-preferring', 'high-preferring')),
  v1 numeric not null, v2 numeric not null, v3 numeric not null, v4 numeric not null,
  check (v1 > 0 and v1 < v2 and v2 < v3 and v3 < v4),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'recalled')),
  submitted_at timestamptz,
  vertical text not null,
  region text not null default 'unknown',
  unit text not null default 'currency',
  currency text not null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (session_id, direction)
);
alter table party_positions enable row level security;

create function party_positions_set_metadata()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select s.template_id, s.currency into strict new.vertical, new.currency
  from sessions s where s.id = new.session_id;
  new.region := coalesce(new.region, 'unknown');
  new.unit := 'currency';
  new.entry_date := current_date;
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function party_positions_set_metadata() from public;
alter function party_positions_set_metadata() owner to schema_owner_internal;
create trigger party_positions_set_metadata_trigger
  before insert on party_positions
  for each row execute function party_positions_set_metadata();
