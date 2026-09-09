-- T3-m2-domain-terms §4: ownership and access. Every owned object points
-- at an access map. A map answers two questions: who OWNS it (exactly one
-- actor, for billing, purge and transfer) and who MAY USE it (members with
-- a role). Actors are typed: 'user' now; 'team' and 'org' later, resolved
-- at policy time through one helper, may_access(). Every user gets a
-- personal map on first use (personal_map()).

create table access_maps (
  id uuid primary key default gen_random_uuid(),
  owner_kind text not null check (owner_kind in ('user', 'team', 'org')),
  owner_id uuid not null,
  -- the one map that stands for a user themself; found, never chosen
  is_personal boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index access_maps_one_personal_per_owner
  on access_maps (owner_kind, owner_id) where is_personal;
alter table access_maps enable row level security;

create table access_members (
  map_id uuid not null references access_maps(id) on delete cascade,
  actor_kind text not null check (actor_kind in ('user', 'team', 'org')),
  actor_id uuid not null,
  role text not null check (role in ('owner', 'manager', 'member', 'viewer')),
  added_at timestamptz not null default now(),
  primary key (map_id, actor_kind, actor_id)
);
alter table access_members enable row level security;

-- Roles rank so a policy can ask for "at least manager".
create function access_role_rank(p_role text) returns integer
language sql immutable as $$
  select case p_role when 'owner' then 4 when 'manager' then 3
                     when 'member' then 2 when 'viewer' then 1 else 0 end;
$$;
revoke execute on function access_role_rank(text) from public;
grant execute on function access_role_rank(text) to authenticated, schema_owner_internal;

-- The caller may act on the map at the given role or higher. Only user
-- actors resolve today; team and org membership joins in here later.
create function may_access(p_map_id uuid, p_role text default 'viewer') returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from access_members m
    where m.map_id = p_map_id
      and m.actor_kind = 'user' and m.actor_id = jwt_uid()
      and access_role_rank(m.role) >= access_role_rank(p_role)
  );
$$;
revoke execute on function may_access(uuid, text) from public;
grant execute on function may_access(uuid, text) to authenticated;
alter function may_access(uuid, text) owner to schema_owner_internal;

-- The caller's personal map, created on first call with the caller as
-- its one owner.
create function personal_map() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := jwt_uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  select id into v_id from access_maps
  where owner_kind = 'user' and owner_id = v_uid and is_personal;
  if v_id is null then
    insert into access_maps (owner_kind, owner_id, is_personal)
    values ('user', v_uid, true) returning id into v_id;
    insert into access_members (map_id, actor_kind, actor_id, role)
    values (v_id, 'user', v_uid, 'owner');
  end if;
  return v_id;
end $$;
revoke execute on function personal_map() from public;
grant execute on function personal_map() to authenticated;
alter function personal_map() owner to schema_owner_internal;

-- A map always keeps at least one owner member, and the billing owner is
-- always one of them.
create function access_members_keep_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_map uuid := coalesce(old.map_id, new.map_id);
begin
  -- a map being deleted takes its members with it; only a surviving map
  -- must keep an owner
  if not exists (select 1 from access_maps where id = v_map) then return null; end if;
  if not exists (select 1 from access_members where map_id = v_map and role = 'owner') then
    raise exception 'access-map-needs-owner';
  end if;
  return null;
end $$;
revoke execute on function access_members_keep_owner() from public;
alter function access_members_keep_owner() owner to schema_owner_internal;
create constraint trigger access_members_keep_owner_trigger
  after update or delete on access_members
  deferrable initially deferred
  for each row execute function access_members_keep_owner();

grant select, insert on access_maps to schema_owner_internal;
grant select, insert, update, delete on access_members to schema_owner_internal;
grant select on access_maps to authenticated;
grant select, insert, update, delete on access_members to authenticated;

create policy access_maps_member_read on access_maps
  for select to authenticated using (may_access(id, 'viewer'));
create policy access_members_member_read on access_members
  for select to authenticated using (may_access(map_id, 'viewer'));
create policy access_members_owner_write on access_members
  for insert to authenticated with check (may_access(map_id, 'owner'));
create policy access_members_owner_update on access_members
  for update to authenticated
  using (may_access(map_id, 'owner')) with check (may_access(map_id, 'owner'));
create policy access_members_owner_delete on access_members
  for delete to authenticated using (may_access(map_id, 'owner'));
