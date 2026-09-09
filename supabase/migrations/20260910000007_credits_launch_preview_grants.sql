-- T3-m1-platform-naive-auth §3.4-3.5, §3.7 in the T3-m2 vocabulary:
-- ensure_identity, the launch credit ledger (8 credits), invite_preview,
-- the platform-owned reserve-then-create wrapper, the demo view, and the
-- client-facing EXECUTE set (issued last so no forward reference exists).

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

-- New accounts start with 8 free credits (operator, 9 Sep 2026).
create function grant_launch_credits() returns integer
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_bal integer;
begin
  v_id := ensure_identity();
  insert into credit_ledger (account_identity_id, delta, reason, request_key)
  values (v_id, 8, 'launch-grant', 'launch-grant:' || v_id::text)
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

-- The platform-owned reserve-then-create capability: create_reconciliation
-- is NOT granted to authenticated; this wrapper is. A failed create rolls
-- the debit back with it; a replayed request_key raises.
create function launch_reconciliation(
  p_request_key text, p_vertical text, p_currency text, p_creator_seat text,
  p_creator_acts_for text, p_visit_id uuid, p_invite_grants jsonb, p_offer_id uuid default null
) returns table (reconciliation_id uuid, invite_id uuid, seat text, plaintext_token text)
language plpgsql security definer set search_path = public as $$
declare v_outcome text;
begin
  v_outcome := reserve_and_debit_launch_credit(p_request_key);
  if v_outcome <> 'debited' then raise exception 'duplicate-request'; end if;
  return query select * from create_reconciliation(
    p_vertical, p_currency, p_creator_seat, p_creator_acts_for, p_visit_id, p_invite_grants, p_offer_id);
end $$;
revoke execute on function launch_reconciliation(text, text, text, text, text, uuid, jsonb, uuid) from public;
alter function launch_reconciliation(text, text, text, text, text, uuid, jsonb, uuid) owner to schema_owner_internal;

create function invite_preview(p_token text)
returns table (reconciliation_id uuid, seat text, acts_for text, email text, email_bound boolean,
               broker_sees_figures boolean, state text, redeemable boolean)
language sql security definer stable set search_path = public as $$
  select i.reconciliation_id, i.seat, i.acts_for, i.email, i.email_bound, r.broker_sees_figures, r.state,
    (i.redeemed_at is null and i.revoked_at is null and i.expires_at > now() and r.state = 'open')
  from invites i join reconciliations r on r.id = i.reconciliation_id
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;
revoke execute on function invite_preview(text) from public;
alter function invite_preview(text) owner to schema_owner_internal;

-- Demo stages ride `events` as reconciliation-less rows (T3-m1-recruitment-demo §2).
create view demo_answers as
select
  e.id,
  (e.payload ->> 'demo_id')::uuid as demo_id,
  (e.payload ->> 'stage')::int as stage,
  e.event_type,
  e.payload -> 'answers' as answers,
  e.payload ->> 'comment' as comment,
  e.payload ->> 'ref_code' as ref_code,
  e.payload ->> 'vertical' as vertical,
  e.idempotency_key,
  e.created_at
from events e
where e.reconciliation_id is null
  and e.event_type in ('demo_stage_answered', 'demo_completed')
  and coalesce((e.payload ->> 'demo')::boolean, false) = true;
grant select on demo_answers to scorecard_reader;

-- The client-facing EXECUTE set. create_reconciliation is deliberately
-- absent (entitlement gate: reachable only through launch_reconciliation).
grant execute on function
  submit_figures(uuid), recall_figures(uuid), cancel_reconciliation(uuid),
  redeem_invite(text, text), broker_sees_figures_for(uuid),
  ensure_identity(), grant_launch_credits(),
  reserve_and_debit_launch_credit(text), release_launch_credit(text),
  current_credit_balance(),
  launch_reconciliation(text, text, text, text, text, uuid, jsonb, uuid)
  to authenticated;
grant execute on function invite_preview(text) to anon, authenticated;
