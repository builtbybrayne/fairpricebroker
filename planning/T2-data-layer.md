---
id: T2-data-layer
plan_kind: thematic
tier: 2
status: active
---

# T2-data-layer — the vault and the ledger

## 0. Human summary (plain language)

**This is the blueprint for the data: what we store, who may see or change
what, and how today's entries become tomorrow's valuable dataset.** It
enforces the product's core promise in the database itself — every read
AND write is deny-by-default, so nobody (curious programmer, AI agent, or
clever attacker replaying an invite) can reach the other side's numbers.
It tightens the anonymous-statistics rule so "20 entries" means twenty
*different people*, not one person twenty times, and statistics can't be
cross-compared to unmask small groups. And it treats deletion honestly:
when someone asks to be erased, their identity disappears from every copy
we control — exports and backups included — while the anonymous statistics
survive. Decisions are recorded in the rulings at the bottom (one small
one — the erasure blurring policy — is ruled by leaning, revisitable).

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 4 (19 Aug 2026). Inherits T1 §2 by
> reference — especially §2.1 (blindness), §2.4 (metadata + disclosure
> boundary), §2.7 (measure the loop). Owns authorisation/blindness
> enforcement and role-safe payload construction (T1 §3; T2-engine §2.2).
> Datastore ruled: Postgres via Supabase (T1 §5 Addendum 3).
>
> Revised 19 Aug 2026 addressing Codex audit round 1 (verdict: revise;
> 3 high / 4 medium / 1 low — return at
> `.exfu/returns/t2-data-layer-audit-r1.json`).

>
> **Accepted 20 Aug 2026 by Alastair** (operator ceremony, in-chat), after
> Codex audit round 1, revisions addressing all findings, and the
> operator's retention/erasure rulings (§6).

## 1. Why (theme intent)

Two assets live here: the trust (blindness that is true in the schema, not
promised in the UI) and the option on a data business (expectation data
that exists nowhere else — worthless unless the metadata is captured from
row one). Both are day-one schema decisions that cannot be retrofitted.

## 2. How — architectural principles

1. **Authorisation is a deny-by-default matrix**, not a read rule. The
   binding contract is a resource × operation × role × lifecycle-state
   matrix (party positions, sessions, invites, results, events,
   attribution, honesty signals, identities × select/insert/update/
   lifecycle-transition × the T2-product-surfaces §2.4 role set ×
   session states/modes): everything not explicitly granted is denied,
   writes and state transitions included. Principal, session membership,
   and session mode are always derived server-side from persisted state —
   never accepted from a caller. Row-level security implements the
   read/write rows; lifecycle transitions run through guarded functions
   implementing T2-product-surfaces §2.2's transition contract.
2. **The engine is pure; a narrow orchestrator feeds it.** A server-side
   orchestrator (the only privileged data path) reads both parties'
   inputs, invokes the pure engine (T2-engine §2.1 — the engine itself
   holds no credential and performs no I/O), stores the classified
   result, and exits. Its privilege is a narrowly-scoped database
   function/role usable only by that job, with audited invocations. **Raw
   results are reachable only through the payload constructor** — the
   single module that turns a stored classified result + a server-derived
   role/mode into a role-safe payload (consumed by surfaces and agent
   doors; no other egress exists). The no-deal contract (own distance
   only) and the casual full-detail exception are constructed here.
3. **Money is NUMERIC.** All prices stored as arbitrary-precision decimals
   (T2-engine §2.6): no floats in schema, no rounding at rest; display
   transforms happen in surfaces.
4. **Metadata at entry, snapshotted per fact** (T1 §2.4): every
   contributing fact row (party position, survey response) carries its
   own immutable snapshot of vertical (template), role/direction, region,
   **currency/unit**, and date — copied at write time, not joined at read
   time. Absent metadata is stored as explicitly-unknown, never guessed.
