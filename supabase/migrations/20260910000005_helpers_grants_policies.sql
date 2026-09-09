-- T3-m1-data-core §2.4 in the T3-m2 vocabulary: SECURITY DEFINER helpers,
-- schema_owner_internal's least-privilege grants, role-scoped policies for
-- the internal roles, and the client-facing policies.

grant select, insert, update on participants to schema_owner_internal;
grant select, insert, update on reconciliations to schema_owner_internal;
grant select, insert, update on invites to schema_owner_internal;
grant select, update on figures to schema_owner_internal;
grant select, insert on identities to schema_owner_internal;
grant select on developer_grants, visits, offers to schema_owner_internal;

-- The side whose figures the caller enters at this reconciliation: their
-- own seat if buyer or seller, the side they act for if broker.
create function side_for(p_reconciliation_id uuid)
returns text
language sql security definer stable
set search_path = public
as $$
  select side from participants
  where reconciliation_id = p_reconciliation_id
    and side is not null
    and bound_auth_uid = jwt_uid();
$$;

create function is_broker(p_reconciliation_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from participants
    where reconciliation_id = p_reconciliation_id and seat = 'broker' and bound_auth_uid = jwt_uid()
  );
$$;

-- RLS policy expressions run with the INVOKER's privileges, so a policy
-- cannot itself read `identities`; this resolves "is the caller the
-- creator" under schema_owner_internal.
create function is_creator(p_reconciliation_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from reconciliations r
    join identities i on i.id = r.creator_identity_id
    where r.id = p_reconciliation_id and i.auth_user_id = jwt_uid()
  );
$$;

-- The offerer's reach: a member of the offer's map sees every
-- reconciliation on the offer (the offerer sees all responses).
create function may_access_offer_of(p_reconciliation_id uuid, p_role text default 'viewer')
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from reconciliations r join offers o on o.id = r.offer_id
    where r.id = p_reconciliation_id and may_access(o.access_map_id, p_role)
  );
$$;

create function is_developer()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (select 1 from developer_grants where auth_uid = jwt_uid());
$$;

revoke execute on function side_for(uuid), is_broker(uuid), is_creator(uuid),
  may_access_offer_of(uuid, text), is_developer() from public;
grant execute on function side_for(uuid), is_broker(uuid), is_creator(uuid),
  may_access_offer_of(uuid, text), is_developer() to authenticated;
alter function side_for(uuid) owner to schema_owner_internal;
alter function is_broker(uuid) owner to schema_owner_internal;
alter function is_creator(uuid) owner to schema_owner_internal;
alter function may_access_offer_of(uuid, text) owner to schema_owner_internal;
alter function is_developer() owner to schema_owner_internal;

-- Internal-role grants (§2.5) and their matching role-scoped policies.
grant insert on results, honesty_signal_storage to orchestrator;
grant select, update (state, orchestration_claimed_at, orchestration_fence)
  on reconciliations to orchestrator;
grant select on figures to orchestrator;
grant insert, select on events to orchestrator;
grant insert, select on share_refs to orchestrator;
grant usage, select on sequence events_id_seq to orchestrator, casual_writer;
grant usage, select on sequence orchestration_fence_seq to orchestrator;
grant select on results to payload_reader;
grant select on events, share_refs, visits, activation_events to scorecard_reader;
grant insert on events, share_refs to casual_writer;
grant select on events to casual_writer;
grant insert on visits to ref_writer;

create policy figures_orchestrator_read on figures
  for select to orchestrator using (true);
create policy reconciliations_orchestrator_read on reconciliations
  for select to orchestrator using (true);
create policy results_payload_reader_read on results
  for select to payload_reader using (true);
create policy results_orchestrator_write on results
  for insert to orchestrator with check (true);
create policy honesty_signal_storage_orchestrator_write on honesty_signal_storage
  for insert to orchestrator with check (true);
create policy events_orchestrator_write on events
  for insert to orchestrator with check (reconciliation_id is not null);
