-- T3-m1-recruitment-demo §2 (T2-data-layer §7 R5): demo-flagged events.
--
-- Demo stages ride the existing `events` table as session-less rows under
-- the existing `casual_writer` role and its `events_casual_writer_write`
-- policy (which already admits any `session_id is null` insert). What the
-- baseline lacks, and this migration adds:
--
--   1. an idempotency index for the two demo event types — the baseline's
--      partial unique index covers only `reconciliation_completed`;
--   2. a replay-read policy so `casual_writer` can see its own demo rows
--      when a stage POST is retried with the same key — the baseline's
--      replay-read policy is also scoped to `reconciliation_completed`;
--   3. the `demo_answers` read-only view for validation reading
--      (`scorecard_reader`).
--
-- Stage 5 writes BOTH a `demo_stage_answered` row and a `demo_completed`
-- row under the same idempotency key (T3-m1-recruitment-demo §4 V1: five
-- stage rows plus one completion), so the index is per (key, event_type).
-- `activation_events` filters on `reconciliation_completed`, so demo rows
-- never reach it.

create unique index events_one_demo_row_per_idempotency_key_and_type
  on events (idempotency_key, event_type)
  where session_id is null
    and event_type in ('demo_stage_answered', 'demo_completed');

create policy events_casual_writer_demo_replay_read on events
  for select to casual_writer using (
    session_id is null
      and event_type in ('demo_stage_answered', 'demo_completed')
  );

-- Owner-executed view (same form as activation_events, see
-- 20260908140631_sessions.sql for why security_invoker is not set).
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
where e.session_id is null
  and e.event_type in ('demo_stage_answered', 'demo_completed')
  and coalesce((e.payload ->> 'demo')::boolean, false) = true;

grant select on demo_answers to scorecard_reader;