5. **The aggregate boundary counts people, not rows.** A published cell
   requires **N ≥ 20 distinct data subjects** (not rows); per-subject
   contribution to any cell is capped (one contribution per subject per
   cell period; later contributions supersede, never accumulate).
   Aggregates partition ONLY on the §2.4 snapshot dimensions and always
   include currency/unit and role/direction — **no cross-currency or
   cross-direction price aggregation exists** absent a separately ruled
   conversion policy. Suppression rules govern overlapping and successive
   releases: a cell is withheld when its difference against any other
   published cell (including a prior period's) could expose a group
   smaller than the threshold. Aggregates are SQL views/materialised
   views, versioned in-repo, the only path to published/benchmark data;
   raw rows never leave (T1 §2.4: data-subject access and controlled
   processing excepted).
6. **The activation funnel is a contract, not an inference** (T1 §2.7):
   share-link ref codes are issued per shared artefact; an inbound ref is
   correlated across anonymous visit → session creation → **exactly one
   completion event per session** (emitted idempotently at the
   `locked`→`closed` transition, the ruled definition of completion) —
   for signup and zero-signup paths alike. Stable correlation keys:
   ref id → anonymous visit id → session id. Completed two-party
   reconciliations (the venture activation metric) are a query over these
   events, not a heuristic.
7. **Events are rows** (T1 §2.7): product events into a plain events
   table with defined identity (event type + session id + monotonic
   sequence) so replays deduplicate; the scorecard agent reads via a
   read-only role or the nightly export (both remain available).
8. **Retention and erasure are a data-class matrix.** Per data class
   (identities, party positions, results, invites, attribution, events,
   honesty signals) × session type × copy (live DB, aggregate views,
   nightly export, backup dumps):
   - *Sessions are permanent as statistical records; identity is not.*
     PII lives only in identity rows referenced by fact rows.
   - *Erasure request*: identity rows purged/anonymised; fact rows
     survive only if genuinely anonymous — verified by re-identification
     review of the residual tuple+metadata, with metadata coarsened where
     a residual row would identify (small-N verticals/regions). Cascade
     covers invites (emails), attribution joins, event payloads, and the
     user-facing export bundles.
   - *Invited-session PII sweeper* (ruled — §6 R1; shape renamed from 'quick' by §6 R3 cross-ref): purges invite emails and
     other PII 30 days after an invited session closes; **the fact rows
     (tuples + metadata snapshots) are retained indefinitely** as
     anonymised statistical records — the operator's ruling is "store as
     much as we can for as long as we can" once no name is on it, with an
     on-page disclosure line ("sessions are stored, anonymised,
     for analysis").
   - *Casual sessions store no price data at all* (ruled — §6 R1): the
     casual operation is stateless; the only persisted trace is an
     anonymous completion event (template id, timestamp, attribution ref)
     so the activation metric and usage counts still work (T1 §2.7).
   - *Copies*: exports regenerate nightly (post-purge state wins within
     24h); backup dumps expire on a fixed schedule so purged identity ages
     out of all copies; a restore replays a purge tombstone log before
     serving traffic.
9. **Separability:** everything lives in a product-owned Supabase project
   assignable to the Newco; the aggregate dataset is deliberately an exit
   asset (venture ruling). This layer produces the nightly dump and
   defines its content/encryption expectations; **scheduling, storage
   target, credentials, and failure alerting are T2-platform's** (its
   backup contract), via an explicit interface: "a dump artefact per day,
   encrypted, handed to the platform backup path".

## 3. What — components

1. **Schema**: identities (user/org, PII-bearing, purgeable), sessions
   (type, template, mode, state, currency), party positions (NUMERIC
   tuples, RLS-isolated, metadata-snapshotted), results (engine payloads
   with field classes + version metadata), invites, events, attribution
   refs, honesty-signal storage (developer-only), purge tombstone log,
   and a **billing-reference seam** — a neutral table linking a future
   payment provider's immutable event/purchase ids to accounts, carrying
   no assumptions about credits or subscription shapes (the paid model is
   deliberately unruled; T2-platform owns the provider boundary).
2. **The authorisation matrix** (§2.1) as RLS policies + guarded
   transition functions, versioned in-repo.
3. **The payload constructor** (§2.2).
4. **Aggregate views** with the distinct-subject N≥20 rule, contribution
   caps, mandatory currency/direction partitions, and suppression rules.
5. **The nightly job**: refresh aggregates, regenerate export snapshot to
   the library scope, produce the encrypted dump artefact for the
   platform backup path. Failure surfaces on the scorecard.
6. **GDPR toolset**: per-user export bundle; erasure routine with
   re-identification review and cascade (§2.8); invited-session sweeper;
   tombstone replay on restore.

## 4. Verification approach (binding on T3s)

- Authorisation adversarial suite over the full matrix: every role
  attempts every non-granted operation (reads, writes, transitions,
  function calls, view access), including forged role/mode parameters and
  invite-replay after redemption or session close — all denied at the
  database.
- Payload-construction golden tests per role × mode × deal outcome,
  including no-deal own-distance-only and the casual exception; assert no
  other egress path for raw results exists (code-level check: only the
  constructor imports the raw-result reader).
- Aggregate-boundary tests: duplicate-contributor cells below 20 distinct
  subjects never materialise; differencing fixtures (overlapping cohorts,
  successive periods) trigger suppression; no view mixes currencies or
  directions.
- Funnel tests: ref → visit → session → single idempotent completion
  event, both signup and zero-signup; replay produces no duplicates.
- Erasure tests: after purge, identity is absent from live DB, next-day
  export, and post-restore state (tombstone replay); residual fact rows
  pass the re-identification check or show coarsened metadata.
- Precision round-trip: 4-d.p. values in and out unchanged.

## 5. Open questions (HITL)

- **Q1 — invited-session PII window** (business ruling): the prototype
  said 30 days. Adopt 30 days now? Leaning yes, revisit at paid layer.
- **Q2 — erasure coarsening policy.** When a purged user's residual fact
  row is potentially identifying (rare vertical × region), do we coarsen
  metadata (keep the row, blur the cell) or drop the fact row entirely
  (lose the data point)? Leaning: coarsen, drop only when coarsening
  cannot make it safe.

*(Moved out per audit: the backup target/scheduling question now lives in
T2-platform's backup contract.)*

## 6. Rulings (19 Aug 2026, operator, in-chat)

- **R1 (Q1 — retention): RULED, reshaped.** Data is kept, identity is
  not: invited-session fact rows (tuples + metadata) are retained
  indefinitely as anonymised statistical records with an on-page
  disclosure; only PII (invite emails etc.) is swept, 30 days after
  close. Casual sessions never persist price data — stateless
  computation, anonymous completion event only. (Operator's reasoning:
  no pressure to delete nameless data; free/casual sessions shouldn't
  really touch the database at all. Orchestrator's note, accepted into
  the contract: invited (formerly quick) sessions MUST touch the database — blindness
  requires the server to hold party A's sealed input while party B takes
  days — so ephemerality is casual-only; and even casual computation
  stays SERVER-side, never in-browser, because shipping the engine in
  the client bundle would publish the trade-secret maths and bypass
  abuse controls. Ephemeral ≠ client-side.)
- **R2 (Q2 — erasure): RULED — the reconciliation stands.** On an
  erasure request, user identity is replaced with placeholder data; the
  reconciliation record itself is never dropped (obligation to the
  counterparty, and a legitimate-interest basis for retaining the
  transaction record). Where the residual row could still identify,
  coarsen metadata; dropping the fact row is not an option. "We can only
  do our best; we cannot change reality."
- **Related idea captured business-side:** pre-canned quick-session
  templates configured for questions with deliberate data value (scope
  note, 19 Aug 2026).

- **R3 cross-reference (19 Aug 2026, later):** the session-shape
  restructure (T2-product-surfaces §6 R3) merges quick+direct into the
  *invited* shape; this plan's retention and sweeper rulings apply to
  invited sessions unchanged. The credit balance lives on account
  identities; the billing-reference seam is unchanged.
