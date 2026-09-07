---
id: T3-m1-data-core
plan_kind: thematic
tier: 3
t2_parent: T2-data-layer
milestone: M1-working-instrument
status: draft
---

# T3 — M1 data core: the vault, the ledger, the payload constructor

## 0. Human summary (plain language)

**Build the database and the one safe doorway to it.** This brief creates
the tables that hold everyone's numbers, locks every one of them down so
nobody can read or write anything they are not explicitly allowed to
(not even by accident, not even an AI agent, not even the person who
built it, poking around with a raw query), and writes the single piece
of code allowed to turn a computed result into something a person or an
agent is actually shown — different views for each party, the go-between,
and the person running the system. It also lays the tracks for "we know
someone finished the game" (so the business can count activation) and
sketches the nightly export/backup job without touching any cloud
account yet. The hardest, most safety-critical part — proving that no
role can ever see the other side's numbers, even if they try to trick
the system — gets the most testing.

---

> Parent: `T2-data-layer` (all principles §2, components §3, verification
> §4). Milestone: `M1-working-instrument` item 3. Depends on:
> `T3-m1-scaffold` completed (local Supabase up, `src/lib/server/data/`
> exists, `.env` written) and `T3-m1-engine-port` completed (`FIELD_CLASSES`,
> `PricePoint`, `OutputDecimal`, `ReconcileResult`, `Role` importable from
> `src/lib/server/engine`). Consumes T2-product-surfaces §2.2 (lifecycle
> transition contract) and §2.4 (role matrix) as the specification for the
> guarded transition functions and the payload constructor's viewer
> classes — this brief does not re-derive either, it implements them.
> Money/precision boundary is T2-engine §2.6 and the engine's
> `DecimalString`/`OutputDecimal` grammar (T3-m1-engine-port §2.1); this
> brief stores what the engine validates, it does not re-validate decimal
> grammar in SQL beyond the ascending/positivity checks stated below.
>
> Cloud-side backup delivery (B2 bucket, credentials, scheduling) is
> explicitly deferred to the operator-assisted cloud-wiring brief, per
> T2-data-layer §2.9's interface split ("this layer produces the nightly
> dump ... scheduling, storage target, credentials ... are T2-platform's")
> and T3-m1-scaffold §3's cloud boundary. This brief's nightly-job scope is
> the local, testable half: refresh, export, and produce the encrypted
> dump artefact on disk.

## 1. Environment facts (pinned)

- Depends on `T3-m1-scaffold`'s local Supabase (`npx -y supabase@2.115.0
  start`) and its `.env` (`SUPABASE_DB_URL`, `PUBLIC_SUPABASE_URL`,
  `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). If `.env` is
  absent or step 6 of that brief was Docker-blocked, STOP — this brief
  cannot proceed without a live local Postgres instance to migrate and
  test against.
- Migration tool: Supabase CLI, pinned per the scaffold brief:
  `npx -y supabase@2.115.0 migration new <name>` creates
  `supabase/migrations/<timestamp>_<name>.sql`; `npx -y supabase@2.115.0
  db reset` replays all migrations against the local instance from
  scratch (destructive to local data only — this is the mechanism this
  brief's verification uses to get a clean, migrated database for every
  test run). **VERIFY AT EXECUTION:** confirm `db reset` and `migration
  new` behave as documented against the pinned 2.115.0 CLI in this
  checkout (flag syntax can drift between CLI minor versions even within
  a pin).
- Target directories (created empty by the scaffold brief):
  `src/lib/server/data/` (payload constructor, raw-result reader, events/
  attribution module, nightly-job script, RLS/adversarial test suites)
  and `supabase/migrations/` (schema).
- Test runner: Vitest `server` project (node environment, non-`.svelte.`
  files under `src/**`), run via `npm run test:unit -- --run`, exactly as
  wired by the scaffold brief. The adversarial RLS suite additionally
  needs a Postgres client library to connect as specific roles —
  **`postgres` (the `postgres-js` package) is proposed** as it is
  lightweight and TypeScript-native; **VERIFY AT EXECUTION:** no such
  dependency exists yet in this repo (only what `sv add` generated), so
  confirm it installs cleanly (`npm install -D postgres@3`) before
  writing tests against it, and pin the resolved version once installed.
- Money and tuple values arrive already validated by the engine
  (`DecimalString` grammar, magnitude domain, strict ascending — T3-m1-
  engine-port §2.1–2.4). This brief's job is **storage and access
  control**, not re-validation of decimal grammar; the schema does
  re-assert ascending order and positivity as defense-in-depth (§2.2)
  because the database must never trust an application-layer guarantee
  for a security-relevant invariant, but it does not re-implement the
  engine's exact-decimal comparison — Postgres `numeric` is exact
  arbitrary-precision by construction, so a native `<` comparison on
  `numeric` columns is sound here (unlike the engine's string-grammar
  case, where "100" vs "100.00" needed a hand-rolled exact comparator
  before conversion — that problem does not recur once values are stored
  as `numeric`).
- **Supabase role/auth facts assumed by this design, flagged for
  execution-time confirmation:** (a) the `service_role` Postgres/API role
  bypasses RLS entirely — this is documented, longstanding Supabase
  behaviour, which is exactly why T2-data-layer §2.2 requires the
  orchestrator's and payload constructor's privilege to be a
  **narrowly-scoped custom role**, never the blanket `service_role` (§2.5,
  §2.6 below implement this); (b) `auth.uid()` resolves the calling
  JWT's subject inside RLS policies and SQL functions under Supabase's
  Postgres extensions. **VERIFY AT EXECUTION:** confirm both against the
  locally running `supabase@2.115.0` stack (`select auth.uid()` in a
  `psql` session authenticated as `anon`/`authenticated` via PostgREST,
  and a `service_role`-keyed request against an RLS-protected table)
  before relying on them in the adversarial suite.
