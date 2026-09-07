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
>
> **Revised 7 Sep 2026 addressing Codex audit r2 (verdict: revise; 5
> high / 6 medium); seam contract v2 (orchestrator-ruled) adopted.**
> Gist: fixed the invited-session bootstrap (nullable `direction` +
> XOR, corrected migration order, explicit role-mapping args, one-time
> plaintext token return to the email-sending caller); gave every
> internal role (`orchestrator`, `payload_reader`, `casual_writer`)
> the RLS policies its writes actually need; made
> `claimAndOrchestrate` a single fenced transactional finalization
> with per-partial-state retry behaviour; replaced the two casual
> seams and this brief's own `constructCasualPayload` with the
> orchestrator-ruled `completeCasualPlay` operation and explicit
> per-class payload allowlists (deleting `constructCasualPayload` and
> its test, delegating casual construction to the sibling brief); made
> the authorisation matrix model target-relation and derive
> expectations from an independently-written grant table with a
> schema-introspection completeness check; locked down
> `party_positions` client writes to server-derived metadata only;
> gated `create_invited_session` behind the platform's reserve-then-
> debit entitlement seam; folded `session_participants` into the
> purge/erasure/export/tombstone mechanics; and hardened the nightly
> dump pipeline against a silently-empty artefact. Return:
> `.exfu/returns/t3-m1-data-core-audit-r2.json`.

## 1. Environment facts (pinned)

**Binding cross-brief seam contract v2 (orchestrator-ruled; supersedes
v1; quoted verbatim in both briefs so both implement one shape and
nothing is left to reconcile between them):**

