-- T3-m1-data-core §2.2/§2.5: sessions, the deferred share_refs FK, the
-- orchestration claim/fence columns, and the activation_events view.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('invited', 'survey')),
  composition text check (composition in ('creator-as-party', 'creator-as-host')),
  template_id text not null,
  host_visibility text not null default 'blind'
    check (host_visibility in ('blind', 'host-visible')),
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
create unique index sessions_visit_id_unique on sessions (visit_id) where visit_id is not null;
alter table sessions enable row level security;
create sequence orchestration_fence_seq;

alter table share_refs
  add constraint share_refs_session_fk
  foreign key (issued_for_session_id) references sessions(id);
create unique index share_refs_issued_for_session_id_unique
  on share_refs (issued_for_session_id) where issued_for_session_id is not null;

-- Owner-executed view (default, NOT security_invoker): scorecard_reader is
-- granted SELECT on the view only, and the view's joins through sessions/
-- visits run as the view owner. VERIFY-AT-EXECUTION finding: a plain view
-- does NOT inherit its base tables' RLS for the invoker unless
-- security_invoker is set, so the brief's grant set (no sessions grant for
-- scorecard_reader) only works with the owner-executed form.
create view activation_events as
select e.id, e.session_id, e.created_at,
  case when e.session_id is null then 'casual' else 'invited' end as funnel,
  coalesce(
    e.payload ->> 'ref_code',
    (select v.ref_code from sessions s2 join visits v on v.id = s2.visit_id where s2.id = e.session_id)
  ) as ref_code,
  case when e.session_id is null then null
       else (select s2.visit_id from sessions s2 where s2.id = e.session_id) end as visit_id
from events e
left join sessions s on s.id = e.session_id
where e.event_type = 'reconciliation_completed'
  and coalesce(s.is_demo, false) = false;