- **Invitee principal mechanism — not pinned by any T2, a judgement call
  this brief must make (recorded as Deviation D1, §5).** T2-platform §2.2
  defines the *invitee* principal's identity ("a one-time email-link
  principal bound to one role in one session; stable identifier = the
  invite grant, not an account") but not the concrete Supabase
  auth mechanism. This brief assumes invite redemption mints a Supabase
  **anonymous session** (`supabase.auth.signInAnonymously()`) whose JWT
  carries the redeemed invite's id as a custom claim, and all RLS/session-
  membership lookups key off `(session_id, auth.uid())` via the
  SECURITY DEFINER helpers in §2.4 — never off a client-asserted role or
  invite id in the request body. **VERIFY AT EXECUTION:** confirm
  Supabase's anonymous-auth + custom-claims mechanism (likely a
  `auth.hook.custom_access_token` Postgres function, or an Auth Hook
  configured in `supabase/config.toml`) against the pinned CLI/GoTrue
  version; if anonymous auth or custom claims are unavailable as assumed,
  the fallback is a server-minted, short-lived signed token verified in
  application code before every data-layer call — record which path was
  actually used in the capture (§4).

## 2. Files and steps (exact)

### 2.1 Migration mechanics

Every migration below is created with:
```bash
npx -y supabase@2.115.0 migration new <name>
```
then its SQL body is written into the generated file (do not hand-name
files; let the CLI timestamp them, so ordering is mechanical). Apply and
verify with:
```bash
npx -y supabase@2.115.0 db reset
```
which must exit 0 and re-seed nothing (no seed file is created by this
brief — §3 out-of-scope). Run `db reset` after every migration is written,
not only at the end, so a broken migration is caught at the step that
introduced it.

### 2.2 Schema migrations

**`identities`** — PII-bearing, purgeable (T2-data-layer §3.1, §2.8):
```sql
create table identities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('user', 'org')),
  auth_user_id uuid unique references auth.users(id),
  email text,
  display_name text,
  purged_at timestamptz,
  created_at timestamptz not null default now()
);
-- Erasure (T2 §2.8 R2): purge sets email/display_name to a fixed
-- placeholder and stamps purged_at; the row is never deleted (the
-- identities.id is the stable FK target for every fact row's audit
-- trail and for the tombstone log).
alter table identities enable row level security;
-- Deny-by-default: no policy is added here. Identity rows are reached
-- only through the data-subject export function (§2.7) and the
-- guarded transition functions that need to resolve "am I the creator
-- of this session" — never by a direct client SELECT on this table.
```

**`sessions`**:
```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('invited', 'survey')),
  -- casual is stateless and never rows here (T2-data-layer §2.8, §6 R1).
  composition text check (composition in ('creator-as-party', 'creator-as-host')),
  -- required when type = 'invited'; null for 'survey'.
  template_id text not null,
  currency text not null,
  state text not null default 'open'
    check (state in ('open', 'locked', 'closed', 'cancelled')),
  -- T2-product-surfaces §2.2's canonical session state, distinct from
  -- per-participant submission status (party_positions.status below).
  creator_identity_id uuid references identities(id),
  visit_id uuid references visits(id),
  -- nullable; carries the attribution funnel's ref->visit->session key
  -- (T2-data-layer §2.6) when the session was created from a ref'd visit.
  created_at timestamptz not null default now()
);
alter table sessions enable row level security;
-- Deny-by-default; see §2.4 for the narrow SELECT policy (creator and
-- participants only, never a listing of other people's sessions).
```
(`visits` and its ref table are created in §2.2's events/attribution
migration below; `sessions` is created after it in migration order so the
FK resolves — sequence the migrations accordingly: attribution tables
first, then `identities`, then `sessions`.)

**`party_positions`** — the fact table (T2-data-layer §3.1, §2.4):
```sql
create table party_positions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  direction text not null check (direction in ('low-preferring', 'high-preferring')),
  v1 numeric not null, v2 numeric not null, v3 numeric not null, v4 numeric not null,
  check (v1 > 0 and v1 < v2 and v2 < v3 and v3 < v4),
  -- Defense-in-depth re-assertion of the engine's ascending/positivity
  -- rule (T3-m1-engine-port §2.3) at the storage boundary; this is NOT a
  -- re-implementation of the engine's exact-decimal comparator — numeric
  -- comparison is exact by construction (see §1).
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'recalled')),
  submitted_at timestamptz,
  -- Metadata snapshot (T2-data-layer §2.4): copied at write time, never
  -- joined at read time; explicitly-unknown sentinels, never NULL-as-absence.
  vertical text not null,
  region text not null default 'unknown',
  unit text not null default 'currency',
  currency text not null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (session_id, direction)
);
alter table party_positions enable row level security;
```

**`results`** (T2-data-layer §3.1, §2.2 — the raw-result reader's sole
target; no SELECT policy exists for any client role, ever):
```sql
create table results (
  session_id uuid primary key references sessions(id),
  payload jsonb not null,
  -- the full engine ReconcileResult, JSON-serialised verbatim (PricePoint
  -- objects, layers, honesty, curves, meta — everything T3-m1-engine-port
  -- §2.2 defines). Field classification is NOT stored per-row; it is
  -- looked up from the engine's exported FIELD_CLASSES map at read time
  -- (§2.7) so a schema/map drift is a single source of truth, not two
  -- copies that can disagree.
  engine_version text not null,
  algorithm_version text not null,
  computed_at timestamptz not null default now()
);
alter table results enable row level security;
-- No policy. Zero rows are ever selectable through PostgREST/the anon or
-- authenticated Supabase roles. The only path in is the SECURITY DEFINER
-- function in §2.5/§2.7, invoked under a role granted EXECUTE on it and
-- nothing else on this table.
```

**`invites`** (T2-product-surfaces §2.10, T2-data-layer §3.1):
```sql
create table invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  role text not null,
  -- for invited sessions: the direction/role being granted; for survey,
  -- 'respondent'.
  email text,
  -- required (email-bound, single-use) for invited-party grants;
  -- nullable for survey shareable-link invites (T2-product-surfaces §2.10).
  email_bound boolean not null default true,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_identity_id uuid references identities(id),
  -- null for an anonymous-session redemption (the common invitee case);
  -- set only if the redeemer happens to also hold an account.
  created_at timestamptz not null default now()
);
alter table invites enable row level security;
```