> `src/lib/server/refCodes.ts` (note: NEUTRAL location, directly under
> `server/`, NOT under `server/data/`) holds the ref-code authority:
> `export const REF_CODE_REGEX = /^[a-z2-7]{10}$/;` a branded `RefCode`
> type; `isRefCode(x: unknown): x is RefCode`. Content is pinned
> verbatim in both briefs; whichever brief executes first CREATES it,
> the second verifies byte-identity — shared-file ownership is
> explicit and this resolves the compile-first problem.
>
> The v1 pair `issueCasualRef`/`recordCasualCompletion` is REPLACED by
> one operation: `completeCasualPlay(input: { ref: RefCode | null;
> templateId: string; idempotencyKey: string }): Promise<{ shareRef:
> RefCode }>` — transactional and idempotent AS A WHOLE: replaying the
> same `idempotencyKey` returns the SAME `shareRef` and leaves exactly
> one completion event row and one `share_refs` row. `idempotencyKey`
> is validated as UUID v4 at the HTTP boundary (400 otherwise).
> Data-core owns the real transactional implementation (single SQL
> function or single-transaction TS); casual-mode ships an in-memory
> stand-in with identical replay semantics and a required end-to-end
> wiring test (V16) simulating response-loss-after-commit: assert one
> event, one ref, identical returned ref.
>
> Invalid-ref policy, everywhere in both briefs: a present-but-malformed
> `ref` (fails `isRefCode`) → HTTP 400, never null-coercion; `ref:
> null`/absent is legitimate and proceeds. The casual client gets a
> distinct transition for that 400 which DISCARDS the stored ref and
> retries without it. V10 is split into malformed (400, zero seam
> calls) and legitimate-null (proceeds, seam called) cases.
>
> Canonical casual payload: casual-mode's `buildCasualResultPayload`
> (the eleven-field allowlist) is THE casual constructor for UI, HTTP,
> and future MCP. Data-core DELETES its own `constructCasualPayload`
> and its full-object test, delegating by explicit reference ("casual
> payloads are built by T3-m1-casual-mode's `buildCasualResultPayload`;
> this brief constructs only stored-session payloads").
>
> Remove the compile-time non-assignability claim and test V0c
> entirely (structural typing makes it false); the boundary is the
> explicit projection + exact-key negative tests; optionally note an
> opaque brand as future hardening, not a claim.
>
> Rate limiting: both briefs name, in their Done/M1-blocker language,
> that the casual route must be re-pointed through the capability-
> catalogue dispatcher and shared compute rate-limit budget when the M1
> agent-doorway brief lands (no exemption per T2-agent-distribution);
> casual's Stage-2 Done includes it.

This supersedes §2.8's v1 `issueCasualRef`/`recordCasualCompletion`
sketch entirely — §2.8 below is rewritten to `completeCasualPlay`. Q1's
ref-code-scheme question is resolved by this seam: it is no longer open
(see §6).

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
  -- — see §2.8's fix to the visit-capture chain. UNIQUE (below, medium
  -- finding): a visit can attribute at most ONE session, closing the
  -- "attribution can attach to another visitor's record" path — a
  -- caller replaying or guessing someone else's visit_id can create at
  -- most a session no one has already claimed with it, never silently
  -- pile a second session's activation onto a visit that already
  -- belongs to someone else's session.
  created_at timestamptz not null default now()
);
create unique index sessions_visit_id_unique on sessions (visit_id) where visit_id is not null;
alter table sessions enable row level security;
-- Deny-by-default; see §2.4 for the narrow SELECT policy (creator and
-- participants only, never a listing of other people's sessions).
```
(`visits` and its ref table are created in §2.2's events/attribution
migration below; `sessions` is created after it in migration order so the
FK resolves — sequence the migrations accordingly: attribution tables
first, then `identities`, then `sessions`, then `invites` (below,
BEFORE `session_participants` — fixing finding 1's second bug: the
pre-r2 draft presented `session_participants` before `invites` even
though `session_participants.invite_id` references `invites(id)`; the
actual migration order this brief creates is attribution tables →
`identities` → `sessions` → `invites` → `session_participants` →
`party_positions` → `results` — read the CREATE TABLE bodies below in
that dependency order regardless of the order they are printed in this
document, or, equivalently, defer `session_participants.invite_id`'s FK
via a post-`invites` `ALTER TABLE ... ADD CONSTRAINT` the same way
`share_refs_session_fk` is deferred below — either is acceptable, but
the migration files themselves must reflect one of the two, not the
printed order).

**`session_participants`** — the authoritative membership record fixing
finding 2 of the r1 audit (bootstrap cycle / arbitrary-direction
resolution in `session_role_for`):
```sql
create table session_participants (
  session_id uuid not null references sessions(id),
  direction text check (direction in ('low-preferring', 'high-preferring')),
  -- Nullable (finding 1 of the r2 audit — the r1/pre-r2 draft declared
  -- this NOT NULL while simultaneously requiring it null for a HOST
  -- row, which cannot both hold; the column is executable now). Null
  -- for a HOST row; required and one of the two directions for a
  -- party row. The two check constraints below are the XOR that
  -- enforces this — is_host and direction are jointly exhaustive and
  -- mutually exclusive, never both null and never both set.
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
  -- Medium finding, fixed: this column is PII-adjacent (a durable link
  -- from a real auth principal to every session they ever joined) and
  -- the pre-r2 draft left it entirely outside the purge/erasure
  -- boundary — purging an identity's `identities` row (§2.2's placeholder
  -- mechanic) did nothing to this table, so a redacted invitee's
  -- reconciliations remained re-identifiable via this column forever.
  -- The erasure routine (out of THIS brief's build scope, §3 — schema
  -- only) is now specified to null this column for every
  -- session_participants row whose bound_auth_uid maps to a purged
  -- identity, as part of the SAME cascade that purges `identities`
  -- (§2.2) — recorded in `purge_tombstone_log.cascade_summary` (§2.2)
  -- alongside the invite/attribution counts it already carries, and
  -- excluded from the nightly export (§2.9's events-only COPY already
  -- never touches this table; the export/tombstone mechanics this
  -- finding names are satisfied by this column's inclusion in the
  -- cascade contract, not by a new export step).
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
  case when e.session_id is null then 'casual' else 'invited' end as funnel,
  coalesce(
    e.payload ->> 'ref_code',                          -- casual: the inbound ref, if any (set by completeCasualPlay)
    (select v.ref_code from sessions s2 join visits v on v.id = s2.visit_id where s2.id = e.session_id)
  ) as ref_code,
  case when e.session_id is null then null
       else (select s2.visit_id from sessions s2 where s2.id = e.session_id) end as visit_id
  -- Medium finding, fixed: the pre-r2 view carried neither column, so
  -- M1's "which ref/visit did this activation come from" query had no
  -- answer at all despite the underlying chain (ref -> visit -> session
  -- or casual completion) existing in the schema. Both columns are
  -- nullable — an organic (no-ref) activation is legitimate and both
  -- are null for it, never an error.
from events e
left join sessions s on s.id = e.session_id
where e.event_type = 'reconciliation_completed'
  and coalesce(s.is_demo, false) = false;
-- Invited-funnel rows are already unique per session (partial index
-- above); casual-funnel rows are unique per idempotency_key (partial
-- index above) — so count(*) over this view is a correct activation
-- count with no double-counting and no demo pollution, for either
-- funnel or both combined. A dedicated test (§4) queries
-- activation_events end to end: ref -> visit -> session/completion for
-- the invited funnel, ref -> completion.payload for casual, and
-- asserts a forged/nonexistent visit_id passed to create_invited_session
-- is refused (below) rather than silently attributed.
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
  -- counts/ids of invites, attribution rows, export bundles, and
  -- session_participants.bound_auth_uid columns nulled (medium
  -- finding — the erasure cascade's identity-purge and this table's
  -- bound_auth_uid sever now happen together, recorded together).
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
grant select on party_positions to authenticated;
grant insert (session_id, direction, v1, v2, v3, v4) on party_positions to authenticated;
grant update (v1, v2, v3, v4) on party_positions to authenticated;
-- Column-scoped, not whole-row (medium finding, fixed): the pre-r2
-- draft's blanket `insert, update` grant let an authenticated party
-- supply/rewrite `vertical`/`currency`/`unit`/`entry_date`/`created_at`
-- — server-derived immutable metadata snapshots the client must never
-- author (T2-data-layer §2.4). `status`/`submitted_at` are deliberately
-- NOT in either column list: they change only inside `submit_position`/
-- `recall_position` (§2.5, SECURITY DEFINER, bypasses this grant
-- entirely), never via a direct client UPDATE. `session_id`/`direction`
-- stay client-supplied on INSERT ONLY (needed to name which row this
-- is; the RLS policy's `session_role_for(session_id) = direction` check
-- still constrains which values are actually accepted) and are absent
-- from the UPDATE grant, so a party cannot move their own row to a
-- different session/direction after creation. The metadata columns
-- themselves are populated by a trigger, not by the client, below:
create function party_positions_set_metadata()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select s.template_id, s.currency into strict new.vertical, new.currency
  from sessions s where s.id = new.session_id;
  new.region := coalesce(new.region, 'unknown');
  new.unit := 'currency';
  new.entry_date := current_date;
  new.created_at := now();
  return new;
end;
$$;
create trigger party_positions_set_metadata_trigger
  before insert on party_positions
  for each row execute function party_positions_set_metadata();
-- Runs BEFORE the row is written, owned by schema_owner_internal (§2.4),
-- so even though the client's INSERT grant does not include these
-- columns, this fixes their value server-side regardless of what a
-- malicious/buggy client attempts to smuggle via a column it was never
-- granted (Postgres would reject an explicit client-supplied value for
-- an ungranted column outright; the trigger's job is to guarantee a
-- CORRECT value is always present, not merely to block a bad one).
grant select on invites to authenticated;   -- policy restricts to own invite
grant select on sessions to authenticated;  -- policy restricts to own/hosted
-- session_participants, results, honesty_signal_storage, identities,
-- purge_tombstone_log, billing_reference, share_refs, visits, events:
-- NO grant to anon/authenticated — every legitimate access path is a
-- SECURITY DEFINER function or a role-scoped RLS policy (§2.4), never a
-- direct table grant to a client-facing role.
grant execute on function
  submit_position(uuid), recall_position(uuid), cancel_session(uuid),
  redeem_invite(text, text), request_visibility_disclosure(uuid)
  to authenticated;
-- create_invited_session(text, text, text, uuid, text, jsonb) is
-- deliberately NOT granted to authenticated (medium finding, entitlement
-- bypass): it is the low-level primitive §2.5 describes, callable only
-- by the platform-owned reserve-then-debit capability that wraps it,
-- which runs under its OWN narrowly-scoped role — see that seam's own
-- grant, out of this brief's build (§3), not this list.
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

-- Finding 2 of the r2 audit: a GRANT without a matching policy is
-- RLS-silenced to zero rows/zero effect for every role except the
-- table owner — the r1/pre-r2 grant list gave `orchestrator` INSERT on
-- results/honesty_signal_storage/events and UPDATE on
-- sessions(state, orchestration_claimed_at), and gave `casual_writer`
-- INSERT on events, with NO policy admitting any of those writes.
-- Every write path §2.5's functions actually perform now gets its own
-- named, role-scoped policy, closing the gap completely (nothing is
-- "granted for later" — each policy below has a named caller):
create policy results_orchestrator_write on results
  for insert to orchestrator with check (true);
create policy honesty_signal_storage_orchestrator_write on honesty_signal_storage
  for insert to orchestrator with check (true);
create policy events_orchestrator_write on events
  for insert to orchestrator with check (session_id is not null);
-- orchestrator only ever writes a session-bound completion/failure
-- event (claimAndOrchestrate, §2.5) — never a casual (session_id IS
-- NULL) event, so the policy's WITH CHECK enforces that boundary too,
-- not just "some row can be inserted."
create policy sessions_orchestrator_claim_and_close on sessions
  for update to orchestrator
  using (state = 'locked')
  with check (state in ('locked', 'closed'));
-- Matches exactly claimAndOrchestrate's (§2.5) two legitimate
-- transitions (claim-in-place stays 'locked'; finalize moves to
-- 'closed') and nothing else — an orchestrator-role connection cannot
-- use this policy to move a session to any other state.
create policy events_casual_writer_write on events
  for insert to casual_writer with check (session_id is null);
create policy share_refs_casual_writer_write on share_refs
  for insert to casual_writer with check (true);
-- completeCasualPlay (§2.8, seam contract v2) is the ONLY caller of
-- both — it inserts the casual completion event AND issues the
-- share_refs row in one transaction under this role. The events policy's
-- WITH CHECK mirrors the orchestrator one's inverse: casual_writer may
-- only ever write session_id IS NULL rows.
create policy visits_ref_writer_write on visits
  for insert to ref_writer with check (true);
-- recordVisit (§2.8, unrelated to completeCasualPlay) is ref_writer's
-- only caller; ref_writer no longer touches share_refs (folded into
-- casual_writer above per seam contract v2 — one function, one role,
-- one transaction).
```
**Sequence privileges, function ownership, and role assumption
(finding 2's other half — a `GRANT`+policy pair is still incomplete
without these):** every table above with a `bigserial`/`gen_random_uuid()`
default needs its owning sequence's `USAGE`/`SELECT` granted to the
role performing the insert (Postgres does not infer this from a table
`INSERT` grant alone for `bigserial` columns — `gen_random_uuid()`
needs no sequence grant, but `events.id bigserial` does):
```sql
grant usage, select on sequence events_id_seq to orchestrator, casual_writer;
```
Every `SECURITY DEFINER` function in this brief (`session_role_for`,
`is_session_host`, `is_developer`, `submit_position`, `recall_position`,
`cancel_session`, `redeem_invite`, `create_invited_session`,
`request_visibility_disclosure`) is owned by a single migration-created
role, `schema_owner_internal` — never `postgres`, never the Supabase
default migration-runner role — created `NOLOGIN NOINHERIT` with no
grants beyond what it needs to own these objects; this is the role
whose privileges each function actually runs with (per `SECURITY
DEFINER`'s "runs with the privileges of the function's owner"
semantics), so the safe role-assumption path is: the calling
`authenticated`/`anon` role is granted `EXECUTE` only (§2.3), the
function body runs as `schema_owner_internal`, and `schema_owner_internal`
itself is never a login role and is never the target of a client
`SET ROLE`. `orchestrator`/`payload_reader`/`casual_writer`/
`ref_writer`/`scorecard_reader` are a separate, parallel set of
`NOLOGIN` roles (§2.5) assumed only by server-side connections (`SET
ROLE` or a dedicated connection string, per §2.5's VERIFY note) — never
by a `SECURITY DEFINER` function body, and never reachable from a
client JWT. **VERIFY AT EXECUTION:** confirm `create function ...
security definer` without an explicit owner assignment defaults to the
migration-running role's ownership, not `schema_owner_internal` —
if so, each function needs an explicit `ALTER FUNCTION ... OWNER TO
schema_owner_internal` immediately after creation (or the migration
must run authenticated as `schema_owner_internal` itself), and this
step must be added to every function definition in §2.5, not assumed.

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
  text, visit_id uuid, creator_direction text, invite_grants jsonb)
  returns table (session_id uuid, invite_id uuid, role text, plaintext_token
  text)` — **signature corrected (finding 1's third bug):** the r1/pre-r2
  draft took an untyped `party_or_host_emails text[]` with no way to say
  which email gets which role/direction, and no way for the creator's
  own direction (when `composition = 'creator-as-party'`) to be supplied
  at all — both are now explicit parameters. `creator_direction` is
  `'low-preferring' | 'high-preferring'` when `composition =
  'creator-as-party'`, and `null` when `composition = 'creator-as-host'`
  (validated against `composition` at the top of the function body, not
  merely assumed consistent by the caller). `invite_grants` is a
  validated JSON array of `{ role: 'low-preferring' | 'high-preferring'
  | 'host', email: text | null }` objects — exactly the grants
  T2-product-surfaces §2.10's cardinality rule requires for this
  `composition` (one grant for creator-as-party, two for
  creator-as-host) — resolved explicitly, never inferred positionally
  from an untyped array.
  **`visit_id` is a parameter (finding 8 fix):** the caller (the
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
  table). **Entitlement gate (medium finding, fixed):** before creating
  anything, calls the platform seam `reserve_launch_credit(account
  identity)` (T2-platform §2.3's reserve-then-debit contract — this
  function is a stub in M1, §3, but its call site is pinned here so the
  path is never a silent unconditional grant): the reservation is
  released if any step below fails, and debited only after the session
  row commits; `create_invited_session` itself is `REVOKE`d from
  `PUBLIC`/`authenticated` (§2.3) and reachable ONLY through the
  platform-owned public capability that performs the reserve/debit
  around this call — this function is the low-level, privately-granted
  primitive, never the public entry point. Creates the `sessions` row
  (`state = 'open'`, `host_visibility` and `visit_id` set as above),
  **then atomically inserts the creator's own `session_participants`
  row** (`is_host = true` if `composition = 'creator-as-host'`, else
  `is_host = false, direction = creator_direction`) — this is the
  bootstrap fix for finding 2: the creator's membership exists from the
  same transaction that creates the session, never resolved later by an
  arbitrary lookup. Then creates the matching `invites` row(s) from
  `invite_grants`, each with a fresh 32-byte crypto-random token
  (`gen_random_bytes(32)`, base64url-encoded for the URL, `sha256`-hashed
  for `token_hash` — per §1 D1) and `expires_at` set to the ruled default
  (§6 — 14 days, pending operator confirmation). **Return shape fixed
  (finding 1's fourth bug):** the pre-r2 draft returned only the session
  UUID, discarding the plaintext tokens it generated — nothing downstream
  could ever construct a `/join/{token}` URL or send an invite email. This
  function now returns one row per created invite, each carrying that
  invite's PLAINTEXT token exactly once — the caller (the session-creation
  API route, a trusted server context) reads these rows, builds each
  `/join/{token}` URL, and hands it to the email-sending step; the
  function itself never logs or persists the plaintext (only
  `token_hash`, per §1 D1), so this one row set, returned once at
  creation time, is the only place a plaintext token ever exists outside
  the URL itself.
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

  **Atomic, fenced, idempotently-claimable handoff (finding 6 of r1,
  finding 3 of r2 — the r1 revision left the CLAIM atomic but the
  FINALIZE step as several separate statements, which the r2 audit
  correctly rejected: a crash between the `results` insert and the
  `sessions.state = 'closed'` update leaves a session that already has
  a result row but never closes, and nothing stopped a second, slower
  worker's finalize from racing a first worker's own finalize once both
  had independently passed the claim check on a stale window. This
  revision makes the FINALIZE step itself one transaction, fenced by
  the exact claim it belongs to, so no partial-write state and no
  double-finalize can occur regardless of ordering):**
  ```sql
  alter table sessions add column orchestration_claimed_at timestamptz;
  alter table sessions add column orchestration_fence bigint;
  create sequence orchestration_fence_seq;
  ```
  `claimAndOrchestrate(sessionId: string): Promise<void>` in
  `src/lib/server/data/orchestrator.ts`, all steps run under the
  `orchestrator` role's connection:
  1. **Claim (its own short transaction, unchanged in shape from r1):**
     `UPDATE sessions SET orchestration_claimed_at = now(),
     orchestration_fence = nextval('orchestration_fence_seq') WHERE id =
     $1 AND state = 'locked' AND (orchestration_claimed_at IS NULL OR
     orchestration_claimed_at < now() - interval '5 minutes') RETURNING
     orchestration_fence`. Zero rows returned ⇒ someone else holds a
     live (non-stale) claim, or the session already reached `closed` —
     return immediately, a true no-op. Exactly one row ⇒ proceed,
     carrying the returned `orchestration_fence` value (the fencing
     token) forward to step 3 — this value, not merely "I hold the
     claim," is what step 3 checks, which is what makes a stale reclaim
     safe even against a slow original worker (below).
  2. Reads both parties' `party_positions` rows (via the `orchestrator`-
     scoped policy, §2.4), builds `DirectionalParty` values, calls the
     pure engine's `reconcile()` (imported from `src/lib/server/engine`)
     — pure, no I/O, cannot itself fail against valid stored data.
  3. **Finalize — ONE transaction, fenced (the actual fix):**
     ```sql
     BEGIN;
     -- Re-check the fence before writing anything: if a second worker
     -- reclaimed this session as stale WHILE this worker was between
     -- steps 1 and 3 (the race the r2 finding named — "5-minute
     -- reclaim can race a slow live worker"), this worker's fence no
     -- longer matches sessions.orchestration_fence and every write
     -- below is skipped, never partially applied.
     SELECT orchestration_fence FROM sessions WHERE id = $1 FOR UPDATE;
     -- if the fetched value <> the fence this worker was carrying: ROLLBACK, return (superseded-claim no-op, not an error)
     INSERT INTO results (...) VALUES (...);
     INSERT INTO honesty_signal_storage (...) VALUES (...);
     INSERT INTO events (session_id, event_type, ...) VALUES ($1, 'reconciliation_completed', ...)
       ON CONFLICT (session_id) WHERE event_type = 'reconciliation_completed' DO NOTHING;
     UPDATE sessions SET state = 'closed' WHERE id = $1;
     COMMIT;
     ```
     Because this is one transaction, there is no state where `results`
     exists but `sessions.state` is not yet `'closed'` after a crash —
     either the whole transaction lands (Postgres's own atomicity) or
     none of it does, and a retried `claimAndOrchestrate` call for the
     same session re-enters step 1, which now finds `state = 'locked'`
     still (nothing committed) and a fresh, non-stale claim it can
     re-take immediately (no need to wait out the 5-minute window for a
     crash that happened INSIDE step 3, only for one that happened
     between steps 1 and 3 with the claim held but no finalize attempted
     — see the retry table below).
  4. On `{ok:false}` from the engine (should be unreachable given
     upstream validation, but handled per T2-product-surfaces §2.2's
     "stays `locked` with an operator-visible error state, never a
     silent close"): the same fenced-transaction pattern, writing only a
     `computation_failed` event; `sessions.state` stays `'locked'` (the
     claim/fence remain set — a human operator, not an automatic retry,
     resolves this per T2-product-surfaces §2.2).

  **Retry behaviour, enumerated per partial state (finding 3's other
  requirement — no state is left undefined):**
  | Crash point | Session left in | Next `claimAndOrchestrate` call |
  |---|---|---|
  | Before step 1's `UPDATE` commits | `locked`, claim unset | Claims immediately (step 1's `IS NULL` branch), proceeds normally. |
  | After step 1 commits, before step 3's transaction opens | `locked`, claim/fence set, no result/event | Denied until the claim goes stale (5 min); then a NEW claim (new fence) supersedes it and proceeds — the old worker, if it wakes up, fails its fence re-check in step 3 and no-ops. |
  | Inside step 3's transaction, before COMMIT | `locked`, claim/fence set, **no partial rows** (Postgres rolled the whole transaction back) | Same as the row above — denied until stale, then a fresh claim retries the read+compute+finalize from scratch. |
  | After step 3's `COMMIT` | `closed`, one result, one event | Step 1's `WHERE state = 'locked'` no longer matches — any further call is a no-op by construction, not by a race-prone timestamp check. |
  A test in §2.10/§4 exercises the fence-mismatch no-op directly: hold a
  stale claim, let a second call reclaim (new fence), then let the FIRST
  worker's (superseded) finalize attempt run — assert it writes nothing
  and the second worker's finalize is the one that lands.
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
grant insert on events, share_refs to casual_writer;
grant usage, select on sequence events_id_seq to casual_writer;
-- Used by completeCasualPlay (§2.8, seam contract v2) — one function,
-- one transaction, writing BOTH the casual completion event and the
-- share_refs row (v1 split this across issueCasualRef/
-- recordCasualCompletion and two roles; v2 folds it into one role
-- because it is now one atomic write). Nothing on party_positions or
-- results — casual never touches either (T2-data-layer §6 R1).
create role ref_writer noinherit nologin;
grant insert on visits to ref_writer;
-- Used by recordVisit (§2.8) only — share_refs moved to casual_writer
-- above; ref_writer's remaining job is unrelated attribution capture
-- for invited-session visits, not casual ref issuance.
grant usage, select on sequence events_id_seq to orchestrator;
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
```

**Finding 4 of the r2 audit, fixed — explicit per-class allowlists,
not "return everything."** The pre-r2 draft's `host-full` branch
returned the ENTIRE `ReconcileResult` — including `layers`, `honesty`,
`curves`, `hasComfortZone`, `overlap`, `gap`, every field
`FIELD_CLASSES` marks `internal-only` — on the theory that "host-full"
meant "no redaction." That is wrong: T2-data-layer reserves
`internal-only` (the algorithm's audit trace) for the `developer` role
alone; `host-full` (T2-data-layer §7 R4) means the host additionally
sees BOTH parties' raw inputs, not the engine's internal working. Each
class below is now a named, explicit key list — not a rule computed
from `FIELD_CLASSES` at three different call sites that could each
drift independently:

```typescript
// The four payload classes this brief issues, as explicit key lists —
// each is checked against a golden `Object.keys(...)` test (§2.11),
// exactly as the casual sibling's CasualResultPayload is (its allowlist
// is authoritative for casual; this table is authoritative for every
// stored-session class):
const PER_PARTY_SAFE_KEYS = [
	'zone', 'fairPrice', 'convergenceAchieved', 'convergedTrivially', 'meta'
] as const; // owner: 'both' in FIELD_CLASSES — safe for any invited viewer.
const OWN_DISTANCE_KEY = (role: Role) => `distances.${role}` as const;
// per-party-safe, owner-scoped — each party sees only their own distance.
const RAW_INPUT_KEYS = ['input.low-preferring', 'input.high-preferring'] as const;
// internal-only in FIELD_CLASSES for the GENERAL invited rule, but the
// documented, R4-ruled exception for host-full specifically (never for
// blind-host, never for a party role).
const DEVELOPER_ONLY_KEYS = [
	'hasComfortZone', 'overlap', 'overlapLow', 'overlapHigh', 'dealLow',
	'dealHigh', 'gap', 'layers', 'honesty.low-preferring',
	'honesty.high-preferring', 'curves'
] as const; // every FIELD_CLASSES 'internal-only' entry NOT already
            // covered by RAW_INPUT_KEYS — developer-only, full stop;
            // NEVER reachable by host-full (host-full's raw-input
            // exception is `input.*` only, not the algorithm's audit
            // trace).

// Party payload: PER_PARTY_SAFE_KEYS + this viewer's own distance only.
// Blind-host payload: PER_PARTY_SAFE_KEYS + BOTH parties' distances
//   (the union T2-product-surfaces §2.4 calls "host-safe") — no
//   `input.*`, no DEVELOPER_ONLY_KEYS.
// Host-full payload (T2-data-layer §7 R4): blind-host's set above PLUS
//   RAW_INPUT_KEYS — still NO DEVELOPER_ONLY_KEYS. This is the fix:
//   host-full = "both parties' raw tuples + the party-safe outcome
//   set," per the orchestrator's directive, not "everything."
// Developer payload: PER_PARTY_SAFE_KEYS + both distances + RAW_INPUT_KEYS
//   + DEVELOPER_ONLY_KEYS — i.e. the complete ReconcileResult, since
//   internal-only's entire purpose (T3-m1-engine-port §2.2) is to be
//   developer-reachable and nothing else.

function redactInvited(result: ReconcileResult, viewer: InvitedViewer): RoleSafePayload {
	const out: RoleSafePayload = {};
	const assign = (path: string) => assignByPath(out, path, readByPath(result, path));
	for (const path of PER_PARTY_SAFE_KEYS) assign(path);
	if (viewer.kind === 'party') {
		assign(OWN_DISTANCE_KEY(viewer.role));
	} else if (viewer.kind === 'host' || viewer.kind === 'developer') {
		assign(OWN_DISTANCE_KEY('low-preferring'));
		assign(OWN_DISTANCE_KEY('high-preferring'));
	}
	if ((viewer.kind === 'host' && viewer.hostFull) || viewer.kind === 'developer') {
		// host-full (T2-data-layer §7 R4): issued ONLY when hostFull was
		// proven true by resolveInvitedViewer's atomic query — never
		// reachable by a blind-host session or any party role, and
		// re-checked here against the ACTUAL viewer value passed in
		// (never trusted from a second, separately-computed flag) so a
		// caller cannot construct `{ kind: 'host', hostFull: true }` by
		// hand and bypass the atomic check (§2.11's regression test for
		// this).
		for (const path of RAW_INPUT_KEYS) assign(path);
	}
	if (viewer.kind === 'developer') {
		for (const path of DEVELOPER_ONLY_KEYS) assign(path);
	}
	return out;
}
```
**Golden per-class key-set tests (§2.11) assert the exact `Object.keys`
set for each of the four classes against a fixture** — the same
exact-key discipline the casual sibling's `CasualResultPayload` V0a/V0b
use, so a field added to the engine cannot silently widen any class by
default (a new `ReconcileResult` field with no `FIELD_CLASSES` entry at
all fails the schema-introspection check in §2.10, not merely "happens
not to appear here").

**Casual construction is DELETED from this brief (seam contract v2,
resolving finding 4's sibling-conflict half and the casual-mode
brief's own high finding on the same point).** The pre-r2 draft shipped
`constructCasualPayload(result)` returning the complete `ReconcileResult`
verbatim — a SECOND, wider casual disclosure boundary that directly
contradicted `T3-m1-casual-mode`'s own eleven-field
`CasualResultPayload` allowlist (§4.1 there), which excludes
`layers`/`honesty`/`curves`/`hasComfortZone`/`overlap`/`gap`. Two
briefs each claiming to be "the" casual disclosure boundary, with two
different actual boundaries, is exactly the kind of drift the
orchestrator's seam contract v2 closes: **casual payloads are built by
`T3-m1-casual-mode`'s `buildCasualResultPayload`
(`src/lib/server/casual/casualPayload.ts`); this brief constructs only
stored-session payloads** (party/blind-host/host-full/developer, all
above). `constructCasualPayload` and its full-object golden test are
removed from this brief entirely — there is no casual entry point in
`src/lib/server/data/` at all, by design, since casual never persists a
`results` row for this module to read (T2-data-layer §6 R1) and now
has exactly one canonical constructor, owned by the other brief.

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

**`src/lib/server/refCodes.ts`** — NEUTRAL location (seam contract v2,
§1): directly under `server/`, not `server/data/`, because both this
brief and `T3-m1-casual-mode` import it and neither owns the other's
directory. Whichever brief lands first creates it; this brief, landing
either first or second, either creates it verbatim or verifies
byte-identity against the sibling's copy before proceeding — never
diverges even by a comment:
```typescript
declare const refCodeBrand: unique symbol;
export type RefCode = string & { readonly [refCodeBrand]: 'RefCode' };
export const REF_CODE_REGEX = /^[a-z2-7]{10}$/;
export function isRefCode(x: unknown): x is RefCode {
	return typeof x === 'string' && REF_CODE_REGEX.test(x);
}
```
No `issueCasualRef` here anymore — v1's standalone issuer is retired;
ref issuance is now one step inside `completeCasualPlay` below (seam
contract v2), because issuing a ref and recording the completion it
belongs to must commit or fail together, not as two separately-awaited
calls a lost response could split.

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

**`events.ts`** — `completeCasualPlay` (seam contract v2, §1),
superseding v1's separately-called `issueCasualRef`/
`recordCasualCompletion` entirely. This is the medium finding's actual
fix: the v1 pair called an UNKEYED ref issuance BEFORE the idempotent
completion write, so a lost response after the first call but before
the second committed a ref with no matching completion, and a retry of
the whole flow (which necessarily re-called both) issued a SECOND ref
for the same logical play. `completeCasualPlay` closes this by making
"issue a ref" and "record the completion" ONE transaction, keyed by the
caller's idempotency key from the start — a replay either lands the
whole thing once, or (if it already landed) returns the SAME `shareRef`
without writing anything a second time:
```typescript
export async function completeCasualPlay(input: {
	ref: RefCode | null;
	templateId: string;
	idempotencyKey: string; // validated as UUID v4 at the HTTP boundary
	                        // (casual-mode's +server.ts, seam contract v2)
	                        // — this function additionally re-validates
	                        // the shape at its own boundary (belt-and-
	                        // braces against a future non-HTTP caller,
	                        // e.g. an MCP doorway adapter, that might skip
	                        // the route's own check) and throws on a
	                        // non-UUID-v4 string rather than silently
	                        // proceeding.
}): Promise<{ shareRef: RefCode }> {
	// ONE transaction, under the 'casual_writer' role (§2.5):
	// BEGIN;
	//   -- Idempotency check FIRST, inside the transaction, not as a
	--   -- separate pre-check (closing the TOCTOU gap a check-then-act
	--   -- pair would have):
	//   SELECT ref_code FROM events e WHERE e.idempotency_key = $1
	--     AND e.session_id IS NULL AND e.event_type = 'reconciliation_completed'
	--     -- (ref_code read from the SAME row events.payload carries,
	--     -- or a dedicated column — VERIFY AT EXECUTION which shape is
	--     -- cheaper to query; either satisfies "returns the SAME
	--     -- shareRef on replay")
	--     FOR UPDATE;
	//   IF a row was found: COMMIT; return { shareRef: <that row's ref_code> };  -- true no-op replay
	//   -- Otherwise, first time this idempotencyKey is seen:
	//   generate a fresh RefCode (10 chars, [a-z2-7], crypto-random);
	//   INSERT INTO share_refs (ref_code, issued_for_session_id) VALUES ($new_ref, NULL);
	//   INSERT INTO events (session_id, event_type, payload, idempotency_key)
	//     VALUES (NULL, 'reconciliation_completed',
	//             jsonb_build_object('template_id', input.templateId, 'ref_code', input.ref, 'share_ref', $new_ref),
	//             input.idempotencyKey);
	// COMMIT;
	// return { shareRef: $new_ref };
	//
	// The partial unique index events_one_casual_completion_per_idempotency_key
	// (§2.2) plus this function's own SELECT...FOR UPDATE inside one
	// transaction together guarantee: at most one share_refs row and at
	// most one completion event ever exist per idempotencyKey, and every
	// caller (first attempt or any replay) receives the identical
	// shareRef — the exact guarantee seam contract v2 and V16 require.
}
```
Note the parameter name is `ref` (the INBOUND attribution ref, already
validated by `isRefCode` at the casual-mode HTTP boundary before this
function is ever called — never re-validated here beyond a type check,
since re-deriving that policy in two places was the seam-contract
problem in the first place), not to be confused with the RETURNED
`shareRef` this call mints — the two are never the same value and never
conflated in the payload or the event row.
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
     even transiently. **Medium finding, fixed:** the pre-r2 pipeline
     had no `pipefail`, checked no child's exit code independently, and
     wrote directly to its final filename — a failed `db dump` (network
     hiccup, a locked table) could still leave `age` successfully
     encrypting an EMPTY stdin into a structurally-valid, apparently-
     fine `.sql.age` artefact that decrypts to nothing useful, with the
     script itself exiting 0 the whole way:
     ```bash
     set -euo pipefail   # pipefail is the load-bearing addition: without
                         # it, `cmd1 | cmd2` reports cmd2's exit code
                         # only, so a failed dump piped into a
                         # successful (on empty input) age invocation
                         # would report success.
     command -v age >/dev/null || { echo "age not installed" >&2; exit 1; }
     part="<path>/fairprice-dump-<date>.sql.age.part"
     final="<path>/fairprice-dump-<date>.sql.age"
     trap 'rm -f "$part"' EXIT   # remove the partial on ANY exit path,
                                 # success included (renamed away by then)
                                 # or failure (nothing durable left behind)
     npx -y supabase@2.115.0 db dump --local | age -r "$AGE_RECIPIENT" -o "$part"
     dump_status=${PIPESTATUS[0]}; age_status=${PIPESTATUS[1]}
     [ "$dump_status" -eq 0 ] && [ "$age_status" -eq 0 ] || {
       echo "dump (exit $dump_status) or age (exit $age_status) failed" >&2; exit 1;
     }
     # Structural validation of the decrypted content BEFORE the rename
     # (closes "an apparently valid empty .sql.age" directly — an empty
     # or truncated dump fails this check and never becomes the final
     # artefact at all):
     age -d -i "$AGE_IDENTITY_FOR_SELFCHECK" "$part" | head -c 1 | grep -q . || {
       echo "decrypted dump is empty — refusing to publish artefact" >&2; exit 1;
     }
     mv "$part" "$final"   # atomic rename on success only, per the trap
                           # above's `.part` cleanup never firing once
                           # this line has run
     ```
     An unencrypted dump artefact is a data exposure, not a degraded
     convenience, and this construction means: no plaintext intermediate
     file ever exists (the pipe streams straight into `age`); no partial
     `.age` file is ever mistaken for a complete one (the `.part` suffix
     plus atomic `mv`); and a silently-empty dump can never masquerade as
     a successful backup (the decrypt-and-check-non-empty gate runs
     before the file is ever renamed into its final, discoverable name).
     `AGE_IDENTITY_FOR_SELFCHECK` is the LOCAL private half of
     `AGE_RECIPIENT` for exactly this self-check — never the production
     private key, which this script never holds.
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
	| 'orchestrator' | 'payload_reader' | 'casual_writer' | 'ref_writer'
	| 'scorecard_reader';
// casual_writer/ref_writer added (finding 5 — the pre-r2 matrix omitted
// them entirely despite both being real internal roles with real
// grants, §2.5).

// Finding 5's other structural gap: cells could not encode WHICH row a
// role is attempting to reach relative to itself — "party-low denied on
// party_positions" is meaningless without saying own-row vs
// counterparty-row vs a row in a different session entirely, and the
// pre-r2 matrix conflated all three into one implicit "own session"
// assumption. This dimension is now explicit and required on every
// resource that has row-level structure (every table cell; views/rpcs
// that are session-scoped by argument use 'other-session'/'forged' on
// MatrixResource itself instead, unchanged):
export type TargetRelation = 'own-row' | 'counterparty-row' | 'other-session-row' | 'not-applicable';

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
	readonly targetRelation: TargetRelation;
	readonly sessionState: SessionState;
	readonly hostVisibility: HostVisibility;
	readonly inviteState?: InviteState;   // only meaningful for redeem_invite cells
	readonly expected: 'allow' | 'deny';
	readonly citation: string;  // traces to a T2/finding reference, e.g. "T2-data-layer §2.2"
}

// Finding 5's core fix: `expectedFor` (the decision function §2.10's
// generator calls) no longer encodes the rules itself — that was the
// "bug duplicated in oracle" the audit named, since a bug in §2.3/§2.4
// would then also silently exist in the very matrix meant to catch it.
// GRANT_TABLE is an INDEPENDENTLY-WRITTEN enumeration (authored by
// reading T2-data-layer/T2-product-surfaces directly, not by reading
// §2.3/§2.4's SQL) of every legitimate grant, each citing its source;
// `expectedFor` derives 'allow'/'deny' by looking a cell up against
// THIS table, so a matrix cell and the schema it's checking are two
// independently-derived artefacts that must agree, not one artefact
// checking itself:
export const GRANT_TABLE: ReadonlyArray<{
	readonly role: MatrixRole;
	readonly resource: MatrixResource['kind'] extends 'table' ? string : never | string;
	readonly op: string;
	readonly targetRelation: TargetRelation;
	readonly citation: string;
}> = [
	{ role: 'party-low', resource: 'party_positions', op: 'select', targetRelation: 'own-row', citation: 'T2-data-layer §2.4 — a party reads only their own tuple/status' },
	{ role: 'party-low', resource: 'party_positions', op: 'insert', targetRelation: 'own-row', citation: 'T2-data-layer §2.4' },
	{ role: 'party-low', resource: 'party_positions', op: 'update', targetRelation: 'own-row', citation: 'T2-data-layer §2.4, T2-product-surfaces §2.2 (draft/recalled only)' },
	{ role: 'host-blind', resource: 'party_positions', op: 'select', targetRelation: 'not-applicable', citation: 'no grant — a blind host never reads party_positions directly, only the payload constructor\'s union (T2-product-surfaces §2.4)' },
	{ role: 'host-visible', resource: 'party_positions', op: 'select', targetRelation: 'not-applicable', citation: 'no grant — host-full is a payload-constructor path (T2-data-layer §7 R4), never a direct table read' },
	{ role: 'orchestrator', resource: 'party_positions', op: 'select', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.2 — the narrow orchestrator is the only privileged direct reader of both rows together' },
	{ role: 'orchestrator', resource: 'results', op: 'insert', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.2' },
	{ role: 'orchestrator', resource: 'honesty_signal_storage', op: 'insert', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.2' },
	{ role: 'orchestrator', resource: 'events', op: 'insert', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.6 — session-bound completion/failure events only' },
	{ role: 'orchestrator', resource: 'sessions', op: 'update', targetRelation: 'not-applicable', citation: 'T2-product-surfaces §2.2 — locked→closed only, via the fenced claim (§2.5)' },
	{ role: 'payload_reader', resource: 'results', op: 'select', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.2 — the payload constructor\'s sole read path' },
	{ role: 'casual_writer', resource: 'events', op: 'insert', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.6/§2.8, seam contract v2 — completeCasualPlay' },
	{ role: 'casual_writer', resource: 'share_refs', op: 'insert', targetRelation: 'not-applicable', citation: 'seam contract v2 — completeCasualPlay issues the ref in the same transaction' },
	{ role: 'ref_writer', resource: 'visits', op: 'insert', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.6 — recordVisit' },
	{ role: 'scorecard_reader', resource: 'events', op: 'select', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.7' },
	{ role: 'scorecard_reader', resource: 'share_refs', op: 'select', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.7' },
	{ role: 'scorecard_reader', resource: 'visits', op: 'select', targetRelation: 'not-applicable', citation: 'T2-data-layer §2.7' }
	// Every row above has a citation; every row NOT listed here, for
	// every role×resource×op combination the schema/RLS defines, is a
	// hard 'deny' by construction — `expectedFor` treats absence from
	// GRANT_TABLE as the default, never as "unspecified."
];

export function expectedFor(cell: Omit<MatrixCell, 'expected' | 'citation'>): 'allow' | 'deny' {
	// Looks up (cell.role, cell.resource, cell.targetRelation) against
	// GRANT_TABLE; 'allow' only on an exact match whose own row-state/
	// invite-state/host-visibility guards (encoded per-entry, elided
	// above for brevity — VERIFY AT EXECUTION the full per-entry guard
	// shape before treating this sketch as complete) also hold for this
	// cell's sessionState/hostVisibility/inviteState; 'deny' otherwise.
	// This function does NOT re-derive §2.3/§2.4's SQL — it is the
	// independent oracle finding 5 required.
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
// MatrixRole × every SessionState × every HostVisibility ×
// TargetRelation, computed programmatically, each cell's `expected`
// derived from `expectedFor` above (the independently-written
// GRANT_TABLE oracle, finding 5's fix — NOT a restatement of §2.3/2.4's
// SQL) — every role/resource/target-relation combination defaults to
// 'deny' unless GRANT_TABLE explicitly justifies it.
// `export const AUTHZ_MATRIX: MatrixCell[] = generateMatrix();`

// Schema-introspection completeness check (finding 5's other
// requirement): before the matrix even runs, a setup step queries
// Postgres's own catalogue —
//   select table_name from information_schema.tables where table_schema = 'public'
//   select routine_name from information_schema.routines where routine_schema = 'public' and security_type = 'DEFINER'
// — and asserts every name returned appears in RESOURCES (as a table)
// or the rpc list, respectively. A table or SECURITY DEFINER function
// added by a future migration with NO matching RESOURCES entry FAILS
// this check immediately (not silently defaulted to 'deny' and never
// tested at all) — this is what makes "a NEW table added later without
// a matrix entry is a missing-coverage bug the generator can assert
// against" actually true, rather than aspirational:
export async function assertSchemaCoverage(): Promise<void> {
	// Implementation queries information_schema as above (via the
	// migration-owner connection, the only one with catalogue read
	// access broad enough) and throws, listing every uncovered name, if
	// the two sets are not equal. Run once at the top of
	// tests/rls/matrix.test.ts, before any cell is exercised.
}
// A handful of cells are listed here as WORKED EXAMPLES (not the
// complete set — the generator produces the rest):
export const WORKED_EXAMPLES: MatrixCell[] = [
	{ role: 'party-high', resource: { kind: 'table', name: 'party_positions', op: 'select' },
	  targetRelation: 'counterparty-row',
	  sessionState: 'open', hostVisibility: 'blind', expected: 'deny',
	  citation: 'T2-data-layer §2.2 no-deal/blindness contract — party-high reading party-low\'s row' },
	{ role: 'unrelated-authenticated', resource: { kind: 'table', name: 'results', op: 'select' },
	  targetRelation: 'not-applicable',
	  sessionState: 'closed', hostVisibility: 'blind', expected: 'deny',
	  citation: 'T2-data-layer §2.2 — results has no client-facing SELECT policy at all' },
	{ role: 'other-session-party-low', resource: { kind: 'rpc', fn: 'submit_position', args: 'other-session' },
	  targetRelation: 'other-session-row',
	  sessionState: 'open', hostVisibility: 'blind', expected: 'deny',
	  citation: 'finding 2 — session_participants scoping must refuse cross-session identity reuse' },
	{ role: 'host-blind', resource: { kind: 'rpc', fn: 'is_session_host', args: 'forged' },
	  targetRelation: 'own-row',
	  sessionState: 'open', hostVisibility: 'host-visible', expected: 'deny',
	  citation: 'T2-data-layer §4 forged role/mode — a party asserting a host claim' },
	{ role: 'host-visible', resource: { kind: 'view', name: 'aggregate_fair_price_published' },
	  targetRelation: 'not-applicable',
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
- **Casual has no test in this suite at all (seam contract v2):** this
  brief ships no casual constructor to test — `T3-m1-casual-mode`'s own
  `casualPayload.test.ts` (V0a/V0b) is the sole golden test for the
  casual class, against its `buildCasualResultPayload`. A test here
  instead asserts the NEGATIVE: `grep -RL "constructCasualPayload" src`
  (or an equivalent AST check) finds no occurrence anywhere in this
  brief's own tree — proving the deleted function was actually removed,
  not merely unexported.
- **Per-class golden key-set tests (finding 4's fix):** for each of the
  four classes (party, blind-host, host-full, developer), assert
  `Object.keys(payload)` deep-equals exactly that class's key list from
  §2.7 (`PER_PARTY_SAFE_KEYS` (+ own or both distances) for party/
  blind-host, `+ RAW_INPUT_KEYS` for host-full, `+ DEVELOPER_ONLY_KEYS`
  for developer) against the same `comfort`/`deal`/`no-deal` fixtures —
  no more, no fewer, mirroring the casual sibling's V0a/V0b discipline
  exactly. Specifically assert `layers`/`honesty`/`curves` are absent
  from the host-full payload (the r1/pre-r2 bug this finding named
  directly) even though they are present in the developer payload for
  the same fixture.
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
  tests/rls` → PASS: exit 0, `assertSchemaCoverage()` (§2.10) passes
  first, every cell in `AUTHZ_MATRIX` (§2.10) asserted per `expectedFor`
  against the independent `GRANT_TABLE` oracle, including the named
  required scenarios (cross-session identity reuse, full
  invite-lifecycle, forged-claim, aggregate-view universal denial,
  staleness re-claim) and every `targetRelation` variant (own-row,
  counterparty-row, other-session-row) for every row-structured
  resource.
- **V2 — payload-construction golden suite:** `npm run test:unit --
  --run tests/payload` → PASS: exit 0, every case in §2.11 passing
  (both `host_visibility` modes, the forged/mismatched-principal error
  case, the four per-class golden key-sets — party/blind-host/host-full/
  developer — with `layers`/`honesty`/`curves` absent from host-full
  specifically, the negative `constructCasualPayload`-deletion check,
  and the egress check for both `rawResultReader` and the `hostFull`
  computation site).
- **V3 — transition-function suite:** direct Vitest/`postgres`-js tests
  exercising the full §2.2 happy path (create [via the reserve-then-debit
  seam, §2.5] → redeem [including OTP email-match] → submit both →
  auto-lock → `claimAndOrchestrate`'s fenced finalize → auto-close →
  single completion event) plus the guard failures named in §2.10 that
  overlap lifecycle (double-submit, recall-then-resubmit,
  recall-after-other-submitted, cancel-with-one-submitted-allowed,
  cancel-with-both-submitted-refused) plus the fenced-finalize race
  (finding 3, §2.5's retry table): a stale claim reclaimed by a second
  worker while the first worker's finalize is still in flight leaves
  exactly one result row, one completion event, and a `closed` session,
  written by whichever worker's fence actually matched → PASS: exit 0.
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
- **D6 (new, r2) — casual payload construction is deleted from this
  brief, per seam contract v2 (§1, §2.7).** Resolves the r2 audit's
  finding 4 sibling-conflict: `T3-m1-casual-mode`'s
  `buildCasualResultPayload` is now the ONE canonical casual
  constructor; this brief's `constructCasualPayload` and its golden
  test are removed rather than reconciled field-by-field, because
  maintaining two independently-evolving allowlists for the same
  disclosure boundary is itself the risk, not merely today's mismatch.
- **D7 (new, r2) — `completeCasualPlay` replaces the v1
  `issueCasualRef`/`recordCasualCompletion` pair (§1, §2.8).** The two
  functions could not be made idempotent as a PAIR without either a
  distributed lock this brief has no mechanism for, or collapsing them
  into one transaction — this brief takes the latter, simpler path,
  which is why the operation is now named for what it does
  (`completeCasualPlay`) rather than for its two internal side effects.
- **D8 (new, r2) — `orchestration_fence` is a monotonic sequence value,
  not a second timestamp (§2.5).** A second `orchestration_claimed_at`-
  style timestamp compared with `<`/`>` risks a same-millisecond tie
  under concurrent claims; a `bigint` from a dedicated sequence has no
  tie case by construction, at the cost of one extra column and
  sequence — judged worth it for a fencing token's one job (proving
  "am I still the claim that finalize should trust").

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
  code `completeCasualPlay` produces; the regex is asserted against both a
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
