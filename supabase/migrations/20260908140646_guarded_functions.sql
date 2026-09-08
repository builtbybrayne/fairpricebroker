-- T3-m1-data-core §2.5 guarded transition functions, plus the
-- T3-m1-recruitment-core §1 extension to create_invited_session.
-- All SECURITY DEFINER, owned by schema_owner_internal, EXECUTE revoked
-- from PUBLIC here; client grants are issued in the final migration.

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

create function create_invited_session(
  template_id text, currency text, composition text, visit_id uuid,
  creator_direction text, invite_grants jsonb
) returns table (session_id uuid, invite_id uuid, role text, plaintext_token text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := jwt_uid();
  v_identity uuid;
  v_session uuid;
  v_visibility text;
  v_expected_grants integer;
  v_grant jsonb;
  v_role text;
  v_email text;
  v_token text;
  v_invite uuid;
  v_seen text[] := '{}';
begin
  if v_uid is null then raise exception 'not-authenticated'; end if;
  if template_id is null or template_id = '' then raise exception 'invalid-template'; end if;
  if currency is null or currency = '' then raise exception 'invalid-currency'; end if;
  if composition not in ('creator-as-party', 'creator-as-host') then
    raise exception 'invalid-composition';
  end if;
  if creator_direction is not null
     and creator_direction not in ('low-preferring', 'high-preferring') then
    raise exception 'invalid-creator-direction';
  end if;
  if composition = 'creator-as-party' and creator_direction is null then
    raise exception 'creator-direction-required';
  end if;
  if jsonb_typeof(invite_grants) is distinct from 'array' then
    raise exception 'invalid-invite-grants';
  end if;
  -- Cardinality (T2-product-surfaces §2.10; recruitment-core §1 D1):
  -- creator-as-party -> 1 grant; creator-as-host with a direction -> 1
  -- grant (the other direction); creator-as-host without -> 2 grants.
  v_expected_grants := case when creator_direction is null then 2 else 1 end;
  if jsonb_array_length(invite_grants) <> v_expected_grants then
    raise exception 'invite-grant-cardinality';
  end if;
  if visit_id is not null and not exists (select 1 from visits v where v.id = visit_id) then
    raise exception 'unknown-visit';
  end if;

  v_identity := identity_for_current_uid();
  v_visibility := case template_id when 'recruitment' then 'host-visible' else 'blind' end;

  insert into sessions (type, composition, template_id, host_visibility, currency, state,
                        creator_identity_id, visit_id)
  values ('invited', composition, template_id, v_visibility, currency, 'open',
          v_identity, visit_id)
  returning id into v_session;

  if composition = 'creator-as-host' then
    insert into session_participants (session_id, is_host, bound_auth_uid)
    values (v_session, true, v_uid);
  end if;
  if creator_direction is not null then
    insert into session_participants (session_id, direction, is_host, bound_auth_uid)
    values (v_session, creator_direction, false, v_uid);
  end if;

  for v_grant in select * from jsonb_array_elements(invite_grants) loop
    v_role := v_grant ->> 'role';
    v_email := nullif(trim(v_grant ->> 'email'), '');
    if v_role not in ('low-preferring', 'high-preferring') then
      raise exception 'invalid-grant-role';
    end if;
    if v_role = creator_direction or v_role = any (v_seen) then
      raise exception 'duplicate-grant-role';
    end if;
    if v_email is null then raise exception 'grant-email-required'; end if;
    v_seen := v_seen || v_role;
    v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
    v_token := replace(v_token, E'\n', '');
    insert into invites (session_id, role, email, email_bound, token_hash, expires_at)
    values (v_session, v_role, v_email, true,
            encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
            now() + interval '14 days')
    returning id into v_invite;
    session_id := v_session; invite_id := v_invite; role := v_role; plaintext_token := v_token;
    return next;
  end loop;
  return;
end $$;
revoke execute on function create_invited_session(text, text, text, uuid, text, jsonb) from public;
alter function create_invited_session(text, text, text, uuid, text, jsonb) owner to schema_owner_internal;

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
  select state into v_state from sessions where id = v_inv.session_id for update;
  if v_state is distinct from 'open' then raise exception 'session-not-open'; end if;
  if v_inv.email_bound then
    if jwt_email() is null or lower(jwt_email()) <> lower(v_inv.email) then
      raise exception 'email-mismatch';
    end if;
  end if;

  v_identity := identity_for_current_uid(case when v_inv.email_bound then v_inv.email end);

  update invites set redeemed_at = now(), redeemed_by_auth_uid = v_uid,
    redeemed_by_identity_id = v_identity
  where id = v_inv.id;

  if v_inv.role = 'host' then
    insert into session_participants (session_id, is_host, invite_id, bound_auth_uid)
    values (v_inv.session_id, true, v_inv.id, v_uid);
  else
    insert into session_participants (session_id, direction, is_host, invite_id, bound_auth_uid)
    values (v_inv.session_id, v_inv.role, false, v_inv.id, v_uid);
  end if;
  return v_inv.session_id;
end $$;
revoke execute on function redeem_invite(text, text) from public;
alter function redeem_invite(text, text) owner to schema_owner_internal;

create function submit_position(session_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_dir text := session_role_for(session_id);
  v_state text;
  v_status text;
  v_other_submitted boolean;
begin
  if v_dir is null then raise exception 'not-a-party'; end if;
  select state into v_state from sessions s where s.id = submit_position.session_id for update;
  if v_state is distinct from 'open' then raise exception 'session-not-open'; end if;
  select status into v_status from party_positions pp
  where pp.session_id = submit_position.session_id and pp.direction = v_dir for update;
  if v_status is null then raise exception 'no-position'; end if;
  if v_status not in ('draft', 'recalled') then raise exception 'already-submitted'; end if;
  update party_positions pp set status = 'submitted', submitted_at = now()
  where pp.session_id = submit_position.session_id and pp.direction = v_dir;
  select exists (
    select 1 from party_positions pp
    where pp.session_id = submit_position.session_id and pp.direction <> v_dir
      and pp.status = 'submitted'
  ) into v_other_submitted;
  if v_other_submitted then
    update sessions s set state = 'locked' where s.id = submit_position.session_id;
    return 'locked';
  end if;
  return 'open';
end $$;
revoke execute on function submit_position(uuid) from public;
alter function submit_position(uuid) owner to schema_owner_internal;

create function recall_position(session_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_dir text := session_role_for(session_id);
  v_state text;
  v_status text;
begin
  if v_dir is null then raise exception 'not-a-party'; end if;
  select state into v_state from sessions s where s.id = recall_position.session_id for update;
  if v_state is distinct from 'open' then raise exception 'session-not-open'; end if;
  select status into v_status from party_positions pp
  where pp.session_id = recall_position.session_id and pp.direction = v_dir for update;
  if v_status is distinct from 'submitted' then raise exception 'not-submitted'; end if;
  if exists (
    select 1 from party_positions pp
    where pp.session_id = recall_position.session_id and pp.direction <> v_dir
      and pp.status = 'submitted'
  ) then raise exception 'other-party-submitted'; end if;
  update party_positions pp set status = 'recalled'
  where pp.session_id = recall_position.session_id and pp.direction = v_dir;
end $$;
revoke execute on function recall_position(uuid) from public;
alter function recall_position(uuid) owner to schema_owner_internal;

create function cancel_session(session_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_state text; v_submitted integer;
begin
  if not is_session_creator(session_id) then raise exception 'not-creator'; end if;
  select state into v_state from sessions s where s.id = cancel_session.session_id for update;
  if v_state is distinct from 'open' then raise exception 'session-not-open'; end if;
  select count(*) into v_submitted from party_positions pp
  where pp.session_id = cancel_session.session_id and pp.status = 'submitted';
  if v_submitted >= 2 then raise exception 'both-submitted'; end if;
  update sessions s set state = 'cancelled' where s.id = cancel_session.session_id;
  update invites i set revoked_at = now()
  where i.session_id = cancel_session.session_id and i.redeemed_at is null and i.revoked_at is null;
end $$;
revoke execute on function cancel_session(uuid) from public;
alter function cancel_session(uuid) owner to schema_owner_internal;

create function request_visibility_disclosure(session_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare v_vis text;
begin
  if jwt_uid() is null then raise exception 'not-authenticated'; end if;
  if session_role_for(session_id) is null
     and not is_session_host(session_id)
     and not is_session_creator(session_id)
     and not exists (
       select 1 from invites i
       where i.session_id = request_visibility_disclosure.session_id
         and i.redeemed_at is null and i.revoked_at is null and i.expires_at > now()
         and i.email_bound and lower(i.email) = lower(coalesce(jwt_email(), ''))
     )
  then raise exception 'no-role'; end if;
  select host_visibility into v_vis from sessions s
  where s.id = request_visibility_disclosure.session_id;
  if v_vis is null then raise exception 'no-role'; end if;
  return v_vis;
end $$;
revoke execute on function request_visibility_disclosure(uuid) from public;
alter function request_visibility_disclosure(uuid) owner to schema_owner_internal;