**`events`** and the attribution funnel tables (T2-data-layer §2.6–2.7,
§3.1). Create this migration BEFORE `sessions` (sessions.visit_id
references `visits`):
```sql
create table share_refs (
  ref_code text primary key,
  issued_for_session_id uuid,  -- nullable FK added post-sessions via a
                                -- deferred ALTER in the sessions migration
  created_at timestamptz not null default now()
);
create table visits (
  id uuid primary key default gen_random_uuid(),
  ref_code text references share_refs(ref_code),
  created_at timestamptz not null default now()
);
create table events (
  id bigserial primary key,
  session_id uuid,
  -- nullable: casual completion events carry no session row (T2-data-
  -- layer §2.8 — casual persists no price data, only the event).
  event_type text not null,
  sequence bigint not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, event_type, sequence)
);
-- Idempotent completion event (T2-data-layer §2.6): "exactly one
-- completion event per session" is a stronger constraint than the
-- general (session_id, event_type, sequence) dedup above — a partial
-- unique index enforces it regardless of what sequence value is passed:
create unique index events_one_completion_per_session
  on events (session_id)
  where event_type = 'reconciliation_completed';
alter table share_refs enable row level security;
alter table visits enable row level security;
alter table events enable row level security;
-- Deny-by-default on all three: refs/visits are written only by the
-- landing-page route's server code (service-scoped) and events are
-- written only by the guarded transition functions and the casual
-- server endpoint; no client role gets a policy. The scorecard agent
-- reads via a dedicated read-only role (§2.5) or the nightly export,
-- per T2-data-layer §2.7 — both out of this brief's UI/agent-wiring
-- scope but the read-only role is created here (§2.5) since it is a
-- schema-level grant.
```
Then, after `sessions` exists:
```sql
alter table share_refs
  add constraint share_refs_session_fk
  foreign key (issued_for_session_id) references sessions(id);
```

