-- T3-m1-data-core §2.4: SECURITY DEFINER helpers (owned by
-- schema_owner_internal), schema_owner_internal's least-privilege grants,
-- role-scoped policies for the internal roles, and client-facing policies.

grant select, insert, update on session_participants to schema_owner_internal;
grant select, insert, update on sessions to schema_owner_internal;
grant select, insert, update on invites to schema_owner_internal;
grant select, update on party_positions to schema_owner_internal;
grant select, insert on identities to schema_owner_internal;
grant select on developer_grants, visits to schema_owner_internal;
-- (insert on sessions added: create_invited_session creates the row.)

create function session_role_for(p_session_id uuid)
returns text
language sql security definer stable
set search_path = public
as $$
  select direction from session_participants
  where session_id = p_session_id
    and is_host = false
    and bound_auth_uid = jwt_uid();
$$;

create function is_session_host(p_session_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from session_participants
    where session_id = p_session_id and is_host = true and bound_auth_uid = jwt_uid()
  );
$$;

-- Added at execution: RLS policy expressions run with the INVOKER's
-- privileges, so a policy on sessions/invites cannot itself read
-- `identities` (no client grant). This helper resolves "is the caller the
-- creator" under schema_owner_internal instead.
create function is_session_creator(p_session_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from sessions s
    join identities i on i.id = s.creator_identity_id
    where s.id = p_session_id and i.auth_user_id = jwt_uid()
  );
$$;

create function is_developer()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from developer_grants where auth_uid = jwt_uid());
$$;

revoke execute on function session_role_for(uuid), is_session_host(uuid),
  is_session_creator(uuid), is_developer() from public;
grant execute on function session_role_for(uuid), is_session_host(uuid),
  is_session_creator(uuid), is_developer() to authenticated;
alter function session_role_for(uuid) owner to schema_owner_internal;
alter function is_session_host(uuid) owner to schema_owner_internal;
alter function is_session_creator(uuid) owner to schema_owner_internal;
alter function is_developer() owner to schema_owner_internal;

-- Internal-role grants (§2.5) and their matching role-scoped policies.
grant insert on results, honesty_signal_storage to orchestrator;
grant select, update (state, orchestration_claimed_at, orchestration_fence)
  on sessions to orchestrator;
grant select on party_positions to orchestrator;
grant insert, select on events to orchestrator;
-- select added at execution: INSERT ... ON CONFLICT needs SELECT privilege on
-- the target (the arbiter index read); admitted only for session-bound rows
-- by events_orchestrator_read below.
grant insert, select on share_refs to orchestrator;
grant usage, select on sequence events_id_seq to orchestrator, casual_writer;
grant usage, select on sequence orchestration_fence_seq to orchestrator;
grant select on results to payload_reader;
grant select on events, share_refs, visits, activation_events to scorecard_reader;
grant insert on events, share_refs to casual_writer;
grant select on events to casual_writer;
grant insert on visits to ref_writer;

create policy party_positions_orchestrator_read on party_positions
  for select to orchestrator using (true);
create policy sessions_orchestrator_read on sessions
  for select to orchestrator using (true);
create policy results_payload_reader_read on results
  for select to payload_reader using (true);
create policy results_orchestrator_write on results
  for insert to orchestrator with check (true);
create policy honesty_signal_storage_orchestrator_write on honesty_signal_storage
  for insert to orchestrator with check (true);
create policy events_orchestrator_write on events
  for insert to orchestrator with check (session_id is not null);
create policy events_orchestrator_read on events
  for select to orchestrator using (session_id is not null);
create policy sessions_orchestrator_claim_and_close on sessions
  for update to orchestrator
  using (state = 'locked')
  with check (state in ('locked', 'closed'));
create policy share_refs_orchestrator_write on share_refs
  for insert to orchestrator with check (issued_for_session_id is not null);
create policy share_refs_orchestrator_replay_read on share_refs
  for select to orchestrator using (issued_for_session_id is not null);
create policy events_casual_writer_write on events
  for insert to casual_writer with check (session_id is null);
create policy events_casual_writer_replay_read on events
  for select to casual_writer using (
    session_id is null and event_type = 'reconciliation_completed'
  );
create policy share_refs_casual_writer_write on share_refs
  for insert to casual_writer with check (true);
create policy visits_ref_writer_write on visits
  for insert to ref_writer with check (true);
create policy events_scorecard_reader_read on events
  for select to scorecard_reader using (true);
create policy share_refs_scorecard_reader_read on share_refs
  for select to scorecard_reader using (true);
create policy visits_scorecard_reader_read on visits
  for select to scorecard_reader using (true);

-- Client-facing grants (§2.3) and policies (§2.4).
grant select on party_positions to authenticated;
grant insert (session_id, direction, v1, v2, v3, v4, region) on party_positions to authenticated;
grant update (v1, v2, v3, v4) on party_positions to authenticated;
grant select on invites to authenticated;
grant select on sessions to authenticated;

create policy party_positions_select on party_positions
  for select to authenticated using (session_role_for(session_id) = direction);
create policy party_positions_write on party_positions
  for insert to authenticated with check (
    session_role_for(session_id) = direction
    and (select state from sessions where id = session_id) = 'open'
  );
create policy party_positions_update on party_positions
  for update to authenticated using (
    session_role_for(session_id) = direction
    and status in ('draft', 'recalled')
  ) with check (
    session_role_for(session_id) = direction
    and status in ('draft', 'recalled')
    and (select state from sessions where id = session_id) = 'open'
  );

create policy sessions_select on sessions
  for select to authenticated using (
    session_role_for(id) is not null
    or is_session_host(id)
    or is_session_creator(id)
  );

create policy invites_select on invites
  for select to authenticated using (
    redeemed_by_auth_uid = jwt_uid()
    or is_session_creator(invites.session_id)
  );
