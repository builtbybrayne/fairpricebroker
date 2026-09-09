-- T3-m1-data-core §2.5 guarded transition functions in the T3-m2
-- vocabulary. All SECURITY DEFINER, owned by schema_owner_internal,
-- EXECUTE revoked from PUBLIC here; client grants come in the final file.

create function identity_for_current_uid(p_email text default null)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare v_uid uuid := jwt_uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  select id into v_id from identities where auth_user_id = v_uid;
  if v_id is null then
    insert into identities (kind, auth_user_id, email)
    values ('user', v_uid, coalesce(p_email, jwt_email()))
    returning id into v_id;
  end if;
  return v_id;
end $$;
revoke execute on function identity_for_current_uid(text) from public;
alter function identity_for_current_uid(text) owner to schema_owner_internal;

-- Which verticals let the broker see both sides' figures (R7 / R11).
create function vertical_broker_sees_figures(p_vertical text) returns boolean
language sql immutable as $$
  select p_vertical in ('salary-negotiation');
$$;
revoke execute on function vertical_broker_sees_figures(text) from public;
grant execute on function vertical_broker_sees_figures(text) to schema_owner_internal, authenticated;

-- create_reconciliation: the creator takes one seat (buyer, seller, or
-- broker acting for a side, or a pure broker); the invite grants must
-- cover exactly the sides the creator does not. Grants:
--   [{ "seat": "seller" }, { "seat": "buyer", "email": "x@y" }]
create function create_reconciliation(
  p_vertical text, p_currency text, p_creator_seat text, p_creator_acts_for text,
  p_visit_id uuid, p_invite_grants jsonb, p_offer_id uuid default null
) returns table (reconciliation_id uuid, invite_id uuid, seat text, plaintext_token text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := jwt_uid();
  v_identity uuid;
  v_rec uuid;
  v_creator_side text;
  v_covered text[] := '{}';
  v_grant jsonb;
  v_seat text;
  v_email text;
  v_token text;
  v_invite uuid;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  if p_vertical is null or p_vertical = '' then raise exception 'invalid-vertical'; end if;
  if p_currency is null or p_currency = '' then raise exception 'invalid-currency'; end if;
  if p_creator_seat not in ('buyer', 'seller', 'broker') then raise exception 'invalid-seat'; end if;
  if p_creator_acts_for is not null and p_creator_acts_for not in ('buyer', 'seller') then
    raise exception 'invalid-acts-for';
  end if;
  if p_creator_seat <> 'broker' and p_creator_acts_for is not null then
    raise exception 'acts-for-is-for-brokers';
  end if;
  if jsonb_typeof(p_invite_grants) is distinct from 'array' then
    raise exception 'invalid-invite-grants';
  end if;
  if p_visit_id is not null and not exists (select 1 from visits v where v.id = p_visit_id) then
    raise exception 'unknown-visit';
  end if;
  if p_offer_id is not null then
    if not exists (select 1 from offers o where o.id = p_offer_id and may_access(o.access_map_id, 'member')) then
      raise exception 'no-such-offer';
    end if;
  end if;

  v_creator_side := case when p_creator_seat = 'broker' then p_creator_acts_for else p_creator_seat end;
  if v_creator_side is not null then v_covered := v_covered || v_creator_side; end if;

  v_identity := identity_for_current_uid();

  insert into reconciliations (kind, vertical, offer_id, broker_sees_figures, currency, state,
                               creator_identity_id, visit_id)
  values ('invited', p_vertical, p_offer_id, vertical_broker_sees_figures(p_vertical), p_currency,
          'open', v_identity, p_visit_id)
  returning id into v_rec;

  insert into participants (reconciliation_id, seat, acts_for, bound_auth_uid)
  values (v_rec, p_creator_seat, p_creator_acts_for, v_uid);

  for v_grant in select * from jsonb_array_elements(p_invite_grants) loop
    v_seat := v_grant ->> 'seat';
    v_email := nullif(trim(v_grant ->> 'email'), '');
    if v_seat not in ('buyer', 'seller') then raise exception 'invalid-grant-seat'; end if;
    if v_seat = any (v_covered) then raise exception 'duplicate-grant-seat'; end if;
    v_covered := v_covered || v_seat;
    v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
    v_token := replace(v_token, E'\n', '');
    insert into invites (reconciliation_id, seat, email, email_bound, token_hash, plaintext_token, expires_at)
    values (v_rec, v_seat, v_email, v_email is not null,
            encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
            case when v_email is null then v_token end,
            now() + interval '14 days')
    returning id into v_invite;
    reconciliation_id := v_rec; invite_id := v_invite; seat := v_seat; plaintext_token := v_token;
    return next;
  end loop;

  -- Every side must be covered exactly once: by the creator or by a grant.
  if not ('buyer' = any (v_covered) and 'seller' = any (v_covered)) then
    raise exception 'invite-grant-cardinality';
  end if;
  return;
end $$;
revoke execute on function create_reconciliation(text, text, text, text, uuid, jsonb, uuid) from public;
alter function create_reconciliation(text, text, text, text, uuid, jsonb, uuid) owner to schema_owner_internal;

create function redeem_invite(token text, invitee_email text default null)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := jwt_uid();
  v_inv invites%rowtype;
  v_state text;
  v_identity uuid;
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  select * into v_inv from invites
  where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
  for update;
  if not found then raise exception 'invite-not-found'; end if;
  if v_inv.revoked_at is not null then raise exception 'invite-revoked'; end if;
  if v_inv.redeemed_at is not null then raise exception 'invite-already-redeemed'; end if;
  if v_inv.expires_at <= now() then raise exception 'invite-expired'; end if;
  select state into v_state from reconciliations where id = v_inv.reconciliation_id for update;
  if v_state is distinct from 'open' then raise exception 'reconciliation-not-open'; end if;
  if v_inv.email_bound then
    if jwt_email() is null or lower(jwt_email()) <> lower(v_inv.email) then
      raise exception 'email-mismatch';
    end if;
  end if;

  v_identity := identity_for_current_uid(case when v_inv.email_bound then v_inv.email end);

  update invites set redeemed_at = now(), redeemed_by_auth_uid = v_uid,
    redeemed_by_identity_id = v_identity,
    email = coalesce(email, jwt_email())    -- an unbound invite learns who used it
  where id = v_inv.id;                       -- the link stays readable (spent, so
                                             -- not copyable) so links can be told apart

  insert into participants (reconciliation_id, seat, acts_for, invite_id, bound_auth_uid)
  values (v_inv.reconciliation_id, v_inv.seat, v_inv.acts_for, v_inv.id, v_uid);
  return v_inv.reconciliation_id;
end $$;
revoke execute on function redeem_invite(text, text) from public;
alter function redeem_invite(text, text) owner to schema_owner_internal;

create function submit_figures(p_reconciliation_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_side text := side_for(p_reconciliation_id);
  v_state text;
  v_status text;
  v_other_submitted boolean;
begin
  if v_side is null then raise exception 'not-a-side'; end if;
  select state into v_state from reconciliations r where r.id = p_reconciliation_id for update;
  if v_state is distinct from 'open' then raise exception 'reconciliation-not-open'; end if;
  select status into v_status from figures f
  where f.reconciliation_id = p_reconciliation_id and f.side = v_side for update;
  if v_status is null then raise exception 'no-figures'; end if;
  if v_status not in ('draft', 'recalled') then raise exception 'already-submitted'; end if;
  update figures f set status = 'submitted', submitted_at = now()
  where f.reconciliation_id = p_reconciliation_id and f.side = v_side;
  select exists (
    select 1 from figures f
    where f.reconciliation_id = p_reconciliation_id and f.side <> v_side and f.status = 'submitted'
  ) into v_other_submitted;
  if v_other_submitted then
    update reconciliations r set state = 'locked' where r.id = p_reconciliation_id;
    return 'locked';
  end if;
  return 'open';
end $$;
revoke execute on function submit_figures(uuid) from public;
alter function submit_figures(uuid) owner to schema_owner_internal;

create function recall_figures(p_reconciliation_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_side text := side_for(p_reconciliation_id);
  v_state text;
  v_status text;
begin
  if v_side is null then raise exception 'not-a-side'; end if;
  select state into v_state from reconciliations r where r.id = p_reconciliation_id for update;
  if v_state is distinct from 'open' then raise exception 'reconciliation-not-open'; end if;
  select status into v_status from figures f
  where f.reconciliation_id = p_reconciliation_id and f.side = v_side for update;
  if v_status is distinct from 'submitted' then raise exception 'not-submitted'; end if;
  if exists (
    select 1 from figures f
    where f.reconciliation_id = p_reconciliation_id and f.side <> v_side and f.status = 'submitted'
  ) then raise exception 'other-side-submitted'; end if;
  update figures f set status = 'recalled'
  where f.reconciliation_id = p_reconciliation_id and f.side = v_side;
end $$;
revoke execute on function recall_figures(uuid) from public;
alter function recall_figures(uuid) owner to schema_owner_internal;

create function cancel_reconciliation(p_reconciliation_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_state text; v_submitted integer;
begin
  if not is_creator(p_reconciliation_id) then raise exception 'not-creator'; end if;
  select state into v_state from reconciliations r where r.id = p_reconciliation_id for update;
  if v_state is distinct from 'open' then raise exception 'reconciliation-not-open'; end if;
  select count(*) into v_submitted from figures f
  where f.reconciliation_id = p_reconciliation_id and f.status = 'submitted';
  if v_submitted >= 2 then raise exception 'both-submitted'; end if;
  update reconciliations r set state = 'cancelled' where r.id = p_reconciliation_id;
  update invites i set revoked_at = now(), plaintext_token = null
  where i.reconciliation_id = p_reconciliation_id and i.redeemed_at is null and i.revoked_at is null;
end $$;
revoke execute on function cancel_reconciliation(uuid) from public;
alter function cancel_reconciliation(uuid) owner to schema_owner_internal;

-- R11: the persisted fact a side is told before entering figures.
create function broker_sees_figures_for(p_reconciliation_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare v_flag boolean;
begin
  if jwt_uid() is null then raise exception 'not-authenticated'; end if;
  if side_for(p_reconciliation_id) is null
     and not is_broker(p_reconciliation_id)
     and not is_creator(p_reconciliation_id)
     and not exists (
       select 1 from invites i
       where i.reconciliation_id = p_reconciliation_id
         and i.redeemed_at is null and i.revoked_at is null and i.expires_at > now()
         and i.email_bound and lower(i.email) = lower(coalesce(jwt_email(), ''))
     )
  then raise exception 'no-seat'; end if;
  select broker_sees_figures into v_flag from reconciliations r where r.id = p_reconciliation_id;
  if v_flag is null then raise exception 'no-seat'; end if;
  return v_flag;
end $$;
revoke execute on function broker_sees_figures_for(uuid) from public;
alter function broker_sees_figures_for(uuid) owner to schema_owner_internal;
