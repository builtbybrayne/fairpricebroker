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
> §4). Milestone: `M1-working-instrument` item 3. **Status: BLOCKED on
> `T3-m1-scaffold` completion.** As of this revision `T3-m1-scaffold` is
> `progressed`, not `completed` — its own erratum (§5) records a
> Docker-blocked run: local Supabase is pending, `.env` was never
> written. `T3-m1-engine-port`, by contrast, IS completed and its types
> are checked directly against `src/lib/server/engine/types.ts` in this
> revision (§1). **Preflight re-verification step (run before any work
> in this brief, not assumed from the dependency line):**
> ```bash
> test -f .env && grep -q SUPABASE_DB_URL .env || echo "BLOCKED: .env missing/incomplete — re-run T3-m1-scaffold step 6 (Docker up) first"
> test -d src/lib/server/data || echo "BLOCKED: src/lib/server/data missing — scaffold step 5 not applied"
> ```
> If either prints BLOCKED, STOP — do not proceed on an assumed
> environment; report the scaffold gap and re-run/complete
> `T3-m1-scaffold` first. Consumes T2-product-surfaces §2.2 (lifecycle
> transition contract) and §2.4 (role matrix), plus §7 R7–R10/§9 R11
> (host-visibility as template configuration, host-full payload class,
> pre-entry disclosure) as the specification for the guarded transition
> functions and the payload constructor's viewer classes — this brief
> does not re-derive any of these, it implements them.
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
>
> Revised 7 Sep 2026 addressing Codex audit r1 (verdict: revise; 6 high /
> 4 medium / 1 low): added an authoritative `session_participants`
> membership table fixing the creator-direction bootstrap/cycle bug;
> rewrote the payload constructor around persisted `host_visibility` and
> a server-derived principal (no client-supplied viewer authority),
> added the `host-full` class and pre-entry visibility disclosure, and
> split ephemeral casual construction from stored invited results;
> completed the privilege model (grants, PUBLIC revoke, `is_developer`
> keyed off a persisted grant, not `current_user`); pinned a single
> email-verified invite-redemption protocol with hashed tokens; rebuilt
> the aggregate boundary around distinct identities, full partition
> dimensions, contribution caps, demo exclusion, and a numeric cast, kept
> hard-disabled/unexported pending full suppression; replaced the ad hoc
> adversarial case list with a machine-readable authorisation matrix
> (`authz-matrix.ts`) driving generated tests; fixed the SQL→TypeScript
> orchestration handoff's atomicity and the recall/cancel guard mismatch
> with T2-product-surfaces §2.2; completed the attribution chain
> (visit_id into session creation, casual idempotency key, demo-flag
> exclusion, activation query); hardened the nightly job's export/
> encryption path against a residual-plaintext or non-materialised
> failure; marked the plan explicitly blocked on `T3-m1-scaffold`
> (progressed, Docker-blocked) with a preflight re-verification step;
> and demoted ref-code/developer-mapping to pinned executor decisions,
> surfacing the real operator question (invite-expiry policy) at §6.
> Also incorporates T2-data-layer §7 R4–R5, T2-product-surfaces §7
> R7–R10/§9 R11, and T1 Addendum 7 (host-visibility persistence,
> host-full payload class, pre-entry disclosure, demo exclusion), ruled
> after the original draft. Return: `.exfu/returns/t3-m1-data-core-audit-r1.json`.

## 1. Environment facts (pinned)

**Binding cross-brief seam contract (orchestrator-pinned; the casual-mode
brief is revised to the identical contract — quoted verbatim so both
briefs implement one shape):**

> Module `src/lib/server/data/refCodes.ts` is the single ref-code
> authority: `REF_CODE_REGEX = /^[a-z2-7]{10}$/` (lowercase RFC-4648
> base32 alphabet, 10 chars, crypto-random, server-generated only), plus
> `isRefCode(x: unknown): x is RefCode`.
> `issueCasualRef(): Promise<RefCode>` — persists a `share_refs` row
> BEFORE returning the code.
> `recordCasualCompletion(input: { refCode: RefCode | null; templateId:
> string; idempotencyKey: string }): Promise<void>` — idempotent on
> `idempotencyKey` (a client-minted UUID v4, minted once per completed
> flow, resent on retries); duplicate keys are a no-op. Casual
> completions carry NO session_id; uniqueness is on `idempotencyKey`.
> These functions are the casual brief's only data-layer touchpoints;
> this brief owns their implementation and their tests.

This supersedes §2.8's original `issueRef`/`recordCasualCompletion`
sketch (nanoid, no idempotency key) — §2.8 below is rewritten to this
contract. Q1's ref-code-scheme question is resolved by this seam: it is
no longer open (see §6).

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
- **Invitee redemption protocol — pinned this revision (Deviation D1,
  §5, rewritten; finding 4 of the r1 audit).** The r1 draft's anonymous-
  session mechanism could not actually prove control of the invite's
  bound email, so a forwarded link could be redeemed by the wrong
  address — a direct violation of T2-product-surfaces §2.10's
  "a forwarded link cannot be redeemed by another address." This
  revision pins one complete, executable protocol:
  1. **Token, not just a row id.** `invites` (§2.2) stores
     `token_hash text not null` — a SHA-256 hash of a 32-byte
     crypto-random token whose plaintext is embedded in the
     `/join/{token}` URL and NEVER stored or logged. The `invites.id`
     stays the primary key for FKs, but redemption looks up by
     `token_hash = sha256($1)`, not by a client-supplied `invite_id`
     — an attacker who guesses/enumerates ids learns nothing usable.
  2. **Email verification before binding, for email-bound invites.**
     Redemption is two server-mediated steps, both inside
     `redeem_invite` (§2.5): (a) the invitee supplies the token and, for
     an email-bound invite, an email address; the function issues a
     Supabase magic-link OTP to `invites.email` (never to the supplied
     address — the supplied address is compared, not trusted) via
     `supabase.auth.signInWithOtp({ email })`; (b) the invitee completes
     the OTP flow, producing an authenticated session whose JWT's
     `auth.users.email` the function then checks equals `invites.email`
     (case-insensitive) before setting `redeemed_at`/
     `redeemed_by_auth_uid`. A forwarded link's holder, lacking access to
     the bound inbox, cannot complete step (b) — this is what
     "demonstrably refused to the wrong address" requires, and it is
     testable end-to-end against local Supabase's Inbucket/test-OTP
     capture. Non-email-bound (survey shareable-link) invites skip step
     (a)/(b) entirely and authenticate via anonymous sign-in as before.
  3. **`auth.uid()` is therefore always a real authenticated principal**
     at the point `session_role_for` (§2.4) resolves it — either a
     magic-link session (email-bound invites, party grants) or an
     anonymous session (shareable-link invites, survey respondents) —
     removing the r1 draft's incompatibility between "anonymous session"
     and "email comparison against an authenticated identity."
  4. **Revocation and hashed-token replay.** `invites` gains
     `revoked_at timestamptz`; `cancel_session`/creator action can set it
     (guard: not yet redeemed); `redeem_invite` checks
     `revoked_at is null` alongside `expires_at`/`redeemed_at`/session
     `state = 'open'`. Because only the hash is stored, a leaked
     `token_hash` (e.g. via a DB dump) cannot be replayed to redeem —
     only the plaintext token, known only to the emailed link, can.
  **VERIFY AT EXECUTION:** confirm `supabase.auth.signInWithOtp` and its
  local Inbucket/test capture behave as documented against the pinned
  CLI/GoTrue version, and that a JWT's email claim is readable inside a
  SECURITY DEFINER SQL function (via `auth.jwt()->>'email'` or an
  equivalent) — this is the one piece of the redemption path this brief
  cannot confirm without running it; if the OTP-comparison step is not
  achievable as described, the documented fallback is a server-side
  (non-Postgres) redemption route in `+server.ts` that verifies the OTP
  itself before calling `redeem_invite`, passing the verified email
  explicitly as a parameter validated against `invites.email` in SQL —
  record which path was actually used in the capture (§4).

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

**`sessions`** (revised this round: `host_visibility` persisted per
T2-data-layer §7 R4/T2-product-surfaces §7 R7, `is_demo` per T2-data-layer
§7 R5/T2-product-surfaces §7 R8):
```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('invited', 'survey')),
  -- casual is stateless and never rows here (T2-data-layer §2.8, §6 R1).
  composition text check (composition in ('creator-as-party', 'creator-as-host')),
  -- required when type = 'invited'; null for 'survey'.
  template_id text not null,
  host_visibility text not null default 'blind'
    check (host_visibility in ('blind', 'host-visible')),
  -- Fixed at creation from the template's configured setting (T2-data-
  -- layer §7 R4); never mutated after. 'blind' is the default for every
  -- template except recruitment ('host-visible', T2-product-surfaces §7
  -- R7). The payload constructor (§2.7) reads ONLY this persisted column
  -- to decide host-full eligibility — never a request parameter.
  is_demo boolean not null default false,
  -- T2-data-layer §7 R5: a guided vertical demo session. Demo sessions
  -- run the ordinary lifecycle machinery so a demo IS a real session
  -- (no fork), but every fact row and event under it is excluded from
  -- activation counts (§2.8), aggregates (§2.6), and honesty-signal
  -- analysis, while remaining queryable for validation learning.
  currency text not null,
  state text not null default 'open'
    check (state in ('open', 'locked', 'closed', 'cancelled')),
  -- T2-product-surfaces §2.2's canonical session state, distinct from
  -- per-participant submission status (party_positions.status below).
  creator_identity_id uuid references identities(id),
  visit_id uuid references visits(id),
  -- nullable; carries the attribution funnel's ref->visit->session key
  -- (T2-data-layer §2.6) when the session was created from a ref'd visit.
  -- Passed into create_invited_session (§2.5) as a server-held parameter
  -- — see §2.8's fix to the visit-capture chain.
  created_at timestamptz not null default now()
);
alter table sessions enable row level security;
-- Deny-by-default; see §2.4 for the narrow SELECT policy (creator and
-- participants only, never a listing of other people's sessions).
```
(`visits` and its ref table are created in §2.2's events/attribution
migration below; `sessions` is created after it in migration order so the
FK resolves — sequence the migrations accordingly: attribution tables
first, then `identities`, then `sessions`, then `session_participants`
below, which references `sessions`.)