**`honesty_signal_storage`** (developer-only, T2-data-layer §3.1;
T3-m1-engine-port §2.2's `HonestySignals`, one row per party per session):
```sql
create table honesty_signal_storage (
  session_id uuid not null references sessions(id),
  direction text not null check (direction in ('low-preferring', 'high-preferring')),
  signals jsonb not null,
  signal_set_version text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, direction)
);
alter table honesty_signal_storage enable row level security;
-- No policy for anon/authenticated. Only the developer role (§2.5) and
-- the orchestrator (which writes it alongside results) can reach this.
```

**`purge_tombstone_log`** (T2-data-layer §2.8, §3.1):
```sql
create table purge_tombstone_log (
  id bigserial primary key,
  identity_id uuid not null references identities(id),
  purged_at timestamptz not null default now(),
  cascade_summary jsonb not null,
  -- counts/ids of invites, attribution rows, and export bundles touched.
  replayed_on_restore_at timestamptz
);
alter table purge_tombstone_log enable row level security;
-- No client policy; written by the erasure routine (out of this
-- brief's build scope per §3 — schema only), read by the restore
-- tombstone-replay step (also out of scope, §3) and by the developer role.
```

**`billing_reference`** (T2-data-layer §3.1 item 1 — the neutral seam;
T2-platform §2.3/§2.4 own the ledger logic that will write to it, which
is explicitly out of scope for this brief, §3):
```sql
create table billing_reference (
  id bigserial primary key,
  account_identity_id uuid not null references identities(id),
  provider text not null,
  provider_event_id text not null,
  event_kind text not null,
  -- deliberately untyped beyond "text": T2-data-layer §3.1 requires this
  -- table to carry "no assumptions about credits or subscription
  -- shapes" — the credit/entitlement semantics are T2-platform's, unbuilt
  -- here.
  occurred_at timestamptz not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
alter table billing_reference enable row level security;
-- No client policy; this table has no consumer in M1 (no checkout
-- exists — M1 §3). It exists now so its shape never has to be
-- retrofitted under live billing data (T1 §2.4: day-one schema decision).
```

### 2.3 Deny-by-default grants baseline

RLS alone is necessary but not sufficient — Postgres also needs table-
level `GRANT`s before RLS policies are even consulted for a role. Confirm
and lock the baseline explicitly in its own migration (belt-and-braces;
Supabase's default `anon`/`authenticated` roles typically receive broad
grants when a table is created via the dashboard, but this schema is
migration-authored, so state the intent mechanically rather than relying
on an assumed default):
```sql
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
-- Then, and ONLY then, grant back the narrow set that has a
-- corresponding RLS policy in §2.4:
grant select, insert, update on party_positions to authenticated;
grant select on invites to authenticated;  -- policy restricts to own invite
grant execute on function submit_position, recall_position,
  cancel_session, redeem_invite, create_invited_session,
  get_role_safe_payload, request_data_subject_export
  to authenticated;
-- (function list finalised once §2.5/§2.7 are written; this GRANT
-- statement is issued in the LAST migration of this brief, after every
-- function exists, so no forward reference is needed.)
```
**VERIFY AT EXECUTION:** confirm what grants a fresh `supabase db reset`
actually leaves in place for `anon`/`authenticated` on newly created
tables in this CLI version before assuming the explicit `revoke all` is
redundant — treat it as required regardless, since an incorrect
assumption here is a security bug, not a style choice.

### 2.4 RLS policies and SECURITY DEFINER helpers

Two helper functions resolve identity/membership server-side (T2-data-
layer §2.1: "always derived server-side from persisted state — never
accepted from a caller"). Both are `SECURITY DEFINER`, owned by a
migration-created low-privilege owner role (not `postgres`), with
`search_path` pinned per Postgres's SECURITY DEFINER hardening guidance:
```sql
create function session_role_for(p_session_id uuid)
returns text
language sql security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from party_positions pp
      join invites i on i.session_id = pp.session_id and i.role = pp.direction
      where pp.session_id = p_session_id
        and i.redeemed_by_auth_uid = auth.uid()
    ) then (
      select pp.direction from party_positions pp
      join invites i on i.session_id = pp.session_id and i.role = pp.direction
      where pp.session_id = p_session_id and i.redeemed_by_auth_uid = auth.uid()
    )
    when exists (
      select 1 from sessions s join identities id on id.id = s.creator_identity_id
      where s.id = p_session_id and id.auth_user_id = auth.uid()
        and s.composition = 'creator-as-party'
    ) then (
      select pp.direction from party_positions pp
      join sessions s on s.id = pp.session_id
      join identities id on id.id = s.creator_identity_id
      where pp.session_id = p_session_id and id.auth_user_id = auth.uid()
      limit 1
    )
    else null
  end;
$$;
```
**Deviation from a clean design, flagged honestly:** `invites` as drafted
in §2.2 has no `redeemed_by_auth_uid` column — it has
`redeemed_by_identity_id`, which is only set for account-holding
redeemers. Anonymous invitees (the common case, §1's invitee mechanism)
have no `identities` row at all. **Fix folded into §2.2 before this
migration is written:** add `redeemed_by_auth_uid uuid` to `invites`
(nullable, set to `auth.uid()` at redemption regardless of whether the
session is anonymous or account-backed) — this is the column the
function above actually needs, and it is `auth.uid()`-keyed precisely so
the RLS story doesn't depend on whether an `identities` row exists. Apply
this column addition inside the `invites` migration itself (§2.2), not as
a later ALTER, since no data exists yet at authoring time — this note
exists so the discrepancy is not silently carried into two migrations
that disagree.

```sql
create function is_session_host(p_session_id uuid)
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from sessions s join identities id on id.id = s.creator_identity_id
    where s.id = p_session_id and id.auth_user_id = auth.uid()
      and s.composition = 'creator-as-host'
  );
$$;

create function is_developer()
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from pg_roles where rolname = current_user and rolname = 'developer_operator'
  );
$$;
-- Developer identity is granted by database role membership (T2-data-
-- layer §3.1: "developer ... internal-only class; granted by database
-- role, never user-selectable" — T2-product-surfaces §2.4 role matrix).
-- VERIFY AT EXECUTION: confirm Supabase's local/hosted Postgres exposes
-- pg_roles to a SECURITY DEFINER function under the pinned CLI version,
-- and that a named operator's JWT can be mapped to a Postgres role
-- (`current_user`) rather than staying `authenticated` throughout —
-- this is the one piece of the developer path this brief cannot
-- confirm without running it; if role-mapping is not straightforward
-- under Supabase Auth, the fallback is a `developer_grants` table
-- (identity_id, granted_by, granted_at) checked by `auth.uid()` instead
-- of `current_user`, which is the safer default if in doubt.
```

Policies (deny-by-default; each table gets exactly the policies below,
nothing broader):
```sql
create policy party_positions_select on party_positions
  for select using (session_role_for(session_id) = direction);
create policy party_positions_write on party_positions
  for insert with check (
    session_role_for(session_id) = direction
    and (select state from sessions where id = session_id) = 'open'
  );
create policy party_positions_update on party_positions
  for update using (
    session_role_for(session_id) = direction
    and status = 'draft'
  ) with check (
    session_role_for(session_id) = direction
    and status = 'draft'
    and (select state from sessions where id = session_id) = 'open'
  );
-- Status transitions to 'submitted'/'recalled' are NEVER reachable
-- through this UPDATE policy (it requires status = 'draft' on both
-- sides of the check) — they exist only inside submit_position/
-- recall_position (§2.5), which run SECURITY DEFINER and therefore
-- bypass this restrictive policy entirely, which is the point: the
-- lifecycle guard lives in one place, not in RLS twice.

create policy sessions_select on sessions
  for select using (
    session_role_for(id) is not null
    or is_session_host(id)
    or (select auth_user_id from identities where id = creator_identity_id) = auth.uid()
  );
-- No sessions INSERT/UPDATE policy at all: session creation and every
-- state transition go through guarded functions only (§2.5).

create policy invites_select on invites
  for select using (
    redeemed_by_auth_uid = auth.uid()
    or (select auth_user_id from identities id
        join sessions s on s.creator_identity_id = id.id
        where s.id = session_id) = auth.uid()
  );
-- No invites INSERT/UPDATE policy: issuance and redemption go through
-- guarded functions (§2.5) so single-use/expiry/email-binding are
-- enforced once, centrally, never bypassable via a direct table write.
```
No policies are added for `identities`, `results`, `honesty_signal_
storage`, `purge_tombstone_log`, `billing_reference`, `share_refs`,
`visits`, or `events` — deny-by-default means the absence of a policy
IS the control for these tables; every legitimate access path into them
is a SECURITY DEFINER function (§2.5, §2.7) or the developer role.

### 2.5 Guarded transition functions

Implementing T2-product-surfaces §2.2's invited-session transition
contract (survey transitions are out of scope, §3 — survey mode is not
M1). Each function is `SECURITY DEFINER`, validates the actor and the
guard condition itself (never trusts the RLS layer, which it bypasses),
and is the only way the corresponding state change happens:

- `create_invited_session(template_id text, currency text, composition
  text, party_or_host_emails text[]) returns uuid` — creates the
  `sessions` row (`state = 'open'`), the matching `invites` row(s) per
  §2.2's cardinality rule (one grant for creator-as-party, two for
  creator-as-host — T2-product-surfaces §2.10), each with a
  cryptographically random single-use token embedded in its `id` (a
  `uuid` primary key is already unguessable; no separate token column is
  needed) and `expires_at` set to a fixed default. **Credit debit is
  explicitly NOT this function's job** — T2-platform §2.3 owns
  entitlement debit and is out of scope here (§3); this function creates
  the session unconditionally in M1 (free launch credits, no checkout —
  M1 item 5/§3 defers the entitlement gate to T2-platform's own T3).
- `redeem_invite(invite_id uuid) returns void` — checks
  `expires_at > now()`, `redeemed_at is null`, and (for email-bound
  invites) that the redeeming session's verified email matches
  `invites.email`; sets `redeemed_at`, `redeemed_by_auth_uid = auth.uid()`.
  A second redemption attempt on the same invite errors (`redeemed_at is
  not null`) — this is the row-level half of "invite-replay after
  redemption ... denied" (T2-data-layer §4).
- `submit_position(session_id uuid) returns void` — the caller's role
  resolved via `session_role_for`; requires an existing `draft` row for
  that role with all four values set; sets `status = 'submitted',
  submitted_at = now()`; if the OTHER party's row is now also
  `submitted`, transitions `sessions.state` to `'locked'` and calls
  `compute_and_store_result(session_id)` (below) in the same
  transaction — success leaves `state = 'closed'`; failure (engine
  returns `{ok:false}` — should be unreachable given upstream
  validation, but handled per T2-product-surfaces §2.2's "stays `locked`
  with an operator-visible error state, never a silent close") writes a
  `computation_failed` event and leaves `state = 'locked'`.
- `recall_position(session_id uuid) returns void` — the caller's role
  must be `submitted`; the OTHER role must NOT be `submitted` (first-
  submitter-can-recall asymmetry, T2-product-surfaces §2.2); sets
  `status = 'recalled'`. A subsequent `submit_position` call re-submits.
- `cancel_session(session_id uuid) returns void` — caller must be the
  creator; guard: neither party is `submitted`; sets `state =
  'cancelled'`.
- `compute_and_store_result(session_id uuid) returns void` — the ONLY
  function that reads both parties' `party_positions` rows together (it
  is the "narrow orchestrator" of T2-data-layer §2.2: "the only
  privileged data path"). Reads both rows, builds `DirectionalParty`
  values, calls the pure engine's `reconcile()` (imported from
  `src/lib/server/engine`), and on `{ok:true}` inserts into `results`
  and `honesty_signal_storage`, then inserts the idempotent
  `reconciliation_completed` event (§2.2's partial unique index makes a
  second insert for the same session a no-op via `on conflict (session_id)
  where event_type = 'reconciliation_completed' do nothing`), then sets
  `sessions.state = 'closed'`. **This function runs inside the SvelteKit
  server process, not as a Postgres `plpgsql` function** — the pure
  engine is TypeScript (T2-engine §2.1: "no I/O ... performs no I/O"),
  so it cannot run inside Postgres itself; `compute_and_store_result` as
  named above is therefore a **TypeScript function** in
  `src/lib/server/data/orchestrator.ts`, called by `submit_position`'s
  caller (the API route) immediately after the SQL `submit_position` RPC
  returns a "now locked, compute" signal, using a dedicated Postgres
  connection `SET ROLE`'d to a narrow `orchestrator` role (created below)
  that has `INSERT` on `results`/`honesty_signal_storage`/`events` and
  `UPDATE` on `sessions.state` and nothing else — never the connection's
  default role. **This correction (SQL guard function hands off to a TS
  orchestrator, rather than one SQL function doing both) is Deviation D2,
  §5** — the initial phrasing above (SQL function calling the engine) is
  impossible given the engine's language, and is written out fully here
  rather than silently fixed, because it is exactly the kind of
  plausible-sounding error this brief's own hard rules warn against
  fabricating past.

```sql
create role orchestrator noinherit nologin;
grant insert on results, honesty_signal_storage to orchestrator;
grant select, update (state) on sessions to orchestrator;
grant insert on events to orchestrator;
create role payload_reader noinherit nologin;
grant select on results to payload_reader;
create role scorecard_reader noinherit nologin;
grant select on events, share_refs, visits to scorecard_reader;
-- T2-data-layer §2.7: "the scorecard agent reads via a read-only role
-- or the nightly export (both remain available)" — this creates the
-- role; wiring an actual scorecard agent/credential is out of scope (§3).
```
**VERIFY AT EXECUTION:** confirm the exact mechanics of a Node/`postgres`-
js connection performing `SET ROLE orchestrator` (or `payload_reader`)
against Supabase's local Postgres, and whether Supabase's connection
pooling (PgBouncer/Supavisor, if fronting the local instance the same
way it fronts hosted projects) preserves `SET ROLE` for the statement(s)
that follow within one connection lifetime — if pooling silently resets
role between statements, switch to per-role dedicated connection strings
(`orchestrator`/`payload_reader` as first-class login roles with their
own password, granted only `EXECUTE`/`SELECT`/`INSERT` as above, each
given its own entry in `.env`) instead of `SET ROLE` on a shared
connection. Either mechanism satisfies "narrowly-scoped role... audited
invocations" (T2-data-layer §2.2); which one is used is a fact to record
in the capture (§4), not to assume here.

### 2.6 Aggregate views (exist, unpublished at M1 volumes)

Per M1 item 3 ("aggregate views exist but publish nothing at M1
volumes") and T2-data-layer §2.5/§3.1 item 4:
```sql
create view aggregate_fair_price_by_cell as
select
  vertical, region, currency, direction,
  count(distinct session_id) as distinct_subjects,
  percentile_cont(0.5) within group (order by (r.payload->>'fairPrice')::jsonb->>'float') as median_fair_price
from party_positions pp
join results r on r.session_id = pp.session_id
group by vertical, region, currency, direction;
-- N>=20 gate and suppression logic (T2-data-layer §2.5) live in a
-- second view layered on top, so the boundary rule is one readable
-- predicate, testable in isolation:
create view aggregate_fair_price_published as
select * from aggregate_fair_price_by_cell where distinct_subjects >= 20;
```
No cron, no materialised-view refresh schedule, no consumer route, and
no suppression-differencing logic beyond the N>=20 predicate are built
here — T2-data-layer §2.5's full suppression rule (successive/overlapping
release differencing) is explicitly deferred; at M1's volumes (a handful
of pilot sessions) `aggregate_fair_price_published` will be empty by
construction, which is the stated M1 behaviour ("publish nothing at M1
volumes"), not a bug to chase. §4's verification checks only that the
gate itself is correct on synthetic fixture data, not that the view is
non-empty.

### 2.7 The payload constructor (`src/lib/server/data/`)

**`rawResultReader.ts`** — the only module permitted to select from
`results`:
```typescript
import postgres from 'postgres';
// Connection uses the payload_reader role (§2.5) — VERIFY AT EXECUTION
// per §2.5's SET ROLE vs. dedicated-connection-string note.

export async function readRawResult(sessionId: string): Promise<unknown> {
	// SELECT payload FROM results WHERE session_id = $1, under payload_reader.
	// Returns the raw JSONB payload (untyped at this boundary — the
	// constructor re-hydrates it against the engine's ReconcileResult
	// shape before redacting).
}
```

**`payloadConstructor.ts`** — imports `rawResultReader.ts` and the
engine's `FIELD_CLASSES`/types; nothing else in the codebase imports
`rawResultReader.ts` (§4's code-level check enforces this):
```typescript
import { FIELD_CLASSES, type ReconcileResult, type Role } from '$lib/server/engine';
import { readRawResult } from './rawResultReader';

export type Viewer =
	| { kind: 'party'; role: Role }
	| { kind: 'host' }
	| { kind: 'developer' }
	| { kind: 'casual' };

export type RoleSafePayload = Record<string, unknown>;

export async function constructPayload(
	sessionId: string,
	viewer: Viewer
): Promise<RoleSafePayload> {
	const result = (await readRawResult(sessionId)) as ReconcileResult;
	return redact(result, viewer);
}

function redact(result: ReconcileResult, viewer: Viewer): RoleSafePayload {
	if (viewer.kind === 'casual') return { ...result }; // full-detail exception
	const out: RoleSafePayload = {};
	for (const [path, cls] of Object.entries(FIELD_CLASSES)) {
		const include =
			viewer.kind === 'developer' ||
			(cls.class === 'per-party-safe' &&
				(viewer.kind === 'host' ||
					cls.owner === 'both' ||
					(viewer.kind === 'party' && cls.owner === viewer.role)));
		if (include) assignByPath(out, path, readByPath(result, path));
	}
	return out;
}
```
**Design synthesis, not a T2 restatement (documented, not fabricated as
a T2 ruling) — record as Deviation D3, §5:** T2-data-layer §2.2 pins the
party and casual classes explicitly (own-distance-only no-deal contract;
full-detail casual exception) but does not spell out exactly which
fields a **host** or **developer** viewer receives — that is left to be
synthesised from T2-product-surfaces §2.4's role matrix ("host ... sees
host-safe: outcome summary + the two 'what Party X sees' panels; never
inputs" and "developer ... sees internal-only class"). This brief reads
"the two what-Party-X-sees panels" as: the host receives every
`per-party-safe` field regardless of owner (both parties' own outcome
views, including each one's own distance) but never an `internal-only`
field (raw tuples, layers, curves, honesty) — i.e. host = union of both
parties' party-safe payloads, never the raw engine internals. Developer
receives everything, per the internal-only class's stated purpose (T3-m1-
engine-port §2.2: "the class exists in the type for T2-data-layer's
contract").

### 2.8 Events and attribution module

**`events.ts`**:
```typescript
export async function recordCasualCompletion(refCode: string | null, templateId: string): Promise<void> {
	// INSERT INTO events (session_id, event_type, payload)
	// VALUES (NULL, 'reconciliation_completed', jsonb_build_object('template_id', templateId, 'ref_code', refCode))
	// -- casual carries no session_id (T2-data-layer §2.8); the partial
	// -- unique index on events(session_id) WHERE event_type=... only
	// -- constrains non-null session_id, so repeated casual completions
	// -- (many different anonymous plays) are NOT deduped against each
	// -- other — only a given INVITED session's completion is singular.
	// Runs under a narrow 'casual_writer' role granted INSERT on events
	// only (create alongside orchestrator/payload_reader in §2.5).
}

export async function issueRef(sessionId: string | null): Promise<string> {
	// INSERT INTO share_refs (ref_code, issued_for_session_id) ...
	// ref_code generation: VERIFY AT EXECUTION which short-code scheme
	// (nanoid vs a Postgres sequence-based base62) — not pinned by any T2;
	// nanoid (already a common SvelteKit-ecosystem dependency) is proposed
	// but unconfirmed as installed in this repo at authoring time.
}
```
The completion event's idempotency for INVITED sessions is enforced at
the database (§2.2's partial unique index), not in this TypeScript layer
— `compute_and_store_result` (§2.5) is the only writer of a
session-bound `reconciliation_completed` event, and its `on conflict ...
do nothing` makes a retry (e.g. a network retry re-running the same
lock->close transition) a true no-op, matching T2-data-layer §2.6's
"exactly one completion event per session, emitted idempotently."

### 2.9 Nightly job skeleton (local scope only)

**`src/lib/server/data/nightlyJob.ts`** plus a runnable entry script
`scripts/nightly-job.ts` (invoked manually for M1 verification; actual
scheduling is cloud-side and out of scope, §3):

1. Refresh: re-run `aggregate_fair_price_published` (a plain view here,
   so "refresh" is a no-op query, not a `REFRESH MATERIALIZED VIEW` — if
   volumes later justify materialising it, that is a future brief's
   change, not this one's).
2. Export snapshot: `pg_dump --data-only --table=events
   --table=aggregate_fair_price_published` (schema-scoped, no PII tables)
   piped to a timestamped file under a local `exports/` directory (NOT
   committed — add to `.gitignore`). T2-data-layer §3.1 item 5 names this
   the "export snapshot to the library scope" — actually copying it to
   `/Users/al/Dropbox/ExFu Library/scopes/pricing-meter/` is a filesystem
   operation this brief CAN do locally (it is not a cloud account), so
   the script performs the copy; **VERIFY AT EXECUTION** that the target
   directory exists and is writable before relying on it, and do not
   create new subdirectory structure there beyond a single
   `data-exports/` folder without checking that scope's own conventions
   first (per CLAUDE.md, business/GTM state there is out of this repo's
   authority to restructure).
3. Encrypted dump artefact: `npx -y supabase@2.115.0 db dump --local -f
   /tmp/fairprice-dump-<date>.sql` (full local dump — schema and data),
   then encrypt it. **VERIFY AT EXECUTION:** no encryption tool is
   confirmed installed in this environment; `age` (modern, simple,
   scriptable) is proposed over `gpg` for a machine-generated pipeline,
   but its presence must be checked (`command -v age`) before the script
   depends on it — if absent, the step fails loudly rather than silently
   skipping encryption, since an unencrypted dump artefact is a data
   exposure, not a degraded convenience.
4. **Explicitly stops here.** No upload to Backblaze B2 (T2-platform §6
   R4 — cloud target, credentials, and scheduling are that layer's, per
   T2-data-layer §2.9's stated interface: "a dump artefact per day,
   encrypted, handed to the platform backup path"). The artefact this
   script produces on disk IS that hand-off point; wiring the actual
   handoff is the operator-assisted cloud-wiring brief's job.

### 2.10 Adversarial RLS suite (`tests/rls/`)

Per T2-data-layer §4's binding verification approach: "every role
attempts every non-granted operation ... including forged role/mode
parameters and invite-replay ... all denied at the database." Structure:
one Vitest file per table (`party_positions.rls.test.ts`, `results.rls.
test.ts`, `sessions.rls.test.ts`, `invites.rls.test.ts`, plus
`honesty_signal_storage.rls.test.ts`, `identities.rls.test.ts`,
`purge_tombstone_log.rls.test.ts`, `billing_reference.rls.test.ts` for
the fully-closed tables). Each test connects to the local Postgres
instance as a specific role/JWT (using `postgres`-js against `.env`'s
`SUPABASE_DB_URL` for role-level tests, and the Supabase JS client with
`PUBLIC_SUPABASE_ANON_KEY`/a minted test JWT for RLS-as-PostgREST-sees-it
tests) and asserts denial. Representative cases (non-exhaustive list —
the file itself is the exhaustive artefact):
- Party A's authenticated session attempts `select * from party_positions
  where session_id = $1 and direction = 'high-preferring'` (the OTHER
  party's row) → zero rows returned (RLS silently filters, per Postgres
  RLS semantics — the assertion is "empty result set", not "error",
  which is itself worth asserting explicitly since a naive test could
  mistake an error for a pass).
- Any authenticated principal attempts `select * from results` directly
  → zero rows, for every session including their own (no SELECT policy
  exists at all — even a legitimate party cannot read `results` directly;
  they must go through `constructPayload`).
- A forged claim: a JWT with a hand-set custom claim asserting
  `role: 'host'` for a session the caller never created attempts to read
  via `is_session_host()` → false, because the function ignores any
  client-supplied role claim entirely and re-derives from `sessions.
  creator_identity_id` (this is the specific "forged role/mode
  parameters ... denied" case T2-data-layer §4 names).
- Invite replay: `redeem_invite(invite_id)` called twice with the first
  call's now-`redeemed_at`-set row → second call errors.
- Invite replay after session close: `redeem_invite` called on an invite
  whose session is already `closed` → errors (guard added to
  `redeem_invite`, §2.5, checking `sessions.state = 'open'`).
- `submit_position` called by a principal `session_role_for` resolves to
  `null` for that session → errors (no membership, no transition).
- Direct `update party_positions set status = 'submitted' where ...` as
  the owning party (bypassing `submit_position`) → the RLS UPDATE
  policy's `with check (status = 'draft')` rejects it (0 rows affected;
  assert the row is unchanged after the attempt).
- `select * from honesty_signal_storage` / `purge_tombstone_log` /
  `identities` / `billing_reference` as `authenticated` → zero rows,
  every table, every case (no policy exists).

### 2.11 Payload-construction golden tests (`tests/payload/`)

Per T2-data-layer §4: "golden tests per role × mode × deal outcome,
including no-deal own-distance-only and the casual exception; assert no
other egress path for raw results exists." Build synthetic
`ReconcileResult` fixtures directly in the test file (NOT the engine's
`reference/engine-golden-fixtures-v1.json` — that archive's fixtures are
scoped to the engine's own golden-vector identity per its `anchors`
block, T3-m1-engine-port §2.11, and reusing it here would silently
couple this brief's tests to the engine archive's provenance in a way
neither T2 asks for; a locally-defined literal `ReconcileResult` object
per zone is simpler and just as valid a fixture for redaction logic,
which does not depend on the numbers being real engine output).
- For `zone: "comfort"`, `"deal"`, and `"no-deal"` fixtures, assert:
  - `viewer: {kind:'party', role:'low-preferring'}` payload contains
    `distances["low-preferring"]` but NOT `distances["high-preferring"]`,
    and contains no `layers`/`curves`/`honesty`/`input` key at all.
  - `viewer: {kind:'party', role:'high-preferring'}` is the mirror.
  - `viewer: {kind:'host'}` contains BOTH parties' `distances` entries
    but no `layers`/`curves`/`honesty`/`input`.
  - `viewer: {kind:'developer'}` contains every field.
  - `viewer: {kind:'casual'}` contains every field (full-detail
    exception).
- No-deal specific: assert the `no-deal` fixture's low-preferring-party
  payload's `distances["low-preferring"]` is present and non-zero while
  `distances["high-preferring"]` is absent from that payload object
  entirely (not merely zeroed — T2-data-layer §2.2's "own distance only"
  contract means the KEY is missing, not present-as-null).
- Code-level egress check: a static test
  (`grep -RL "rawResultReader" src/lib/server/data --include=*.ts` minus
  `payloadConstructor.ts` and `rawResultReader.ts` itself, asserted
  empty) or an equivalent `ts-morph`/AST-based import-graph check —
  **VERIFY AT EXECUTION** which mechanism is simpler to make reliable in
  this repo's tooling; a `grep`-based check is proposed first since it
  needs no new dependency, with the caveat that it only proves no OTHER
  file under `src/lib/server/data` imports the reader — it does not
  prove no file ANYWHERE in `src/` does, so the grep root should be
  `src/` in the actual test, not narrowed to `data/`.

## 3. Out of scope (do not touch)

- Survey-mode schema/lifecycle (not in M1 — M1 §3); this brief's
  `sessions.type` check constraint includes `'survey'` only because
  T2-data-layer's schema list names it as a day-one column-shape
  decision, not because survey transition functions are built here.
- Org plumbing (shared credit pool, org membership) — M1 §3, not built.
- The credit/entitlement ledger's write-side logic (reserve/debit/
  release/refund semantics) — T2-platform §2.3/§2.4's job; this brief
  only provides `billing_reference`'s neutral shape (§2.2).
- Custom template authoring, the consumer-toy template — M1 §3.
- Any cloud account, credential, or scheduled job: no Vercel cron, no B2
  bucket, no Supabase-cloud project, no `pg_cron` extension enabled — the
  nightly job (§2.9) is a manually-invoked local script, not a scheduled
  one.
- The erasure routine's full re-identification review and cascade
  execution (T2-data-layer §2.8) — the `purge_tombstone_log` table and
  the identity-purge placeholder mechanic exist (schema only); the
  routine that actually runs a re-identification check and coarsens
  metadata is not built in this brief.
- The invited-session PII sweeper (30-day job) — schema supports it
  (`identities.purged_at`), the scheduled sweep itself is not built.
- Aggregate suppression differencing beyond the flat N>=20 predicate
  (§2.6) — no overlapping/successive-release comparison logic.
- Any UI, route, or MCP endpoint consuming `constructPayload` — this
  brief delivers the module and its tests, not its callers
  (T2-product-surfaces' and T2-agent-distribution's briefs wire it up).
- The scorecard agent itself — only `scorecard_reader`'s grant exists.
- Do not modify `planning/`, `docs/`, `reference/`, `CLAUDE.md`, or
  anything under `.apv/` outside the capture skill's own append (§4).
- Do not regenerate or alter `reference/engine-golden-fixtures-v1.json`
  or the engine's own files under `src/lib/server/engine/` — this brief
  only imports from that directory.

## 4. Verification, capture, commit

Setup (once, from a clean local Supabase):
```bash
npx -y supabase@2.115.0 db reset
```
PASS: exit 0, and every migration in §2.2–2.6 applied without error.

- **V1 — schema/RLS suite:** `npm run test:unit -- --run tests/rls` →
  PASS: exit 0, every adversarial case in §2.10 asserted denied.
- **V2 — payload-construction golden suite:** `npm run test:unit --
  --run tests/payload` → PASS: exit 0, every case in §2.11 passing,
  including the egress check.
- **V3 — transition-function suite:** direct Vitest/`postgres`-js tests
  exercising the full §2.2 happy path (create → redeem → submit both →
  auto-lock → auto-close → single completion event) plus the guard
  failures named in §2.10 that overlap lifecycle (double-submit,
  recall-after-other-submitted, cancel-after-both-submitted) → PASS:
  exit 0.
- **V4 — aggregate gate:** a fixture test inserting synthetic
  `party_positions`/`results` rows for 19 and then 20 distinct sessions
  in one cell, asserting `aggregate_fair_price_published` is empty at 19
  and has exactly one row at 20 → PASS: exit 0.
- **V5 — nightly job dry run:** `npx tsx scripts/nightly-job.ts --dry-run`
  (or the actual run against local Supabase, operator's choice at
  execution time) → PASS: exit 0, a dump artefact file exists at the
  expected path, and (if `age` is confirmed present per §2.9) the
  artefact is not plaintext-readable (`file` or a decrypt-round-trip
  check).
- **Migration idempotency:** `npx -y supabase@2.115.0 db reset` a second
  time → PASS: exit 0 (proves the migrations are replayable, not just
  runnable once).

Capture via the **apv-capture skill**
(`exfu-agent-plan-visualiser:apv-capture`; `/apv-capture` is its
Claude-Code alias — per CLAUDE.md, read the skill source directly if the
alias is absent) against THIS plan id, recording `verification.tested`
with V1–V5 plus the migration-idempotency check, by name and result, and
recording which of the two flagged VERIFY-AT-EXECUTION mechanisms (§1's
invitee-auth path; §2.5's SET ROLE vs. dedicated-connection choice) was
actually used. Then commit:
`feat(data-core): schema, RLS matrix, payload constructor, and nightly job skeleton`

If any adversarial case in V1 fails (a denial that should hold does not),
STOP — this is a blindness-boundary breach, the most severe possible
finding for this brief; do not weaken the test to pass, capture as
blocked with the exact failing case and report immediately. If V2's
egress check finds a second importer of `rawResultReader.ts`, STOP for
the same reason — treat it as a security finding, not a lint nit.

## 5. Deviations and judgement calls (binding)

- **D1 — invitee authentication mechanism (§1).** Neither T2 pins the
  concrete Supabase mechanism for the invitee principal. This brief
  assumes anonymous-auth + custom JWT claim carrying the invite id, with
  a signed-server-token fallback if that proves unavailable. Recorded so
  a future brief building the actual invite-redemption UI route does not
  have to re-derive this decision, and so the operator can override it
  if the execution-time verification surfaces a reason to.
- **D2 — the orchestrator is TypeScript, not a SQL function (§2.5).**
  T2-data-layer §2.2 describes "the only privileged data path" in terms
  that could be read as a single database function; because the pure
  engine is TypeScript with no I/O (T2-engine §2.1), the orchestrator
  MUST be a TypeScript module invoked by the server, using a
  narrowly-scoped Postgres role for its writes — not a `plpgsql`
  function. This is a necessary correction, not a scope expansion: the
  "narrowly-scoped role... audited invocations" contract is preserved,
  only the language of the calling code differs from what a literal
  reading of T2 §2.2 might suggest.
- **D3 — host/developer payload composition (§2.7).** T2-data-layer pins
  the party and casual classes explicitly; host and developer payload
  shapes are synthesised from T2-product-surfaces §2.4's role matrix, as
  detailed in §2.7. This is implementation-level synthesis within a T3's
  ordinary authority, not a T2 reinterpretation — flagged here so an
  auditor can check the synthesis against the source rather than have to
  discover it was made at all.

## 6. Open questions (HITL)

- **Q1 — ref-code generation scheme.** §2.8 proposes `nanoid` for
  `share_refs.ref_code` but no T2 pins a scheme, and no dependency is
  confirmed installed. Low-stakes (any collision-resistant short-code
  library works and the choice is invisible to users), but genuinely
  unruled — flagging rather than quietly picking one, since the ref code
  format also appears in shared-result URLs and templates may end up
  depending on its shape (length, character set) once built. Leaning:
  `nanoid` at 10 characters, URL-safe alphabet, is a reasonable default
  if the operator has no preference.
- **Q2 — developer-role mapping mechanism (§2.4's `is_developer()`).**
  Whether Supabase's local/hosted Postgres lets a named operator's JWT
  map to a real Postgres role (`current_user`) is unconfirmed pending
  execution. If it does not work as assumed, this brief's fallback (a
  `developer_grants` table keyed by `auth.uid()`) is a materially
  different mechanism (a data-driven allowlist rather than a database
  role) with different revocation semantics (a DELETE instead of a
  `REVOKE`/role drop) — worth the operator knowing which one actually
  shipped, once execution settles it, rather than assuming the
  difference is immaterial.