create policy events_orchestrator_read on events
  for select to orchestrator using (reconciliation_id is not null);
create policy reconciliations_orchestrator_claim_and_close on reconciliations
  for update to orchestrator
  using (state = 'locked')
  with check (state in ('locked', 'closed'));
create policy share_refs_orchestrator_write on share_refs
  for insert to orchestrator with check (issued_for_reconciliation_id is not null);
create policy share_refs_orchestrator_replay_read on share_refs
  for select to orchestrator using (issued_for_reconciliation_id is not null);
create policy events_casual_writer_write on events
  for insert to casual_writer with check (reconciliation_id is null);
create policy events_casual_writer_replay_read on events
  for select to casual_writer using (
    reconciliation_id is null
      and event_type in ('reconciliation_completed', 'demo_stage_answered', 'demo_completed')
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
grant select on figures to authenticated;
grant insert (reconciliation_id, side, v1, v2, v3, v4, region) on figures to authenticated;
grant update (v1, v2, v3, v4) on figures to authenticated;
grant select on invites to authenticated;
grant select on reconciliations to authenticated;
grant select on participants to authenticated;
grant select, insert (vertical, offered_by, title, currency, v1, v2, v3, v4, access_map_id),
  update (title, v1, v2, v3, v4) on offers to authenticated;
grant select, insert (access_map_id, vertical, name), delete on tags to authenticated;
grant select, insert, delete on tag_links to authenticated;

create policy figures_select on figures
  for select to authenticated using (side_for(reconciliation_id) = side);
create policy figures_write on figures
  for insert to authenticated with check (
    side_for(reconciliation_id) = side
    and (select state from reconciliations where id = reconciliation_id) = 'open'
  );
create policy figures_update on figures
  for update to authenticated using (
    side_for(reconciliation_id) = side
    and status in ('draft', 'recalled')
  ) with check (
    side_for(reconciliation_id) = side
    and status in ('draft', 'recalled')
    and (select state from reconciliations where id = reconciliation_id) = 'open'
  );

create policy reconciliations_select on reconciliations
  for select to authenticated using (
    side_for(id) is not null
    or is_broker(id)
    or is_creator(id)
    or may_access_offer_of(id, 'viewer')
  );

-- A participant sees the seats at their own reconciliation, never figures.
create policy participants_select on participants
  for select to authenticated using (
    side_for(reconciliation_id) is not null
    or is_broker(reconciliation_id)
    or is_creator(reconciliation_id)
    or may_access_offer_of(reconciliation_id, 'viewer')
  );

create policy invites_select on invites
  for select to authenticated using (
    redeemed_by_auth_uid = jwt_uid()
    or is_creator(invites.reconciliation_id)
    or may_access_offer_of(invites.reconciliation_id, 'viewer')
  );

create policy offers_read on offers
  for select to authenticated using (may_access(access_map_id, 'viewer'));
create policy offers_insert on offers
  for insert to authenticated with check (may_access(access_map_id, 'member'));
create policy offers_update on offers
  for update to authenticated
  using (may_access(access_map_id, 'member')) with check (may_access(access_map_id, 'member'));

create policy tags_read on tags
  for select to authenticated using (may_access(access_map_id, 'viewer'));
create policy tags_write on tags
  for insert to authenticated with check (may_access(access_map_id, 'member'));
create policy tags_delete on tags
  for delete to authenticated using (may_access(access_map_id, 'member'));

create policy tag_links_all on tag_links for all to authenticated
  using (
    exists (select 1 from tags t where t.id = tag_id and may_access(t.access_map_id, 'member'))
    and (is_broker(reconciliation_id) or may_access_offer_of(reconciliation_id, 'member'))
  )
  with check (
    exists (select 1 from tags t where t.id = tag_id and may_access(t.access_map_id, 'member'))
    and (is_broker(reconciliation_id) or may_access_offer_of(reconciliation_id, 'member'))
  );
