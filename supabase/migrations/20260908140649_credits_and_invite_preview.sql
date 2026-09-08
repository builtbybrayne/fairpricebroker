-- T3-m1-platform-naive-auth §3.4-3.5, §3.7: ensure_identity, the launch
-- credit ledger, and invite_preview; plus the platform-owned wrapper that
-- reserves-then-creates (data-core §2.5's entitlement gate).

create function ensure_identity() returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if jwt_uid() is null then raise exception 'not-authenticated'; end if;
  select id into v_id from identities where auth_user_id = jwt_uid();
  if v_id is null then
    insert into identities (kind, auth_user_id, email)
    values ('user', jwt_uid(), jwt_email()) returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function ensure_identity() from public;
alter function ensure_identity() owner to schema_owner_internal;

create table credit_ledger (
  id bigserial primary key,
  account_identity_id uuid not null references identities(id),
  delta integer not null,
  reason text not null check (reason in ('launch-grant', 'reconciliation-debit', 'release')),
  request_key text not null,
  created_at timestamptz not null default now(),
  unique (account_identity_id, request_key)
);
alter table credit_ledger enable row level security;
create view credit_balances as
  select account_identity_id, coalesce(sum(delta), 0)::integer as balance
  from credit_ledger group by account_identity_id;
grant select, insert on credit_ledger to schema_owner_internal;
grant usage, select on sequence credit_ledger_id_seq to schema_owner_internal;
grant select on credit_balances to schema_owner_internal;

create function grant_launch_credits() returns integer
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal integer;
begin
  v_id := ensure_identity();
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  values (v_id, 20, 'launch-grant', 'launch-grant:' || v_id::text)
  on conflict (account_identity_id, request_key) do nothing;
  select balance into v_bal from credit_balances where account_identity_id = v_id;
  return coalesce(v_bal, 0);
end $$;
revoke execute on function grant_launch_credits() from public;
alter function grant_launch_credits() owner to schema_owner_internal;

create function reserve_and_debit_launch_credit(p_request_key text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal integer; v_existing bigint;
begin
  if p_request_key is null or p_request_key = '' then raise exception 'invalid-request-key'; end if;
  v_id := ensure_identity();
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select id into v_existing from credit_ledger
    where account_identity_id = v_id and request_key = p_request_key;
  if v_existing is not null then return 'already-debited'; end if;
  select coalesce(sum(delta), 0) into v_bal from credit_ledger where account_identity_id = v_id;
  if v_bal < 1 then raise exception 'insufficient-credits'; end if;
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  values (v_id, -1, 'reconciliation-debit', p_request_key);
  return 'debited';
end $$;
revoke execute on function reserve_and_debit_launch_credit(text) from public;
alter function reserve_and_debit_launch_credit(text) owner to schema_owner_internal;

create function release_launch_credit(p_request_key text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := ensure_identity();
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  select v_id, 1, 'release', 'release:' || p_request_key
  where exists (select 1 from credit_ledger
                where account_identity_id = v_id and request_key = p_request_key and delta = -1)
  on conflict (account_identity_id, request_key) do nothing;
end $$;
revoke execute on function release_launch_credit(text) from public;
alter function release_launch_credit(text) owner to schema_owner_internal;

create function current_credit_balance() returns integer
language sql security definer stable set search_path = public as $$
  select coalesce((select balance from credit_balances
                   where account_identity_id = (select id from identities where auth_user_id = jwt_uid())), 0);
$$;
revoke execute on function current_credit_balance() from public;
alter function current_credit_balance() owner to schema_owner_internal;

-- The platform-owned reserve-then-create capability data-core §2.5 names:
-- create_invited_session is NOT granted to authenticated; this wrapper is.
-- Running as one statement, a failed create rolls the debit back with it
-- (RELEASE by atomicity). A replayed request_key raises rather than
-- creating a second session.
create function launch_invited_session(
  p_request_key text, template_id text, currency text, composition text,
  visit_id uuid, creator_direction text, invite_grants jsonb
) returns table (session_id uuid, invite_id uuid, role text, plaintext_token text)
language plpgsql security definer set search_path = public as $$
declare v_outcome text;
begin
  v_outcome := reserve_and_debit_launch_credit(p_request_key);
  if v_outcome <> 'debited' then raise exception 'duplicate-request'; end if;
  return query select * from create_invited_session(
    template_id, currency, composition, visit_id, creator_direction, invite_grants);
end $$;
revoke execute on function launch_invited_session(text, text, text, text, uuid, text, jsonb) from public;
alter function launch_invited_session(text, text, text, text, uuid, text, jsonb) owner to schema_owner_internal;

create function invite_preview(p_token text)
returns table (session_id uuid, role text, email text, email_bound boolean,
               host_visibility text, state text, redeemable boolean)
language sql security definer stable set search_path = public as $$
  select i.session_id, i.role, i.email, i.email_bound, s.host_visibility, s.state,
    (i.redeemed_at is null and i.revoked_at is null and i.expires_at > now() and s.state = 'open')
  from invites i join sessions s on s.id = i.session_id
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;
revoke execute on function invite_preview(text) from public;
alter function invite_preview(text) owner to schema_owner_internal;
