-- T3-m2-domain-terms §3: the domain tables.
--
--   offer            one standing offer, by one side, collecting reconciliations
--   reconciliation   one two-party reconciliation (was: session)
--   participant      a seat at a reconciliation: buyer, seller, or broker
--                    (a broker may act for a side)            (was: session_participants)
--   figures          a side's four points                     (was: party_positions)
--   invite           a way into a seat
--   result, honesty_signal_storage, purge_tombstone_log, billing_reference,
--   developer_grants, tags, tag_links

create table offers (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  offered_by text not null check (offered_by in ('buyer', 'seller')),
  title text not null check (length(trim(title)) between 1 and 120),
  currency text not null,
  -- the offerer's figures, set once and copied into each reconciliation
  v1 numeric, v2 numeric, v3 numeric, v4 numeric,
  check (
    (v1 is null and v2 is null and v3 is null and v4 is null)
    or (v1 > 0 and v1 < v2 and v2 < v3 and v3 < v4)
  ),
  access_map_id uuid not null references access_maps(id),
  created_at timestamptz not null default now()
);
alter table offers enable row level security;
create index offers_access_map_idx on offers (access_map_id);

create table reconciliations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invited', 'survey')),
  vertical text not null,
  offer_id uuid references offers(id),
  broker_sees_figures boolean not null default false,
  is_demo boolean not null default false,
  currency text not null,
  state text not null default 'open'
    check (state in ('open', 'locked', 'closed', 'cancelled')),
  creator_identity_id uuid references identities(id),
  visit_id uuid references visits(id),
  orchestration_claimed_at timestamptz,
  orchestration_fence bigint,
  created_at timestamptz not null default now()
);
create unique index reconciliations_visit_id_unique
  on reconciliations (visit_id) where visit_id is not null;
create index reconciliations_offer_idx on reconciliations (offer_id);
alter table reconciliations enable row level security;
create sequence orchestration_fence_seq;

alter table share_refs
  add constraint share_refs_reconciliation_fk
  foreign key (issued_for_reconciliation_id) references reconciliations(id);
create unique index share_refs_issued_for_reconciliation_id_unique
  on share_refs (issued_for_reconciliation_id) where issued_for_reconciliation_id is not null;

-- Owner-executed view (NOT security_invoker: scorecard_reader has no grant
-- on reconciliations; the joins run as the view owner).
create view activation_events as
select e.id, e.reconciliation_id, e.created_at,
  case when e.reconciliation_id is null then 'casual' else 'invited' end as funnel,
  coalesce(
    e.payload ->> 'ref_code',
    (select v.ref_code from reconciliations r2 join visits v on v.id = r2.visit_id
      where r2.id = e.reconciliation_id)
  ) as ref_code,
  case when e.reconciliation_id is null then null
       else (select r2.visit_id from reconciliations r2 where r2.id = e.reconciliation_id) end as visit_id
from events e
left join reconciliations r on r.id = e.reconciliation_id
where e.event_type = 'reconciliation_completed'
  and coalesce(r.is_demo, false) = false;

-- invites: hashed single-use tokens into a seat. plaintext_token is the
-- naive-phase concession (D2-naive) so an offerer's table can show every
-- link's id and copy it until it is used.
create table invites (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references reconciliations(id),
  seat text not null check (seat in ('buyer', 'seller', 'broker')),
  acts_for text check (acts_for in ('buyer', 'seller')),
  email text,
  email_bound boolean not null default true,
  token_hash text not null,
  plaintext_token text,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  redeemed_by_auth_uid uuid,
  redeemed_by_identity_id uuid references identities(id),
  created_at timestamptz not null default now(),
  unique (token_hash),
  check (seat = 'broker' or acts_for is null)
);
alter table invites enable row level security;
create index invites_reconciliation_id_idx on invites (reconciliation_id);

-- participants: authoritative membership. `side` is the side whose figures
-- this seat enters: the seat itself for buyer/seller, acts_for for a broker.
create table participants (
  reconciliation_id uuid not null references reconciliations(id),
  seat text not null check (seat in ('buyer', 'seller', 'broker')),
  acts_for text check (acts_for in ('buyer', 'seller')),
  side text generated always as (case when seat = 'broker' then acts_for else seat end) stored,
  invite_id uuid references invites(id),
  bound_auth_uid uuid,
  created_at timestamptz not null default now(),
  check (seat = 'broker' or acts_for is null)
);
create unique index participants_one_broker
  on participants (reconciliation_id) where seat = 'broker';
create unique index participants_one_per_side
  on participants (reconciliation_id, side) where side is not null;
alter table participants enable row level security;

-- figures: the fact table and its metadata trigger
create table figures (
  id uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references reconciliations(id),
  side text not null check (side in ('buyer', 'seller')),
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
  unique (reconciliation_id, side)
);
alter table figures enable row level security;

create function figures_set_metadata()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select r.vertical, r.currency into strict new.vertical, new.currency
  from reconciliations r where r.id = new.reconciliation_id;
  new.region := coalesce(new.region, 'unknown');
  new.unit := 'currency';
  new.entry_date := current_date;
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function figures_set_metadata() from public;
alter function figures_set_metadata() owner to schema_owner_internal;
create trigger figures_set_metadata_trigger
  before insert on figures
  for each row execute function figures_set_metadata();

-- results and the internal tables
create table results (
  reconciliation_id uuid primary key references reconciliations(id),
  payload jsonb not null,
  engine_version text not null,
  algorithm_version text not null,
  computed_at timestamptz not null default now()
);
alter table results enable row level security;

create table honesty_signal_storage (
  reconciliation_id uuid not null references reconciliations(id),
  side text not null check (side in ('buyer', 'seller')),
  signals jsonb not null,
  signal_set_version text not null,
  created_at timestamptz not null default now(),
  primary key (reconciliation_id, side)
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

-- tags: invented by their owner, per vertical, owned through an access map
create table tags (
  id uuid primary key default gen_random_uuid(),
  access_map_id uuid not null references access_maps(id),
  vertical text not null,
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (access_map_id, vertical, name)
);
alter table tags enable row level security;

create table tag_links (
  reconciliation_id uuid not null references reconciliations(id),
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reconciliation_id, tag_id)
);
alter table tag_links enable row level security;