**`session_participants`** — the authoritative membership record fixing
finding 2 of the r1 audit (bootstrap cycle / arbitrary-direction
resolution in `session_role_for`):
```sql
create table session_participants (
  session_id uuid not null references sessions(id),
  direction text not null check (direction in ('low-preferring', 'high-preferring')),
  -- for a HOST row: direction is null (a host is not a party direction);
  -- modelled as a separate boolean column instead, see below.
  is_host boolean not null default false,
  invite_id uuid references invites(id),
  -- the grant that authorised this membership row, when redemption is
  -- how the principal joined (invitee party/host-as-invitee). Null for
  -- the creator's own membership row (created without an invite).
  bound_auth_uid uuid,
  -- the SINGLE server-derived principal permitted to act as this
  -- direction/host in this session. Set atomically at the moment
  -- membership is established (session creation for the creator's own
  -- row; redeem_invite for an invitee row) — NEVER updatable afterward
  -- except by the one redemption transaction that first sets it.
  created_at timestamptz not null default now(),
  check (is_host = false or direction is null),
  check (is_host = true or direction is not null),
  unique (session_id, direction)
  -- at most one participant per direction per session — this is the
  -- cardinality guard the r1 draft's LIMIT-1 resolution lacked. (The
  -- "at most one host" cardinality is enforced separately below, since
  -- a plain UNIQUE on a boolean column would wrongly also cap the
  -- number of `is_host = false` rows at one.)
);
-- Correct enforcement of "at most one host row per session" (a plain
-- UNIQUE on a boolean column does not exclude multiple `false` rows,
-- which is fine, but must exclude multiple `true` rows):
create unique index session_participants_one_host
  on session_participants (session_id) where is_host;
alter table session_participants enable row level security;
-- Deny-by-default; no client policy (§2.4) — rows are inserted ONLY by
-- create_invited_session (creator's own row, atomically with the
-- session — closing the bootstrap gap) and redeem_invite (an invitee's
-- row, atomically with marking the invite redeemed). session_role_for
-- and is_session_host (§2.4) are rewritten to read this table alone —
-- never party_positions, never an arbitrary LIMIT 1 over sessions/
-- identities.
```

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

**`invites`** (T2-product-surfaces §2.10, T2-data-layer §3.1; revised
this round for the D1-protocol's hashed token and revocation, and for
`redeemed_by_auth_uid` — the column `session_role_for`/§2.5 actually key
off, folded in here rather than as a later ALTER, per the r1 draft's own
note that a discrepancy should never be carried across two migrations):
```sql
create table invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id),
  role text not null,
  -- for invited sessions: the direction/role being granted, or 'host';
  -- for survey, 'respondent'.
  email text,
  -- required (email-bound, single-use) for invited-party grants and
  -- host grants; nullable for survey shareable-link invites
  -- (T2-product-surfaces §2.10).
  email_bound boolean not null default true,
  token_hash text not null,
  -- sha256 of a 32-byte crypto-random token; the plaintext token lives
  -- only in the /join/{token} URL, never persisted or logged (§1 D1).
  -- Redemption looks up by token_hash, never by a client-supplied id.
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  -- creator-cancellable before redemption (§2.5's cancel_session, or a
  -- future standalone revoke action); redeem_invite checks this is null.
  redeemed_by_auth_uid uuid,
  -- the auth.uid() that completed redemption — set for EVERY redemption
  -- (email-bound magic-link or anonymous shareable-link alike), since
  -- both produce a real authenticated session (§1 D1). This is the
  -- column session_role_for and session_participants actually key off.
  redeemed_by_identity_id uuid references identities(id),
  -- null for an anonymous-session redemption (the common invitee case);
  -- set only if the redeemer happens to also hold an account.
  created_at timestamptz not null default now(),
  unique (token_hash)
);
alter table invites enable row level security;
create index invites_session_id_idx on invites (session_id);
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
  idempotency_key uuid,
  -- REQUIRED for session_id IS NULL events (casual completions) per the
  -- binding seam contract (§1): a client-minted UUID v4, minted once per
  -- completed flow, resent verbatim on retries. NULL for session-bound
  -- events, which already have session_id as their dedup key. Fixes
  -- finding 8 of the r1 audit: without this, NULL session_id defeats
  -- the (session_id, event_type, sequence) constraint below entirely
  -- and every casual retry (network retry, double-tap) duplicates the
  -- activation event.
  created_at timestamptz not null default now(),
  unique (session_id, event_type, sequence),
  check (session_id is not null or idempotency_key is not null)
);
-- Idempotent completion event (T2-data-layer §2.6): "exactly one
-- completion event per session" is a stronger constraint than the
-- general (session_id, event_type, sequence) dedup above — a partial
-- unique index enforces it regardless of what sequence value is passed:
create unique index events_one_completion_per_session
  on events (session_id)
  where event_type = 'reconciliation_completed';
-- Idempotent casual completion (the stateless funnel's equivalent
-- guarantee — a retry of the SAME completed flow is a no-op, not a
-- second activation event):
create unique index events_one_casual_completion_per_idempotency_key
  on events (idempotency_key)
  where session_id is null and event_type = 'reconciliation_completed';
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
**Activation query** (T1 §2.7's venture activation metric — "completed
two-party reconciliations" — as a query over these events, not a
heuristic; fixes finding 8's missing activation definition and the R5
demo-exclusion gap). One view, both funnels, demo-excluded:
```sql
create view activation_events as
select e.id, e.session_id, e.created_at,
  case when e.session_id is null then 'casual' else 'invited' end as funnel
from events e
left join sessions s on s.id = e.session_id
where e.event_type = 'reconciliation_completed'
  and coalesce(s.is_demo, false) = false;
-- Invited-funnel rows are already unique per session (partial index
-- above); casual-funnel rows are unique per idempotency_key (partial
-- index above) — so count(*) over this view is a correct activation
-- count with no double-counting and no demo pollution, for either
-- funnel or both combined.
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

### 2.3 Deny-by-default grants baseline (rewritten this round — finding 3)

RLS alone is necessary but not sufficient — Postgres also needs table-
level `GRANT`s before RLS policies are even consulted for a role, and a
`SECURITY DEFINER` function is callable by `PUBLIC` unless that default
is explicitly revoked. The r1 draft's grant list was aspirational, not
executable (orchestrator couldn't actually reach `party_positions`;
`payload_reader` was granted `SELECT` on a table with RLS enabled and no
policy admitting it, which RLS silences to zero rows regardless of the
grant; two named functions were never defined; `EXECUTE` was never
revoked from `PUBLIC`). This section is now the complete, closed model —
every grant below has a matching consumer named in §2.4/§2.5/§2.7, and
nothing is granted "for later":
```sql
revoke all on all tables in schema public from public, anon, authenticated;
alter default privileges in schema public
  revoke all on tables from public, anon, authenticated;
revoke execute on all functions in schema public from public;
alter default privileges in schema public
  revoke execute on functions from public;
-- Every SECURITY DEFINER function below is created, then immediately
-- has EXECUTE revoked from PUBLIC and granted ONLY to the role(s) named
-- in its own definition (§2.4/§2.5) — never left at the PUBLIC default.

-- Then, and ONLY then, grant back the narrow client-facing set that has
-- a corresponding RLS policy (§2.4) admitting the grantee role:
grant select, insert, update on party_positions to authenticated;
grant select on invites to authenticated;   -- policy restricts to own invite
grant select on sessions to authenticated;  -- policy restricts to own/hosted
-- session_participants, results, honesty_signal_storage, identities,
-- purge_tombstone_log, billing_reference, share_refs, visits, events:
-- NO grant to anon/authenticated — every legitimate access path is a
-- SECURITY DEFINER function or a role-scoped RLS policy (§2.4), never a
-- direct table grant to a client-facing role.
grant execute on function
  submit_position(uuid), recall_position(uuid), cancel_session(uuid),
  redeem_invite(text, text), create_invited_session(text, text, text, uuid, text[]),
  request_visibility_disclosure(uuid)
  to authenticated;
-- request_data_subject_export and the erasure routine are out of this
-- brief's build scope (§3) — no grant is issued for them here; a
-- SECURITY DEFINER function that does not exist gets no GRANT, closing
-- the r1 draft's phantom-grant finding. get_role_safe_payload is NOT a
-- SQL function at all (§2.7's payload constructor is TypeScript) and
-- was never a real grant target — removed from this list entirely.
-- (This GRANT statement is issued in the LAST migration of this brief,
-- after every function it names exists, so no forward reference.)
```
**VERIFY AT EXECUTION:** confirm what grants a fresh `supabase db reset`
actually leaves in place for `anon`/`authenticated`/`PUBLIC` on newly
created tables and functions in this CLI version before assuming the
explicit `revoke all`/`revoke execute` is redundant — treat it as
required regardless, since an incorrect assumption here is a security
bug, not a style choice.

### 2.4 RLS policies and SECURITY DEFINER helpers (rewritten this round)

Membership resolution now reads `session_participants` (§2.2) alone —
never `party_positions` (which caused the r1 draft's bootstrap cycle: a
brand-new session has no position row yet, so nothing could resolve the
creator's own direction) and never an unconstrained `LIMIT 1` over
`identities`/`sessions` (which could silently resolve to the
counterparty's direction). Both helpers are `SECURITY DEFINER`, owned by
a migration-created low-privilege owner role (not `postgres`), with
`search_path` pinned per Postgres's SECURITY DEFINER hardening guidance,
and — per §2.3 — `EXECUTE` revoked from `PUBLIC` and granted only to
`authenticated` (both are called from RLS `USING` clauses evaluated as
the calling role, so `authenticated` must be able to invoke them):
```sql
create function session_role_for(p_session_id uuid)
returns text
language sql security definer
set search_path = public
as $$
  select direction from session_participants
  where session_id = p_session_id
    and is_host = false
    and bound_auth_uid = auth.uid();
$$;
-- A direct, single-row lookup keyed by the atomic membership record —
-- no join through party_positions, no arbitrary LIMIT 1. Returns NULL
-- (not an error) when the caller has no party membership in this
-- session, exactly as before.

create function is_session_host(p_session_id uuid)
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from session_participants
    where session_id = p_session_id and is_host = true and bound_auth_uid = auth.uid()
  );
$$;
revoke execute on function session_role_for(uuid), is_session_host(uuid) from public;
grant execute on function session_role_for(uuid), is_session_host(uuid) to authenticated;
```

**Developer identity (finding 3's `is_developer` bug, fixed):** the r1
draft's `current_user = 'developer_operator'` check identifies the
*function's owner*, not the invoking JWT principal — under Supabase,
every PostgREST-routed call runs as `authenticated`/`anon` regardless of
who signed the JWT, so that check could never resolve true for a real
operator and was, if anything, backwards-insecure if the owner ever
matched by accident. This revision adopts the r1 draft's own documented
fallback as the PRIMARY mechanism, not a contingency:
```sql
create table developer_grants (
  auth_uid uuid primary key,
  granted_by text not null,
  granted_at timestamptz not null default now()
);
alter table developer_grants enable row level security;
-- No client policy — populated only via direct migration/operator SQL
-- (a one-off `insert` run by the operator against the local/hosted
-- instance, outside this brief's migrations, since it names a specific
-- person's auth_uid unknown at authoring time). This is a data-driven
-- allowlist, not a database role membership — its revocation is a
-- DELETE, not a REVOKE — recorded here so the difference is explicit,
-- not discovered later (closes r1's Q2/finding 3 together).
create function is_developer()
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (select 1 from developer_grants where auth_uid = auth.uid());
$$;
revoke execute on function is_developer() from public;
grant execute on function is_developer() to authenticated;
```

**Role-scoped policies for the privileged internal roles** (finding 3:
the r1 draft granted `orchestrator`/`payload_reader` table privileges
that RLS then silently zeroed, since no policy admitted those roles —
a `GRANT` is necessary but RLS-blind without a matching policy). Postgres
policies may target a specific role via `TO`, which is the fix — these
are NOT client-reachable roles (§2.5: `NOLOGIN`, no PostgREST/JWT path),
so scoping a permissive policy to them by name does not broaden what any
authenticated end user can reach:
```sql
create policy party_positions_orchestrator_read on party_positions
  for select to orchestrator using (true);
-- Only compute_and_store_result (§2.5), running under this role via its
-- own dedicated connection, can ever issue a query as `orchestrator` —
-- it is the "narrow orchestrator... only privileged data path" T2-data-
-- layer §2.2 requires, now actually executable.
create policy results_payload_reader_read on results
  for select to payload_reader using (true);
-- rawResultReader.ts (§2.7) connects as payload_reader; this is the
-- ONLY policy admitting any read of `results` at all — still zero rows
-- for anon/authenticated (no policy names them), so "no SELECT policy
-- exists for any client role" (§2.2's original comment) remains true.
```

Policies for client-facing roles (deny-by-default; each table gets
exactly the policies below, nothing broader):
```sql
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
    -- 'recalled' admitted here (fixing finding 6: a recalled position
    -- must be re-editable, matching §2.5's "may re-submit").
  ) with check (
    session_role_for(session_id) = direction
    and status in ('draft', 'recalled')
    and (select state from sessions where id = session_id) = 'open'
  );
-- Status transitions to 'submitted' are NEVER reachable through this
-- UPDATE policy (it requires status IN ('draft','recalled') on both
-- sides) — that transition exists only inside submit_position/
-- recall_position (§2.5), which run SECURITY DEFINER and therefore
-- bypass this restrictive policy entirely, which is the point: the
-- lifecycle guard lives in one place, not in RLS twice.

create policy sessions_select on sessions
  for select to authenticated using (
    session_role_for(id) is not null
    or is_session_host(id)
    or (select auth_user_id from identities where id = creator_identity_id) = auth.uid()
  );
-- No sessions INSERT/UPDATE policy at all: session creation and every
-- state transition go through guarded functions only (§2.5).

create policy invites_select on invites
  for select to authenticated using (
    redeemed_by_auth_uid = auth.uid()
    or exists (
      select 1 from sessions s
      join identities id on id.id = s.creator_identity_id
      where s.id = invites.session_id and id.auth_user_id = auth.uid()
    )
  );
-- Rewritten as an EXISTS correlated on invites.session_id explicitly
-- (the r1 draft's scalar subquery risked ambiguous/incorrect column
-- resolution between the outer `session_id` and the join's); no
-- invites INSERT/UPDATE policy: issuance and redemption go through
-- guarded functions (§2.5) so single-use/expiry/email-binding are
-- enforced once, centrally, never bypassable via a direct table write.
```
No policies are added for `identities`, `results` (beyond the
`payload_reader`-scoped one above), `session_participants`,
`honesty_signal_storage`, `purge_tombstone_log`, `billing_reference`,
`share_refs`, `visits`, `events`, or `developer_grants` — deny-by-default
means the absence of a client-facing policy IS the control for these
tables; every legitimate access path into them is a SECURITY DEFINER
function (§2.5, §2.7), a role-scoped policy naming a non-login internal
role, or the developer role.

### 2.5 Guarded transition functions (rewritten this round)

Implementing T2-product-surfaces §2.2's invited-session transition
contract (survey transitions are out of scope, §3 — survey mode is not
M1). Each function is `SECURITY DEFINER`, validates the actor and the
guard condition itself (never trusts the RLS layer, which it bypasses),
and is the only way the corresponding state change happens. Per §2.3,
every function below has `EXECUTE` revoked from `PUBLIC` at creation and
granted only to `authenticated` (the sole exception,
`compute_and_store_result`, is TypeScript, not SQL — it is never a grant
target at all).

- `create_invited_session(template_id text, currency text, composition
  text, visit_id uuid, party_or_host_emails text[]) returns uuid` —
  **`visit_id` is now a parameter (finding 8 fix):** the caller (the
  session-creation API route) resolves it server-side from the visit
  cookie/record established by `recordVisit` (§2.8) BEFORE calling this
  function, and passes it through; the function itself never reads a
  client-supplied ref code or visit id directly, only the already-
  resolved server value, and validates it exists in `visits` if
  non-null. **`host_visibility` is resolved from a fixed, server-owned
  template→visibility map inside this function, never from a client
  parameter** (closing a path where a caller could otherwise assert
  `host-visible` for a blind template): a `case template_id when
  'recruitment' then 'host-visible' else 'blind' end` expression (M1's
  template catalogue is fixed and small, §3 — custom template authoring
  is out of scope; this map is the executor's single source of truth
  until custom templates exist, at which point it moves to the template
  table). Creates the `sessions` row (`state = 'open'`, `host_visibility`
  and `visit_id` set as above), **then atomically inserts the creator's
  own `session_participants` row** (`is_host = true` if
  `composition = 'creator-as-host'`, else `is_host = false, direction =
  <the creator's chosen direction>`) — this is the bootstrap fix for
  finding 2: the creator's membership exists from the same transaction
  that creates the session, never resolved later by an arbitrary lookup.
  Then creates the matching `invites` row(s) per §2.2's cardinality rule
  (one grant for creator-as-party, two for creator-as-host —
  T2-product-surfaces §2.10), each with a fresh 32-byte crypto-random
  token (`gen_random_bytes(32)`, base64url-encoded for the URL,
  `sha256`-hashed for `token_hash` — per §1 D1) and `expires_at` set to
  the ruled default (§6 — 14 days, pending operator confirmation).
  **Credit debit is explicitly NOT this function's job** — T2-platform
  §2.3 owns entitlement debit and is out of scope here (§3); this
  function creates the session unconditionally in M1 (free launch
  credits, no checkout — M1 item 5/§3 defers the entitlement gate to
  T2-platform's own T3).
- `redeem_invite(token text, invitee_email text default null) returns
  uuid` — implements §1 D1's protocol. Looks up by `token_hash =
  sha256($1)`, never by a client-supplied id. Checks `expires_at > now()`,
  `redeemed_at is null`, `revoked_at is null`, and the owning session's
  `state = 'open'`. For an email-bound invite: requires the caller's
  authenticated JWT email (`auth.jwt()->>'email'`) to equal
  `invites.email` case-insensitively — this is only reachable AFTER the
  caller has completed the magic-link OTP flow addressed to
  `invites.email` (the client-side/route-side half of §1 D1, out of this
  brief's UI scope but its precondition is enforced here, in SQL, not
  merely assumed client-side); a JWT whose email does not match errors
  `email-mismatch`, never silently redeems. For a non-email-bound
  (survey shareable-link, not M1) invite: no email check, just an
  authenticated (possibly anonymous) `auth.uid()`. On success: sets
  `redeemed_at`, `redeemed_by_auth_uid = auth.uid()`, and **atomically
  inserts the invitee's `session_participants` row** (mirroring
  `create_invited_session`'s creator-side insert — the second half of
  finding 2's fix), returning the `session_id` for the caller's
  redirect. A second redemption attempt on the same invite errors
  (`redeemed_at is not null`) — the row-level half of "invite-replay
  after redemption ... denied" (T2-data-layer §4); redemption after
  session close or revocation errors likewise.
- `submit_position(session_id uuid) returns text` — the caller's role
  resolved via `session_role_for`; requires an existing row for that role
  with `status in ('draft', 'recalled')` (fixing finding 6: a recalled
  row was previously unreachable by this precondition, contradicting
  §2.2's "may re-submit") with all four values set; sets `status =
  'submitted', submitted_at = now()`. If the OTHER party's row is now
  also `submitted`, transitions `sessions.state` to `'locked'` and
  returns `'locked'`; otherwise returns `'open'`. **This function does
  NOT call the orchestrator itself** (fixing finding 6's atomicity gap):
  the caller (the API route) inspects the return value and, only on
  `'locked'`, invokes `claimAndOrchestrate(session_id)` (below) — the
  SQL/TypeScript boundary is now a single, explicit, idempotently-
  retriable handoff rather than an implicit same-transaction call that
  cannot exist (the engine is TypeScript, §2.1) and that left no recovery
  path if the route crashed between the two steps.
- `recall_position(session_id uuid) returns void` — the caller's role
  must be `submitted`; the OTHER role must NOT be `submitted` (first-
  submitter-can-recall asymmetry, T2-product-surfaces §2.2); sets
  `status = 'recalled'`. A subsequent `submit_position` call re-submits
  (now reachable per the fix above).
- `cancel_session(session_id uuid) returns void` — caller must be the
  creator; **guard fixed per finding 6: "before both parties submitted"
  (T2-product-surfaces §2.2), not "neither party submitted"** — cancel is
  permitted while at most one party has submitted, refused only once
  BOTH have (`not (select count(*) = 2 from party_positions where
  session_id = $1 and status = 'submitted')`); sets `state =
  'cancelled'`; also sets `revoked_at = now()` on any of the session's
  still-unredeemed invites, closing the invite-revocation path named in
  §1 D1.
- `request_visibility_disclosure(session_id uuid) returns text` — pre-
  entry disclosure per T2-product-surfaces §9 R11 (finding 1): callable
  by any principal who can resolve a role in this session (party or
  pending invitee, checked the same way `session_role_for` does, before
  a `session_participants` row necessarily exists for an invitee who has
  not yet redeemed — so this function reads `sessions.host_visibility`
  directly, which is public-within-the-session information, not a
  redaction decision) and returns the persisted `host_visibility` value
  (`'blind'` or `'host-visible'`) unconditionally. Party-facing surfaces
  call this BEFORE rendering the entry form and MUST render R11's
  disclosure copy when the result is `'host-visible'` — this is the
  schema-level fact the surface's binding copy renders from; this brief
  ships the fact, not the copy.
- `compute_and_store_result(session_id uuid) returns void` — the ONLY
  function that reads both parties' `party_positions` rows together (it
  is the "narrow orchestrator" of T2-data-layer §2.2: "the only
  privileged data path"). **This function runs inside the SvelteKit
  server process, not as a Postgres `plpgsql` function** — the pure
  engine is TypeScript (T2-engine §2.1: "no I/O ... performs no I/O"), so
  it cannot run inside Postgres itself (Deviation D2, §5, unchanged from
  the original draft's correction). It is invoked ONLY through the
  claim wrapper below, never called directly by a route.

  **Atomic, idempotently-claimable handoff (finding 6's fix — the actual
  new mechanism, replacing the r1 draft's implicit same-transaction
  call):**
  ```sql
  alter table sessions add column orchestration_claimed_at timestamptz;
  ```
  `claimAndOrchestrate(sessionId: string): Promise<void>` in
  `src/lib/server/data/orchestrator.ts`:
  1. Atomically claims, under the `orchestrator` role: `UPDATE sessions
     SET orchestration_claimed_at = now() WHERE id = $1 AND state =
     'locked' AND orchestration_claimed_at IS NULL RETURNING id`. Zero
     rows returned ⇒ someone else already claimed or completed this
     session (a concurrent retry, or a recovered crash) — return
     immediately, a true no-op. Exactly one row ⇒ proceed; no two
     callers can ever proceed for the same session.
  2. Reads both parties' `party_positions` rows (via the `orchestrator`-
     scoped policy, §2.4), builds `DirectionalParty` values, calls the
     pure engine's `reconcile()` (imported from `src/lib/server/engine`).
  3. On `{ok:true}`: inserts into `results` and `honesty_signal_storage`,
     inserts the idempotent `reconciliation_completed` event (§2.2's
     partial unique index makes a second insert for the same session a
     no-op via `on conflict (session_id) where event_type =
     'reconciliation_completed' do nothing`), then sets `sessions.state
     = 'closed'`.
  4. On `{ok:false}` (should be unreachable given upstream validation,
     but handled per T2-product-surfaces §2.2's "stays `locked` with an
     operator-visible error state, never a silent close"): writes a
     `computation_failed` event; `sessions.state` stays `'locked'`
     (the claim timestamp remains set — see recovery below).
  5. **Recovery guard (crash safety, closing "leave a session silently
     locked if the route crashes before orchestration"):** a claim older
     than a fixed staleness window (5 minutes — a named constant, not a
     magic number) with `state` still `'locked'` and no
     `reconciliation_completed`/`computation_failed` event is presumed
     abandoned (the process died mid-step); the NEXT call to
     `claimAndOrchestrate` for that session (triggered by a party
     reloading the reveal page, which re-checks session state and
     re-invokes the claim, per the route's own retry logic — built with
     the route, out of this brief's exact wiring but the mechanism and
     its staleness constant are pinned here) is allowed to re-claim by
     widening step 1's `WHERE` to `(orchestration_claimed_at IS NULL OR
     orchestration_claimed_at < now() - interval '5 minutes')`. A test
     in §2.10/§2.12 exercises this staleness re-claim directly.
  Uses a dedicated Postgres connection `SET ROLE`'d to (or logged in
  directly as, per the VERIFY note below) the narrow `orchestrator` role,
  which has `SELECT` on `party_positions` (§2.4's role-scoped policy),
  `INSERT` on `results`/`honesty_signal_storage`/`events`, and `UPDATE`
  on `sessions.state`/`sessions.orchestration_claimed_at` — nothing else,
  never the connection's default role. **Direct client callers cannot
  bypass this path** (closing finding 6's other half): `orchestrator` is
  `NOLOGIN`, never reachable via PostgREST/a JWT, and no client-facing
  GRANT names it — the only code that can ever run as `orchestrator` is
  `claimAndOrchestrate` itself, executed server-side.

```sql
create role orchestrator noinherit nologin;
grant insert on results, honesty_signal_storage to orchestrator;
grant select, update (state, orchestration_claimed_at) on sessions to orchestrator;
grant select on party_positions to orchestrator;  -- admitted by §2.4's role-scoped policy
grant insert on events to orchestrator;
create role payload_reader noinherit nologin;
grant select on results to payload_reader;  -- admitted by §2.4's role-scoped policy
create role scorecard_reader noinherit nologin;
grant select on events, share_refs, visits, activation_events to scorecard_reader;
-- T2-data-layer §2.7: "the scorecard agent reads via a read-only role
-- or the nightly export (both remain available)" — this creates the
-- role; wiring an actual scorecard agent/credential is out of scope (§3).
create role casual_writer noinherit nologin;
grant insert on events to casual_writer;
-- Used by recordCasualCompletion (§2.8) — a stateless write path with
-- no session context at all, so it needs nothing beyond INSERT on
-- events (not party_positions, not results — casual never touches
-- either, T2-data-layer §6 R1).
create role ref_writer noinherit nologin;
grant insert on share_refs, visits to ref_writer;
-- Used by issueCasualRef and recordVisit (§2.8).
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

### 2.6 Aggregate views (exist, unpublished AND unexported at M1 — rewritten this round, finding 5)

Per M1 item 3 ("aggregate views exist but publish nothing at M1
volumes") and T2-data-layer §2.5/§3.1 item 4. The r1 draft counted
`distinct session_id` (rows), not distinct data subjects; had no
per-subject contribution cap or supersession rule; partitioned on only
three of the required snapshot dimensions (omitting unit and any
date/period dimension, so "one contribution per subject per cell
*period*" had no period to key on); ignored the newly-binding demo
exclusion (T2-data-layer §7 R5); and its `percentile_cont` ORDER BY
expression chained `->>` (text) into `::jsonb` into `->>` again,
producing text, not the numeric ordered value `percentile_cont` requires
— all five are fixed below, but the subject-key half is **explicitly a
best-effort interim construction, not a ruled privacy policy**, which is
why this view stays hard-disabled regardless (per the finding's own
"otherwise keep hard-disabled" instruction):

```sql
-- Best-effort stable subject key: for the M1-only invited-session case,
-- a party direction's subject is either the creator's identity (when
-- that direction IS the creator, composition = 'creator-as-party') or
-- the email-bound invitee's email digest (every invited party grant is
-- email-bound, T2-product-surfaces §2.10). This does NOT yet satisfy
-- "privacy-reviewed" (finding 5's own phrase) — it is a real person in
-- the common case but degrades to session-level (no cross-session
-- dedup) for a creator without an identities row or an invitee whose
-- invite record has since been PII-swept (§2.8/out-of-scope erasure
-- routine) — flagged, not silently assumed solid, hence the hard-disable
-- below rather than treating this construction as the ruled answer.
create view party_position_subjects as
select
  pp.id as party_position_id, pp.session_id, pp.direction,
  coalesce(
    (select 'identity:' || s.creator_identity_id
       from sessions s
      where s.id = pp.session_id and s.composition = 'creator-as-party'
        and (select sp.direction from session_participants sp
             where sp.session_id = s.id and sp.is_host = false
               and sp.bound_auth_uid = (select auth_user_id from identities where id = s.creator_identity_id)) = pp.direction),
    (select 'email:' || encode(digest(lower(i.email), 'sha256'), 'hex')
       from invites i where i.session_id = pp.session_id and i.role = pp.direction and i.email is not null),
    'session:' || pp.session_id::text  -- last-resort fallback, no cross-session dedup
  ) as subject_key
from party_positions pp;

create view aggregate_fair_price_by_cell as
with ranked as (
  select
    pp.vertical, pp.region, pp.currency, pp.unit, pp.direction,
    date_trunc('month', pp.entry_date) as period,
    pps.subject_key,
    (r.payload #>> '{fairPrice,float}')::numeric as fair_price,
    -- Fixed cast (finding 5): #>> extracts text at the JSON path
    -- directly, no intermediate ::jsonb round-trip, then one clean cast
    -- to numeric — the value percentile_cont's ORDER BY needs.
    row_number() over (
      partition by pp.vertical, pp.region, pp.currency, pp.unit,
        pp.direction, date_trunc('month', pp.entry_date), pps.subject_key
      order by pp.created_at desc
    ) as contribution_rank
    -- Per-subject contribution cap + supersession (T2-data-layer §2.5):
    -- exactly one row per (subject, cell, period) survives — the LATEST
    -- one — so a repeat contributor never accumulates weight and a
    -- corrected/re-run entry supersedes rather than adds.
  from party_positions pp
  join results r on r.session_id = pp.session_id
  join party_position_subjects pps on pps.party_position_id = pp.id
  join sessions s on s.id = pp.session_id
  where coalesce(s.is_demo, false) = false  -- R5: demo rows excluded
)
select
  vertical, region, currency, unit, direction, period,
  count(distinct subject_key) as distinct_subjects,
  percentile_cont(0.5) within group (order by fair_price) as median_fair_price
from ranked
where contribution_rank = 1
group by vertical, region, currency, unit, direction, period;

-- N>=20 gate (T2-data-layer §2.5):
create view aggregate_fair_price_published as
select * from aggregate_fair_price_by_cell where distinct_subjects >= 20;
```
**Hard-disabled, per the finding's fallback instruction:** neither view
is granted to any role (client-facing or `scorecard_reader`) and the
nightly job (§2.9) does NOT export either — the full differencing-
suppression rule (successive/overlapping release comparison,
T2-data-layer §2.5) and a genuinely privacy-reviewed subject key are
both still absent, and a boundary this security-relevant does not ship
"mostly right." §4's verification checks only that the fixed mechanics
(subject-count-not-row-count, contribution cap, demo exclusion, numeric
ordering) are correct on synthetic fixture data — proving the
*mechanism* sound while the view stays unreachable in practice. Turning
it on (a `GRANT`, a nightly-job export line, and the suppression logic)
is a future brief's change once T2-data-layer's Q2-class questions around
subject-key privacy review are actually ruled — recorded as an open
item, not silently deferred (§6 notes it).

### 2.7 The payload constructor (`src/lib/server/data/`) — rewritten this round (finding 1)

**The r1 draft's central flaw:** `constructPayload(sessionId, viewer)`
took `viewer: Viewer` as a caller-supplied argument — an authority claim
handed in by whatever code called it, not derived from the database. Any
route bug (or a future agent-door caller) that constructed `{kind:
'developer'}` or `{kind: 'host'}` incorrectly would get the full or
host-full result with no independent check. It also treated `casual` as
just another `Viewer` variant reading through `rawResultReader.ts` —
but casual sessions never have a `results` row at all (T2-data-layer §6
R1: casual is stateless), so that path was dead code pretending to be a
real one. And it had no concept of `host-full` (T2-data-layer §7 R4,
ruled after the original draft). This revision fixes all three by
splitting the constructor into two entry points with different trust
models, and by deriving authority server-side in every invited case.

**`rawResultReader.ts`** — the only module permitted to select from
`results`, unchanged in shape (still the sole egress from that table,
§4's code-level check still applies), used only by the invited path:
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

**`principal.ts`** — resolves the caller's AUTHORITY server-side; this
is what closes the trusted-viewer hole. No function below accepts a
`Viewer` from its caller for an invited session — only a raw
`sessionId` and the ambient authenticated request context (the JWT the
server already verified), from which the viewer kind is derived by
querying the database directly, the same way RLS would:
```typescript
export type InvitedViewer =
	| { kind: 'party'; role: Role }
	| { kind: 'host'; hostFull: boolean }  // hostFull true only when
	                                        // BOTH is_session_host AND
	                                        // sessions.host_visibility
	                                        // = 'host-visible' (checked
	                                        // together, atomically, in
	                                        // one query — never inferred
	                                        // from two separate calls
	                                        // that could observe a
	                                        // torn read)
	| { kind: 'developer' }
	| { kind: 'none' };  // caller has no resolvable role in this session

export async function resolveInvitedViewer(sessionId: string): Promise<InvitedViewer> {
	// One query, run as the caller's authenticated role (so RLS/the
	// SECURITY DEFINER helpers apply exactly as they do for any other
	// request — this function adds no privilege of its own):
	//   select
	//     session_role_for($1) as direction,
	//     is_session_host($1) as is_host,
	//     (select host_visibility from sessions where id = $1) as host_visibility,
	//     is_developer() as is_developer
	// Then, in order: developer (if is_developer) > host (if is_host,
	// hostFull = host_visibility = 'host-visible') > party (if direction
	// is not null) > none. A caller who is BOTH a developer and a party
	// (should not happen operationally, but the precedence must be
	// total) resolves developer — internal-only class is a superset.
}
```

**`payloadConstructor.ts`** — the invited path, now taking only
`sessionId`; the viewer is resolved INSIDE, never passed in:
```typescript
import { FIELD_CLASSES, type ReconcileResult, type Role } from '$lib/server/engine';
import { readRawResult } from './rawResultReader';
import { resolveInvitedViewer, type InvitedViewer } from './principal';

export type RoleSafePayload = Record<string, unknown>;

export async function constructInvitedPayload(sessionId: string): Promise<RoleSafePayload> {
	const viewer = await resolveInvitedViewer(sessionId);
	if (viewer.kind === 'none') throw new Error('no resolvable role for this session');
	const result = (await readRawResult(sessionId)) as ReconcileResult;
	return redactInvited(result, viewer);
}

function redactInvited(result: ReconcileResult, viewer: InvitedViewer): RoleSafePayload {
	if (viewer.kind === 'developer') return { ...result };
	if (viewer.kind === 'host' && viewer.hostFull) return { ...result };
	// host-full (T2-data-layer §7 R4): both parties' raw inputs plus
	// full outcome, issued ONLY when hostFull was proven true by the
	// atomic query above — never reachable by a blind-host session or
	// by any party role, in any session, regardless of what a caller
	// might otherwise ask for (there is no caller-supplied path to this
	// branch at all now — hostFull is a resolveInvitedViewer output,
	// not an input).
	const out: RoleSafePayload = {};
	for (const [path, cls] of Object.entries(FIELD_CLASSES)) {
		const include =
			cls.class === 'per-party-safe' &&
			(viewer.kind === 'host' || // blind-host: union of both parties' party-safe fields
				cls.owner === 'both' ||
				(viewer.kind === 'party' && cls.owner === viewer.role));
		if (include) assignByPath(out, path, readByPath(result, path));
	}
	return out;
}
```

**`constructCasualPayload`** — a SEPARATE function, not a `Viewer`
branch, closing the "casual sessions have no stored result" half of
finding 1. Casual is computed and returned in the same request (T2-data-
layer §6 R1: stateless); there is no `sessionId`, no `results` row, and
therefore nothing for `readRawResult` to ever read for a casual play —
the r1 draft's `viewer.kind === 'casual'` branch inside `constructPayload`
implied a code path that could never actually execute correctly, since
it still took a `sessionId` its caller had no casual session to supply:
```typescript
export function constructCasualPayload(result: ReconcileResult): RoleSafePayload {
	// Full-detail exception (T2-data-layer §2.2/§6 R1) — operates
	// directly on the in-memory ReconcileResult the casual route just
	// computed, never touching the database. Casual outcome UI default
	// (T2-product-surfaces §6 R6 — hide raw figures by default, an
	// explicit "show the numbers" control reveals them) is a presentation
	// concern for the surface, not a redaction concern here: this
	// function still returns the complete result, since R6's default is
	// about what renders, not what the payload contains.
	return { ...result };
}
```

**`getVisibilityDisclosure(sessionId)`** — the pre-entry disclosure
fact (T2-product-surfaces §9 R11, finding 1's other requirement),
thinly wrapping `request_visibility_disclosure` (§2.5):
```typescript
export async function getVisibilityDisclosure(
	sessionId: string
): Promise<'blind' | 'host-visible'> {
	// SELECT request_visibility_disclosure($1) — callable before the
	// caller has redeemed/established session_participants membership
	// (a pending invitee), since §2.5's function reads sessions.
	// host_visibility directly. The party-facing entry surface calls
	// this before rendering the entry form and renders R11's binding
	// disclosure copy when the result is 'host-visible' (copy itself is
	// T2-product-surfaces', out of this brief's scope — this ships the
	// fact only, as stated in §2.5).
}
```

**Design synthesis, not a T2 restatement (documented, not fabricated as
a T2 ruling) — Deviation D3, §5, unchanged in substance, now
implemented against the corrected structure above:** T2-data-layer §2.2
pins the party and casual classes explicitly (own-distance-only no-deal
contract; full-detail casual exception) but does not spell out exactly
which fields a blind **host** or **developer** viewer receives beyond
R4's host-full case — that remains synthesised from T2-product-surfaces
§2.4's role matrix ("host ... sees host-safe: outcome summary + the two
'what Party X sees' panels; never inputs" and "developer ... sees
internal-only class"). Blind-host = union of both parties'
`per-party-safe` fields, never `internal-only`. Developer receives
everything, per the internal-only class's stated purpose (T3-m1-
engine-port §2.2: "the class exists in the type for T2-data-layer's
contract").

### 2.8 Events and attribution module (rewritten this round — finding 8, and to the §1 seam contract)

**`refCodes.ts`** — supersedes the r1 draft's unpinned `issueRef`; this
IS the binding cross-brief seam (§1), so its shape is fixed, not
proposed:
```typescript
declare const refCodeBrand: unique symbol;
export type RefCode = string & { readonly [refCodeBrand]: 'RefCode' };
export const REF_CODE_REGEX = /^[a-z2-7]{10}$/;
export function isRefCode(x: unknown): x is RefCode {
	return typeof x === 'string' && REF_CODE_REGEX.test(x);
}

export async function issueCasualRef(): Promise<RefCode> {
	// Generate 10 chars from the lowercase RFC-4648 base32 alphabet
	// (a-z, 2-7) via crypto-random bytes (no external dependency needed
	// — Q1 is resolved by this seam, not left to nanoid/base62 debate).
	// INSERT INTO share_refs (ref_code, issued_for_session_id)
	// VALUES ($1, NULL) — persisted BEFORE returning, per the seam
	// contract ("persists a share_refs row BEFORE returning the code").
	// Runs under a narrow 'ref_writer' role granted INSERT on share_refs
	// only (create alongside orchestrator/payload_reader in §2.5).
}
```

**`visits.ts`** — the visit-capture half of finding 8's fix (no prior
operation recorded an inbound ref as a visit; `create_invited_session`
had no way to receive one):
```typescript
export async function recordVisit(refCode: RefCode | null): Promise<string | null> {
	// If refCode is non-null: INSERT INTO visits (ref_code) VALUES ($1)
	// RETURNING id, under 'ref_writer' (extend its grant to INSERT on
	// visits alongside share_refs). If refCode is null (organic, no
	// share link), returns null — a session created with no visit_id is
	// legitimate and NOT an error. Called ONCE by the landing-page/
	// session-creation route when a ref-carrying link is first followed
	// (T2-product-surfaces §3.1: "an inbound ref survives the whole
	// surface flow"); the returned visit id is then threaded through the
	// route's own state (cookie/session, out of this brief's UI scope)
	// and passed as create_invited_session's `visit_id` parameter (§2.5)
	// at the point a session is actually created — closing the "cannot
	// receive or derive visit_id" half of finding 8.
}
```

**`events.ts`** — `recordCasualCompletion` now matches the §1 seam
contract exactly (idempotency key, not just a JSON-embedded ref code —
closing finding 8's replay-duplication bug):
```typescript
export async function recordCasualCompletion(input: {
	refCode: RefCode | null;
	templateId: string;
	idempotencyKey: string; // client-minted UUID v4, minted once, resent on retries
}): Promise<void> {
	// INSERT INTO events (session_id, event_type, payload, idempotency_key)
	// VALUES (NULL, 'reconciliation_completed',
	//         jsonb_build_object('template_id', input.templateId, 'ref_code', input.refCode),
	//         input.idempotencyKey)
	// ON CONFLICT (idempotency_key) WHERE session_id IS NULL AND event_type = 'reconciliation_completed'
	// DO NOTHING
	// -- casual carries no session_id (T2-data-layer §2.8); dedup is now
	// -- on idempotency_key (§2.2's partial index), not on session_id
	// -- (which is always NULL for casual and could never dedup a
	// -- retry). A genuinely NEW casual play mints its OWN idempotency
	// -- key client-side, so distinct plays are never conflated with
	// -- each other — only a retry of the SAME completed flow (same
	// -- key, resent) is a true no-op.
	// Runs under a narrow 'casual_writer' role granted INSERT on events
	// only (create alongside orchestrator/payload_reader in §2.5).
}
```
The completion event's idempotency for INVITED sessions is enforced at
the database (§2.2's partial unique index on `session_id`), not in this
TypeScript layer — `claimAndOrchestrate` (§2.5) is the only writer of a
session-bound `reconciliation_completed` event, and its `on conflict ...
do nothing` makes a retry (e.g. a network retry re-running the same
lock→close transition) a true no-op, matching T2-data-layer §2.6's
"exactly one completion event per session, emitted idempotently." The
CASUAL funnel's equivalent guarantee is the `idempotency_key` partial
index above — the two funnels are symmetric in guarantee, asymmetric in
mechanism (a real FK-backed session id vs. a client-minted key), exactly
because casual has no session row to key off (T2-data-layer §6 R1).
Both funnels are queryable, demo-excluded, and non-duplicating through
the single `activation_events` view (§2.2) — this is T1 §2.7's
activation metric as "a query over these events, not a heuristic,"
finally executable end to end.

### 2.9 Nightly job skeleton (local scope only — rewritten this round, finding 7)

**`src/lib/server/data/nightlyJob.ts`** plus a runnable entry script
`scripts/nightly-job.ts` (invoked manually for M1 verification; actual
scheduling is cloud-side and out of scope, §3):

1. Refresh: re-run `activation_events` (a plain view, so "refresh" is a
   no-op query). **`aggregate_fair_price_published`/`_by_cell` are
   explicitly NOT refreshed or exported here** (§2.6's hard-disable —
   finding 5's fix): they stay internal, test-only fixtures until the
   subject-key/suppression work lands in a future brief.
2. Export snapshot: **`pg_dump --data-only` cannot export a view's rows
   at all (finding 7's first bug — a view has no materialised storage
   for `pg_dump` to read)**, so the events export uses a direct `COPY`
   query instead, which works uniformly for a real table or a view:
   ```bash
   psql "$SUPABASE_DB_URL" -c "\copy (select * from events) to '<path>/events-<date>.csv' csv header"
   ```
   (schema-scoped, no PII tables — `events.payload` carries only
   `template_id`/`ref_code`, never raw price data, per T2-data-layer
   §2.8). Written to a timestamped file under a local `exports/`
   directory (NOT committed — add to `.gitignore`). T2-data-layer §3.1
   item 5 names this the "export snapshot to the library scope" —
   actually copying it to
   `/Users/al/Dropbox/ExFu Library/scopes/pricing-meter/` is a
   filesystem operation this brief CAN do locally (it is not a cloud
   account), so the script performs the copy; **VERIFY AT EXECUTION**
   that the target directory exists and is writable before relying on
   it, and do not create new subdirectory structure there beyond a
   single `data-exports/` folder without checking that scope's own
   conventions first (per CLAUDE.md, business/GTM state there is out of
   this repo's authority to restructure).
3. Encrypted dump artefact — **rewritten for finding 7's second and
   third bugs (unspecified recipient interface; plaintext left on disk
   before encryption):**
   - **Recipient interface, pinned (not left unspecified):** the script
     requires an `AGE_RECIPIENT` env var — an `age` public-key recipient
     string (`age1...`). This is the platform-owned half of the
     interface (T2-data-layer §2.9: "a dump artefact per day, encrypted,
     handed to the platform backup path") — WHOSE key it is (an
     operator identity key, a platform service key) is T2-platform's
     decision, out of scope here; this brief pins only that the script
     takes a recipient as a named, required input, never a hard-coded or
     absent one. Add `AGE_RECIPIENT=` to `.env.example`. **VERIFY AT
     EXECUTION:** no `age` key pair is confirmed generated in this
     environment; if none exists, generate a LOCAL development-only
     keypair (`age-keygen`) and record its public half as the M1
     placeholder `AGE_RECIPIENT`, clearly marked as non-production in
     the capture (§4) — never invent a "real" recipient key.
   - **No residual plaintext (fixed):** the dump is streamed directly
     into `age` — never written unencrypted to `/tmp` or anywhere else,
     even transiently:
     ```bash
     npx -y supabase@2.115.0 db dump --local | age -r "$AGE_RECIPIENT" -o "<path>/fairprice-dump-<date>.sql.age"
     ```
     `command -v age` is still checked first (no confirmed install at
     authoring time); absence fails the step loudly — an unencrypted
     dump artefact is a data exposure, not a degraded convenience, and
     this pipeline construction means there is never a plaintext
     intermediate file to accidentally leave behind even on a partial
     failure (the shell pipe has nothing to clean up — `age`'s stdin
     ends when `pg_dump`'s does, and a failure on either side produces
     no output file rather than a half-written plaintext one).
4. **Explicitly stops here.** No upload to Backblaze B2 (T2-platform §6
   R4 — cloud target, credentials, and scheduling are that layer's, per
   T2-data-layer §2.9's stated interface: "a dump artefact per day,
   encrypted, handed to the platform backup path"). The artefact this
   script produces on disk IS that hand-off point; wiring the actual
   handoff is the operator-assisted cloud-wiring brief's job.

### 2.10 The authorisation matrix (`src/lib/server/data/authz-matrix.ts`) — rewritten this round, finding 6 (the most load-bearing revision)

The r1 draft's "representative, non-exhaustive" case list was exactly
the shape finding 6 rejects: it omitted `events`/`share_refs`/`visits`/
the aggregate views entirely, covered almost no writes, no host/
developer paths, no cross-session identity attacks, and predates
host-visibility (§7 R4) entirely. This revision replaces the hand-
written list with a **single machine-readable matrix file** that the
test suite iterates to GENERATE every cell — the binding artefact is
the matrix, not prose describing some of its cells:

```typescript
// src/lib/server/data/authz-matrix.ts
export type MatrixRole =
	| 'anon'
	| 'party-low' | 'party-high'          // the two directions, each session
	| 'other-session-party-low' | 'other-session-party-high'  // cross-session attacker
	| 'host-blind' | 'host-visible'        // host in a blind vs host-visible session
	| 'developer' | 'unrelated-authenticated'
	| 'orchestrator' | 'payload_reader' | 'scorecard_reader';

export type MatrixResource =
	| { kind: 'table'; name: string; op: 'select' | 'insert' | 'update' }
	| { kind: 'view'; name: string }
	| { kind: 'rpc'; fn: string; args: 'own-session' | 'other-session' | 'forged' };

export type SessionState = 'open' | 'locked' | 'closed' | 'cancelled';
export type HostVisibility = 'blind' | 'host-visible';
export type InviteState = 'unredeemed' | 'redeemed' | 'expired' | 'revoked' | 'wrong-email';

export interface MatrixCell {
	readonly role: MatrixRole;
	readonly resource: MatrixResource;
	readonly sessionState: SessionState;
	readonly hostVisibility: HostVisibility;
	readonly inviteState?: InviteState;   // only meaningful for redeem_invite cells
	readonly expected: 'allow' | 'deny';
	readonly citation: string;  // traces to a T2/finding reference, e.g. "T2-data-layer §2.2"
}

// Resources enumerated exhaustively — every table/view/function this
// brief creates, so a NEW table added later without a matrix entry is a
// missing-coverage bug the generator can assert against (§2.12):
export const RESOURCES: MatrixResource[] = [
	{ kind: 'table', name: 'party_positions', op: 'select' },
	{ kind: 'table', name: 'party_positions', op: 'insert' },
	{ kind: 'table', name: 'party_positions', op: 'update' },
	{ kind: 'table', name: 'sessions', op: 'select' },
	{ kind: 'table', name: 'sessions', op: 'insert' },
	{ kind: 'table', name: 'sessions', op: 'update' },
	{ kind: 'table', name: 'session_participants', op: 'select' },
	{ kind: 'table', name: 'invites', op: 'select' },
	{ kind: 'table', name: 'results', op: 'select' },
	{ kind: 'table', name: 'honesty_signal_storage', op: 'select' },
	{ kind: 'table', name: 'identities', op: 'select' },
	{ kind: 'table', name: 'purge_tombstone_log', op: 'select' },
	{ kind: 'table', name: 'billing_reference', op: 'select' },
	{ kind: 'table', name: 'developer_grants', op: 'select' },
	{ kind: 'table', name: 'share_refs', op: 'select' },
	{ kind: 'table', name: 'visits', op: 'select' },
	{ kind: 'table', name: 'events', op: 'select' },
	{ kind: 'table', name: 'events', op: 'insert' },
	{ kind: 'view', name: 'activation_events' },
	{ kind: 'view', name: 'aggregate_fair_price_by_cell' },
	{ kind: 'view', name: 'aggregate_fair_price_published' },
	{ kind: 'rpc', fn: 'submit_position', args: 'own-session' },
	{ kind: 'rpc', fn: 'submit_position', args: 'other-session' },
	{ kind: 'rpc', fn: 'recall_position', args: 'own-session' },
	{ kind: 'rpc', fn: 'cancel_session', args: 'own-session' },
	{ kind: 'rpc', fn: 'cancel_session', args: 'other-session' },
	{ kind: 'rpc', fn: 'redeem_invite', args: 'own-session' },
	{ kind: 'rpc', fn: 'is_session_host', args: 'forged' },
	{ kind: 'rpc', fn: 'request_visibility_disclosure', args: 'own-session' }
];

// Generation rule (this IS the "every granted and non-granted cell"
// finding 6 demands): the full cross-product of RESOURCES × every
// MatrixRole × every SessionState × every HostVisibility, computed
// programmatically, each cell's `expected` derived from a pure decision
// function `expectedFor(cell)` that encodes the SAME rules §2.3/§2.4/
// §2.5 implement (so the matrix is checkable against the schema by
// construction, not a second hand-maintained copy that can silently
// drift) — e.g. `expectedFor` returns 'allow' for
// {role:'party-low', resource:{kind:'table',name:'party_positions',op:'select'}}
// ONLY when there also exists a party_positions row for THIS session
// with direction='low-preferring' (the fixture setup step, not the
// decision function, supplies that row) — every other role/resource
// combination for that same cell defaults to 'deny' unless explicitly
// justified. `export const AUTHZ_MATRIX: MatrixCell[] = generateMatrix();`
// A handful of cells are listed here as WORKED EXAMPLES (not the
// complete set — the generator produces the rest):
export const WORKED_EXAMPLES: MatrixCell[] = [
	{ role: 'party-high', resource: { kind: 'table', name: 'party_positions', op: 'select' },
	  sessionState: 'open', hostVisibility: 'blind', expected: 'deny',
	  citation: 'T2-data-layer §2.2 no-deal/blindness contract — party-high reading party-low\'s row' },
	{ role: 'unrelated-authenticated', resource: { kind: 'table', name: 'results', op: 'select' },
	  sessionState: 'closed', hostVisibility: 'blind', expected: 'deny',
	  citation: 'T2-data-layer §2.2 — results has no client-facing SELECT policy at all' },
	{ role: 'other-session-party-low', resource: { kind: 'rpc', fn: 'submit_position', args: 'other-session' },
	  sessionState: 'open', hostVisibility: 'blind', expected: 'deny',
	  citation: 'finding 2 — session_participants scoping must refuse cross-session identity reuse' },
	{ role: 'host-blind', resource: { kind: 'rpc', fn: 'is_session_host', args: 'forged' },
	  sessionState: 'open', hostVisibility: 'host-visible', expected: 'deny',
	  citation: 'T2-data-layer §4 forged role/mode — a party asserting a host claim' },
	{ role: 'host-visible', resource: { kind: 'view', name: 'aggregate_fair_price_published' },
	  sessionState: 'closed', hostVisibility: 'host-visible', expected: 'deny',
	  citation: 'finding 5 — the view is hard-disabled, no role is granted access, host included' }
];
```

**Test generator** (`tests/rls/matrix.test.ts`): for each `cell` in
`AUTHZ_MATRIX`, a `describe.each` block (a) provisions a fresh fixture
session in the cell's `sessionState`/`hostVisibility` (and, for
`redeem_invite` cells, `inviteState`) via direct SQL setup (bypassing
RLS as the migration owner, since fixture setup is not itself under
test), (b) connects/authenticates as `cell.role` (a real Postgres role
switch for `orchestrator`/`payload_reader`/`scorecard_reader`; a real
minted JWT via Supabase's test-auth helpers for every other role,
including anonymous sign-in for `anon`), (c) attempts exactly
`cell.resource`'s operation, and (d) asserts `cell.expected`: for
`'deny'` on a `select`, asserts an EMPTY result set specifically (never
merely "no throw" — RLS silently filters rather than erroring, so a
naive assertion could mistake an error for a pass, and a naive one could
also mistake zero-rows-because-fixture-is-wrong for zero-rows-because-
denied; the fixture step is asserted non-empty for the analogous
`'allow'` cell of the SAME resource under the SAME session first, so a
broken fixture cannot masquerade as a passing denial); for `'deny'` on an
`insert`/`update`/`rpc`, asserts either a thrown/rejected call OR (for
the RLS-`UPDATE`-policy case, §2.4) zero rows affected with the row
verified unchanged afterward; for `'allow'`, asserts success and the
expected row/return shape. Representative named scenarios explicitly
required in the generated set (guaranteed present by construction, not
merely likely):
- Every direction × every session state × both host-visibility modes
  for `party_positions` select/insert/update.
- Cross-session identity reuse: a valid `party-low` JWT for session A
  attempting any operation scoped to session B → deny (closes finding
  2's residual risk beyond the schema fix itself — a belt-and-braces
  test, not reliant on the fix alone).
- Invite lifecycle: `redeem_invite` × `{unredeemed, redeemed, expired,
  revoked, wrong-email}` × email-bound — only `unredeemed` + correct
  email allows; all four others deny, `wrong-email` specifically proving
  §1 D1's protocol (finding 4).
- `is_session_host`/`request_visibility_disclosure` under a forged
  client-asserted role claim (a hand-set custom JWT claim ignored by the
  SECURITY DEFINER functions, T2-data-layer §4's named case).
- `aggregate_fair_price_by_cell`/`_published` and `activation_events`:
  every role, both host-visibility modes → the aggregate views deny
  universally (finding 5's hard-disable, still exercised as fixture-
  sound rather than assumed); `activation_events` allows only
  `scorecard_reader`.
- `results`, `honesty_signal_storage`, `identities`,
  `purge_tombstone_log`, `billing_reference`, `developer_grants` → deny
  for every client-facing role, every state, every mode (no policy
  exists for any of them, per §2.4).
- Direct `update party_positions set status = 'submitted' ...` bypassing
  `submit_position` → the RLS UPDATE policy's `with check (status in
  ('draft','recalled'))` rejects it (0 rows affected; row verified
  unchanged).
- Staleness re-claim (§2.5's recovery guard): a session artificially
  left `locked` with a stale `orchestration_claimed_at` → a fresh
  `claimAndOrchestrate` call succeeds and completes it; a NON-stale claim
  → the fresh call is a no-op (0 side effects), proving concurrent
  callers cannot double-orchestrate.

### 2.11 Payload-construction golden tests (`tests/payload/`) — revised this round for the §2.7 rewrite

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
which does not depend on the numbers being real engine output). Tests
now exercise `constructInvitedPayload(sessionId)` (§2.7) against a real
fixture session/result row in each `host_visibility` mode, rather than
passing a `Viewer` in directly — this is itself the regression test for
finding 1 (a caller can no longer assert an authority the database
doesn't back):
- For `zone: "comfort"`, `"deal"`, and `"no-deal"` fixtures, in BOTH
  `host_visibility` modes, assert (authenticating as the fixture's real
  `party-low`/`party-high`/`host`/`developer` principals, never
  constructing a `Viewer` object by hand):
  - `party-low` payload contains `distances["low-preferring"]` but NOT
    `distances["high-preferring"]`, and contains no
    `layers`/`curves`/`honesty`/`input` key at all.
  - `party-high` is the mirror.
  - `host` in a **`blind`** session's payload contains BOTH parties'
    `distances` entries but no `layers`/`curves`/`honesty`/`input`.
  - `host` in a **`host-visible`** session's payload contains EVERY
    field, including `input` (both parties' raw tuples) — the
    `host-full` class (T2-data-layer §7 R4). A `blind`-session host must
    NEVER receive this even when a caller somehow constructs the
    internal `hostFull: true` shape directly (a unit test on
    `redactInvited` itself, bypassing `resolveInvitedViewer`, asserting
    the function still refuses to leak `input` unless the session's
    actual persisted `host_visibility` — re-checked, not trusted from
    the passed-in flag alone in the implementation — is `host-visible`;
    if the implementation cannot re-check inside `redactInvited` without
    a second query, `resolveInvitedViewer` alone must be the single
    place `hostFull` is ever computed, and this is asserted by a
    code-level check equivalent to §2.11's egress check below, scoped to
    `hostFull`).
  - `developer` contains every field.
  - Any party role in a session where they do NOT hold that direction
    (a forged/mismatched principal) → the payload constructor throws
    (finding 1's core fix: `resolveInvitedViewer` returns `'none'`, which
    is a hard error, not an empty-but-successful payload).
- **Casual is tested separately** (`constructCasualPayload`, never
  through `constructInvitedPayload`/`resolveInvitedViewer` — there is no
  `sessionId` and no database round-trip involved at all): given an
  in-memory `ReconcileResult`, `constructCasualPayload(result)` returns
  every field (full-detail exception, T2-data-layer §2.2/§6 R1). A
  separate test asserts `constructCasualPayload` performs NO import of
  `rawResultReader.ts` transitively (grep/AST check as below) — closing
  finding 1's "casual sessions have no stored result" gap by construction
  rather than by convention.
- No-deal specific: assert the `no-deal` fixture's low-preferring-party
  payload's `distances["low-preferring"]` is present and non-zero while
  `distances["high-preferring"]` is absent from that payload object
  entirely (not merely zeroed — T2-data-layer §2.2's "own distance only"
  contract means the KEY is missing, not present-as-null).
- Code-level egress check: a static test
  (`grep -RL "rawResultReader" src --include=*.ts` minus
  `payloadConstructor.ts` and `rawResultReader.ts` itself, asserted
  empty) or an equivalent `ts-morph`/AST-based import-graph check —
  **VERIFY AT EXECUTION** which mechanism is simpler to make reliable in
  this repo's tooling; a `grep`-based check is proposed first since it
  needs no new dependency. The grep root is `src/` (not narrowed to
  `src/lib/server/data`), per the r1 draft's own noted caveat, so a
  future route or agent-door module importing the reader directly is
  also caught.

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
  (§2.6) — no overlapping/successive-release comparison logic; a
  privacy-reviewed stable subject key (§2.6) is also explicitly deferred
  — both are why the aggregate views stay hard-disabled and unexported
  this round (§2.6, §2.9), not turned on with a known-imperfect subject
  key.
- Any UI, route, or MCP endpoint consuming `constructInvitedPayload`/
  `constructCasualPayload`/`getVisibilityDisclosure` — this brief
  delivers the modules and their tests, not their callers
  (T2-product-surfaces' and T2-agent-distribution's briefs wire it up),
  including the party-facing rendering of R11's disclosure copy itself
  (this brief ships only the fact the copy renders from).
- The scorecard agent itself — only `scorecard_reader`'s grant exists.
- Do not modify `planning/`, `docs/`, `reference/`, `CLAUDE.md`, or
  anything under `.apv/` outside the capture skill's own append (§4).
- Do not regenerate or alter `reference/engine-golden-fixtures-v1.json`
  or the engine's own files under `src/lib/server/engine/` — this brief
  only imports from that directory.

## 4. Verification, capture, commit

Preflight (§1's re-verification step) MUST pass before any of the below
is attempted. Setup (once, from a clean local Supabase):
```bash
npx -y supabase@2.115.0 db reset
```
PASS: exit 0, and every migration in §2.2–2.6 applied without error.

- **V1 — authorisation matrix suite:** `npm run test:unit -- --run
  tests/rls` → PASS: exit 0, every cell in `AUTHZ_MATRIX` (§2.10)
  asserted per its `expected`, including the named required scenarios
  (cross-session identity reuse, full invite-lifecycle, forged-claim,
  aggregate-view universal denial, staleness re-claim).
- **V2 — payload-construction golden suite:** `npm run test:unit --
  --run tests/payload` → PASS: exit 0, every case in §2.11 passing
  (both `host_visibility` modes, the forged/mismatched-principal error
  case, the casual/invited split, the egress check for both
  `rawResultReader` and the `hostFull` computation site).
- **V3 — transition-function suite:** direct Vitest/`postgres`-js tests
  exercising the full §2.2 happy path (create → redeem [including OTP
  email-match] → submit both → auto-lock → `claimAndOrchestrate` →
  auto-close → single completion event) plus the guard failures named in
  §2.10 that overlap lifecycle (double-submit, recall-then-resubmit,
  recall-after-other-submitted, cancel-with-one-submitted-allowed,
  cancel-with-both-submitted-refused) → PASS: exit 0.
- **V4 — aggregate mechanism suite:** fixture tests against
  `aggregate_fair_price_by_cell`/`_published` proving the FIXED mechanics
  in isolation — distinct-subject counting (not row counting) at 19 vs.
  20 subjects (including a repeat contributor inflating row count without
  inflating subject count), the contribution-cap/supersession rule
  (two contributions from the same subject in the same period → one
  survives, the later one), demo-row exclusion (a demo session's rows
  never reach the count), and the numeric-cast fix (`percentile_cont`
  returns a real median, not a text-sort artifact) → PASS: exit 0. This
  proves the mechanism sound while the views remain hard-disabled/
  ungranted (§2.6) — V1's matrix separately proves no role can actually
  reach either view.
- **V5 — nightly job dry run, with a REQUIRED decrypt round-trip (fixing
  the r1 draft's conditional-pass gap):** `npx tsx scripts/nightly-job.ts
  --dry-run` (or the actual run against local Supabase, operator's
  choice at execution time) → PASS requires ALL of: exit 0; the events
  export file exists and is valid CSV with the expected header; the
  `.sql.age` dump artefact exists; `age -d -i <test-identity> <artefact>`
  (using a LOCAL test keypair whose public half was the `AGE_RECIPIENT`
  used for this run) decrypts to a valid SQL dump WITHOUT ERROR; no
  plaintext `.sql` file exists anywhere under `/tmp` or the exports
  directory after the run (`find /tmp exports -name '*.sql' ! -name
  '*.age'` returns empty). A run that produces only a dry-run log with no
  artefact, or an artefact that is never decrypt-verified, does NOT pass
  V5 — this closes the r1 draft's "can pass without proving the
  encrypted handoff artefact" gap.
- **Migration idempotency:** `npx -y supabase@2.115.0 db reset` a second
  time → PASS: exit 0 (proves the migrations are replayable, not just
  runnable once).

Capture via the **apv-capture skill**
(`exfu-agent-plan-visualiser:apv-capture`; `/apv-capture` is its
Claude-Code alias — per CLAUDE.md, read the skill source directly if the
alias is absent) against THIS plan id, recording `verification.tested`
with V1–V5 plus the migration-idempotency check, by name and result, and
recording which of the THREE flagged VERIFY-AT-EXECUTION mechanisms was
actually used: (a) §1 D1's OTP-comparison-inside-SECURITY-DEFINER path
vs. its `+server.ts` fallback; (b) §2.5's `SET ROLE` vs.
dedicated-connection-string choice for `orchestrator`/`payload_reader`;
(c) whether a real or a local-test-only `AGE_RECIPIENT` was used for
V5 (§2.9) — a local-test key run is not a green light to skip re-running
V5 once a real recipient is configured, and the capture must say which
it was. Then commit:
`feat(data-core): schema, authz matrix, payload constructor, and nightly job skeleton`

If any cell in V1's matrix fails (a denial that should hold does not),
STOP — this is a blindness-boundary breach, the most severe possible
finding for this brief; do not weaken the test to pass, capture as
blocked with the exact failing cell and report immediately. If V2's
egress check finds a second importer of `rawResultReader.ts`, or finds
`hostFull` computed anywhere outside `resolveInvitedViewer`, STOP for
the same reason — treat it as a security finding, not a lint nit.

## 5. Deviations and judgement calls (binding)

- **D1 — invitee redemption protocol (§1), rewritten this round.**
  Superseding the original D1 (anonymous-session + unused custom claim,
  which finding 4 showed could not actually verify email control): the
  pinned protocol is hashed single-use tokens (`invites.token_hash`) plus
  a magic-link OTP addressed to the invite's bound email, compared
  against the redeeming JWT's email claim inside `redeem_invite` — full
  detail in §1. Recorded so a future brief building the actual
  invite-redemption UI route implements against this exact protocol, not
  a re-derivation of it; the operator can still override it if
  execution-time verification (the OTP/JWT-email VERIFY note in §1)
  surfaces a reason to.
- **D2 — the orchestrator is TypeScript, not a SQL function (§2.5),
  unchanged in substance, now wrapped in an atomic claim.** T2-data-layer
  §2.2 describes "the only privileged data path" in terms that could be
  read as a single database function; because the pure engine is
  TypeScript with no I/O (T2-engine §2.1), the orchestrator MUST be a
  TypeScript module invoked by the server, using a narrowly-scoped
  Postgres role for its writes — not a `plpgsql` function. This revision
  adds `claimAndOrchestrate`'s atomic claim/recovery mechanism (§2.5,
  finding 6) so the SQL→TypeScript handoff is crash-safe and
  idempotently retriable — a strengthening of D2, not a reversal of it.
- **D3 — host/developer/host-full payload composition (§2.7), extended
  this round.** T2-data-layer §2.2 pins the party and casual classes
  explicitly; blind-host and developer payload shapes remain synthesised
  from T2-product-surfaces §2.4's role matrix, as detailed in §2.7. The
  `host-full` class itself is NOT this brief's synthesis — it is directly
  ruled by T2-data-layer §7 R4 (7 Sep 2026, after the original draft) —
  this brief only implements R4's construction rule (both is_session_host
  AND persisted host-visible mode, checked atomically). Flagged here so
  an auditor can check the blind-host/developer synthesis against its
  source and distinguish it from the R4 ruling it sits beside.
- **D4 — the `session_participants` membership table (§2.2), new this
  round.** Neither T2 specifies a distinct membership table; the r1
  draft instead tried to derive membership from `party_positions`
  (invitee direction) and an unconstrained `sessions`/`identities` join
  with `LIMIT 1` (creator direction) — finding 2 showed both derivations
  were unsound (a bootstrap cycle for the invitee case; an
  arbitrary/wrong-direction resolution for the creator case). This table
  is the minimal correction: an atomic, server-written record of exactly
  who holds exactly which direction/host slot in exactly which session,
  written in the same transaction as the event that establishes it
  (session creation for the creator, invite redemption for an invitee).
  This is implementation-level schema design within a T3's ordinary
  authority (T2-data-layer §2.1 REQUIRES server-derived membership; it
  does not prescribe the table shape), not a reinterpretation of T2.
- **D5 — the aggregate boundary's subject key is interim, not ruled
  (§2.6), new this round.** Finding 5 correctly identified that this
  brief cannot, on its own authority, invent a "privacy-reviewed" subject
  key — that phrase names a review this brief is not positioned to
  perform. The best-effort construction in §2.6 (identity for the
  creator direction, email digest for the invitee direction) is recorded
  as exactly that: a working sketch proving the surrounding mechanism
  (contribution cap, demo exclusion, numeric cast) is otherwise correct,
  with the view kept hard-disabled and ungranted so the interim
  imperfection never actually reaches a published number. Turning
  publication on is future work, gated on an actual privacy review — not
  a decision this brief makes by building the sketch.

## 6. Open questions (HITL)

*(Superseded this round: the r1 draft's Q1 (ref-code scheme) and Q2
(developer-role mapping) are converted below into pinned executor
decisions per the audit's own low-severity finding — neither was a real
operator-level policy question. The genuine open value — invite expiry
— is promoted here as Q1.)*

- **Q1 — invite-expiry policy value (the real question the r1 draft's
  Q1/Q2 were standing in front of).** `create_invited_session` (§2.5)
  sets each invite's `expires_at` from a fixed default; no T2 rules the
  actual number of days. This is a genuine business-policy value (too
  short frustrates a slow-to-respond invitee; too long extends the
  window a stale/forwarded link could matter) — not an implementation
  detail. **Suggested default: 14 days.** Leaning: 14 days is generous
  enough for an invitee to notice and respond without leaving invites
  live indefinitely; revisit once real invitee response-time data exists
  post-launch. Not yet ruled — needs Alastair.

**Pinned executor decisions (demoted from the r1 draft's Q1/Q2 — low
finding: neither is an operator policy question; both are now decided
here, with a verification criterion, so no further HITL round-trip is
needed for them):**

- **Ref-code generation scheme: DECIDED by the §1 binding seam
  contract.** `refCodes.ts`'s `REF_CODE_REGEX = /^[a-z2-7]{10}$/` (10
  lowercase RFC-4648 base32 characters, crypto-random) is now fixed by
  the cross-brief seam both this brief and the casual-mode brief
  implement identically — not a per-brief choice, and not `nanoid`
  (superseded). Verification criterion: `isRefCode` round-trips every
  code `issueCasualRef` produces; the regex is asserted against both a
  valid and an invalid sample in `refCodes.test.ts`.
- **Developer-role mapping mechanism: DECIDED — `developer_grants` table,
  not `current_user`.** §2.4 adopts the data-driven allowlist as the
  PRIMARY mechanism outright (finding 3 showed `current_user` inside a
  SECURITY DEFINER function identifies the function's owner, not the
  invoking JWT principal — not merely unconfirmed, actually wrong under
  Supabase's PostgREST-routed auth model). Verification criterion: a
  `developer_grants` row inserted directly (migration-adjacent operator
  SQL, not a migration itself, since it names a real person's
  `auth_uid`) makes `is_developer()` return true for that principal and
  false for every other authenticated principal, exercised in V1's
  matrix (§2.10).
