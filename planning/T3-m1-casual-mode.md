---
id: T3-m1-casual-mode
plan_kind: thematic
tier: 3
t2_parent: T2-product-surfaces
milestone: M1-working-instrument
status: draft
---

# T3 — M1 casual mode: the homepage instrument

> Revised 7 Sep 2026 addressing Codex audit r1 (verdict: revise; 3 high /
> 3 medium / 1 low). Gist: the response payload is now an explicit
> allowlisted `CasualResultPayload`, not the full `ReconcileResult`;
> inbound `ref` is validated at the HTTP boundary through the shared
> ref-code authority; the two data-core seams are pinned to the
> orchestrator's binding contract (`issueCasualRef` / async,
> `recordCasualCompletion` / idempotent) with wiring now a required,
> two-stage Done condition; the endpoint is reclassified as a UI adapter
> over a named shared casual capability contract rather than a
> freestanding public capability; the transport-status contradiction
> (400 vs 200) is resolved and a transport-failure state machine
> transition is added; and verification gains mobile-viewport,
> accessibility, and 4-d.p.-precision coverage plus the ref-boundary and
> transport-failure tests the findings demanded.
>
> **Revised 7 Sep 2026 addressing Codex audit r2 (verdict: revise; 2
> high / 3 medium); seam contract v2 (orchestrator-ruled) adopted.**
> Gist: dropped the false compile-time non-assignability claim and V0c
> entirely; moved the shared ref-code module to the neutral
> `src/lib/server/refCodes.ts` (not under data-core's directory) so this
> brief stays self-executable regardless of landing order; replaced the
> two v1 seams with the single transactional `completeCasualPlay`
> operation and added the Stage-2 V16 response-loss-after-commit test;
> split the invalid-ref case into malformed (400, discard-and-retry
> client transition) vs legitimate-null (proceeds); and named the
> capability-catalogue rate-limit wiring as an explicit M1 blocker in
> Stage 2's Done condition. Return:
> `.exfu/returns/t3-m1-casual-mode-audit-r2.json`.
>
> **Post-cap revision r4, 7 Sep 2026, addressing audit r3 (unaudited —
> for operator acceptance): concurrency-safe `completeCasualPlay`
> (advisory lock, conflict re-read, `share_ref`-not-`ref_code` replay
> value, unknown-after-transport-failure framing) plus a concurrent-call
> V16 case; `refCodes.ts`'s exact body now pinned verbatim in this brief
> with a first-lander-create/second-verify instruction and a
> grammar/byte-identity test; the ref-rejected client transition now
> guards on a stable machine-readable `{ error: "invalid-ref" }` body
> rather than status-plus-non-null-ref, with a new negative test for a
> valid ref alongside a separately malformed field; the host-visible
> catalogue-handler sentence is removed from §2 (this brief's consumers
> are casual UI/HTTP/MCP only); and §6's inbound-ref-capture note is
> corrected to `+page.ts` (matching §7, which was always right). Return:
> `.exfu/returns/t3-m1-casual-mode-audit-r3.json`.

## 0. Human summary (plain language)

**Build the free homepage demo: two people, one phone, no signup.** Person A
types four prices while B looks away; the screen confirms and hides A's
numbers before B takes the phone; B types theirs; a "both look now" screen
holds the result until both are watching; then the fair price appears —
without either person's raw numbers, until someone taps "show the numbers."
The pair can share the result. Nothing anyone typed is ever saved.

---

> Parent: `T2-product-surfaces` (§2.1 disclosure authority, §2.6 payload-class
> reveal, §3.1 landing-page component, §6 R2/R5/R6). Milestone:
> `M1-working-instrument` item 4. Depends on: `T3-m1-scaffold` (app skeleton,
> route/lib directories) and `T3-m1-engine-port` (§2.2's public contract —
> `reconcile`, `DirectionalParty`, `ReconcileOutcome`, `ReconcileResult`,
> `PricePoint`, `FIELD_CLASSES` — consumed as-is, never redefined). Coupled,
> not blocked, by `T3-m1-data-core` (drafted in parallel): this brief
> declares the one seam it needs from the data layer (§2.6, seam
> contract v2's `completeCasualPlay`) and ships a self-executable
> stand-in so it does not wait on landing order. The one genuinely
> shared file, `src/lib/server/refCodes.ts`, is NEUTRAL (fixing the r2
> audit's high finding that this brief could not compile if it landed
> first): it lives directly under `server/`, not under data-core's
> `server/data/` directory, and whichever brief lands first creates it
> — this brief creates it if it lands first, or verifies byte-identity
> against data-core's copy if it lands second — so landing order never
> blocks either brief.

## 1. Environment facts (pinned)

- Build target confirmed present from `T3-m1-scaffold`: `src/routes/`,
  `src/routes/api/`, `src/lib/server/engine/` (barrel exports per
  T3-m1-engine-port §2.10), `src/lib/server/data/` (owned by
  T3-m1-data-core — this brief does not write inside it). **VERIFY AT
  EXECUTION:** confirm these paths exist and `src/lib/server/engine`
  exports `reconcile`, `DirectionalParty`, `ReconcileOutcome`,
  `ReconcileResult`, `PricePoint`, `FIELD_CLASSES`, `ENGINE_VERSION`
  before writing any import against them — if the barrel shape differs
  from T3-m1-engine-port §2.2/§2.10 as drafted, STOP and report the
  mismatch rather than adapting silently.
- No client-side lib directory exists yet in the scaffold (`sv` generates
  `src/lib/` with no subfolders beyond the example content). This brief
  creates `src/lib/client/casual/` for the first time.
- Test runner: Vitest `server` project (node environment,
  `src/**/*.{test,spec}.ts`) for the server-side contract; Playwright
  (`**/*.e2e.ts`, builds+previews on :4173) for the flow. Both per
  T3-m1-scaffold §1's observed topology — `npm run test:unit -- --run`
  and `npm run test:e2e`.
- Design authority: `docs/design-brief.md` (The Instrument, accepted
  ruling) — referenced, not restated. This brief specifies only which
  components exist and what state each must render; visual treatment
  (neumorphic surfaces, calm shell, gamified flow-progress, motion
  timing) is the designer/implementer's job against that brief, subject
  to WCAG 2.1 AA (T2-product-surfaces §2.7).
- Disclosure ruling this brief implements exactly, no more: casual is
  **one of the two enumerated** T1 §2.1 full-detail exceptions (the other
  being host-visible-configured verticals, T1 Addendum 7 / T2-product-
  surfaces §7 R7 — out of scope here; this brief touches only casual). One
  device transiently holds both parties' tuples client-side
  (T2-product-surfaces §6 R5's honest note: this is UX-enforced etiquette,
  not cryptographic blindness). Nothing entered is **persisted**
  server-side under any outcome (T2-data-layer §2.8: casual sessions store
  no price data at all — the only persisted trace is the anonymous
  completion event, §2.6). This brief does not expand into recruitment
  host visibility or guided demos (§9) — those are R7–R10/§9 R11's scope,
  not M1 casual mode's.

## 2. Route and module choice (justified)

**Route:** the whole flow lives on the existing landing route,
`src/routes/+page.svelte` (T1 §2.6 — the landing page IS the product; no
separate `/casual` route). No new page route is created.

**Compute path:** `src/routes/api/casual/reconcile/+server.ts` — a JSON
POST endpoint, **not** a SvelteKit form action. Justification against the
stateless-server-computation constraint (T2-data-layer §2.6 R1's
"ephemeral ≠ client-side" ruling, T2-product-surfaces §6 R2):
1. The choreography is a client-driven state machine across five screens
   with no page navigation between them (§3); a form action's natural
   unit is one page's `<form>` submit, which fits poorly against
   interstitials that must hold state (`both-look-now`) independent of
   any single form.
2. M1 DoD item 8 requires an AI agent to "run a casual reconciliation"
   through the agent doorway (T2-agent-distribution). A plain JSON
   endpoint with a stable request/response contract (§4) is the shape
   that doorway wraps; a form action returning SvelteKit's action-result
   envelope is not.
3. The endpoint performs no I/O beyond the pure engine call and the one
   seam call (§2.6) — it never reads or writes `src/lib/server/data/`
   session tables, so it carries none of form actions' session/CSRF
   machinery that exists for stateful mutations.
- The endpoint takes no cookies, issues no session, and is retry-safe
  given the same client-minted `idempotencyKey` (§6): repeating the POST
  with an unchanged key never duplicates the completion event or issues a
  second ref.

**Catalogue classification (medium finding — the endpoint is not a
freestanding public capability):** `handleCasualReconcile` (§4) is a
**named shared casual capability contract** — the same function
T2-agent-distribution's MCP "run a casual reconciliation" tool (§2.3's
casual exception) and this route both consume. **Its consumers are
casual UI, HTTP, and MCP adapters only (r4, addressing the r3 audit's
medium finding)** — a future host-visible catalogue handler is
explicitly NOT a consumer of this seam: a host-visible session
(T2-product-surfaces §7 R7/§9 R11) is an **invited**-orchestration
mode requiring auth, session persistence, and the invited
payload-authorisation path (`T3-m1-data-core` §2.7's
`constructInvitedPayload`/`resolveInvitedViewer`), never casual's
stateless, unauthenticated seam — this brief does not widen
`handleCasualReconcile` toward it, now or by implication.
`src/routes/api/casual/reconcile/+server.ts` is a **same-origin UI
adapter over that contract**, not an independently defined public HTTP
capability: it does no more than parse the browser's JSON body, call
`handleCasualReconcile`, and serialise the response (§4). The catalogue
entry itself — capability name, auth tier (none — casual is
unauthenticated by design), rate-limit class (`compute`, per
T2-agent-distribution §2.7), and payload class returned
(`CasualResultPayload`, §4.1) — is declared here as a seam this brief
depends on but does not build:

```typescript
// Declared seam, T2-agent-distribution's catalogue (not built in this
// brief). handleCasualReconcile (§4) is the shared implementation both
// this route and the catalogue's MCP/HTTP adapters call.
export const CASUAL_RECONCILE_CAPABILITY = {
  name: 'casual.reconcile',
  authTier: 'none',
  sessionTypes: ['casual'],
  invokingRole: 'co-present-pair',
  payloadClass: 'casual-full-detail',
  rateLimitClass: 'compute'
} as const;
```

This brief's own route stays exempt from a *second*, independent
rate-limit enforcement path (it has none of its own — that would be the
doorway pulling in early); the shared handler and its rate-limit class
are declared so the doorway brief wires the same `compute` budget over
the same door-neutral function rather than inventing a second one. Making
the MCP/HTTP catalogue adapters call `handleCasualReconcile` for real is
T2-agent-distribution's build, tracked as a parity dependency on this
brief's output, not as work this brief performs.

## 3. Client state machine (exact states and transitions)

Owned by `src/lib/client/casual/CasualFlow.svelte`. All state is
in-memory Svelte state (`$state` runes) — never `localStorage`,
`sessionStorage`, nor any store with persistence middleware; a page
reload loses everything, which is correct (nothing must survive past the
tab).

**States:** `idle` · `party-a-entry` · `a-confirm-hide` · `handover` ·
`party-b-entry` · `both-look-now` · `transport-error` · `reveal`.

**Transitions** (event, guard, from → to, side effect):

| Event | Guard | From → To | Side effect |
|---|---|---|---|
| `start` | — | `idle` → `party-a-entry` | start the elapsed-time clock (§5 V-e2e-1) |
| `a-submit` | tuple is 4 strictly-ascending values per `casualTemplate.ts`'s client-side mirror of the engine grammar (§2.3 note) | `party-a-entry` → `a-confirm-hide` | store A's tuple in component state only |
| `a-confirm` | — | `a-confirm-hide` → `handover` | none (A's entries stop being rendered anywhere from this point until `reveal` with `numbersShown`) |
| `handover-ready` | — | `handover` → `party-b-entry` | none |
| `b-submit` | tuple valid per the same client mirror | `party-b-entry` → `both-look-now` | mint `idempotencyKey` (a client-side `crypto.randomUUID()`) **once, here** — the only mint point in the whole flow; fire `POST /api/casual/reconcile` (§4) immediately carrying it; store the pending promise, do not await it before the transition |
| `outcome-received` | `fetch` resolved with a parseable JSON body (ok or error) | `both-look-now` → `both-look-now` (internal) | store `CasualReconcileResponse` in state; does not by itself advance the screen |
| `ref-rejected` (medium finding, new — a DISTINCT transition from `transport-failed`; guard corrected r4 per the r3 audit's medium finding) | response is `HTTP 400` AND the response body deep-equals `{ error: "invalid-ref" }` — the stable, machine-readable code §4 now returns for exactly this case (§4). **Never** inferred from "status 400 plus a non-null stored `ref`": that pairing cannot distinguish an invalid-ref 400 from a malformed-tuple-shape 400 that happens to also carry a valid ref, and guarding on it would silently discard a valid ref alongside an unrelated structural-400 retry (the r3 finding's named risk) | `both-look-now` → `both-look-now` (internal, auto-retry) | discard the stored `attributionRef` from memory (set to `null`); immediately re-fire `POST /api/casual/reconcile` with the **same** `idempotencyKey`, `ref: null`; this is automatic, no user-visible error screen — a corrupted/tampered inbound ref must never trap the pair on an unusable-ref loop (the finding's "can trap the B-correction path with the same unusable ref"), and retrying with `ref: null` is always the legitimate no-attribution path (§4), never itself rejected |
| `transport-failed` | `fetch` rejected (network error) OR the response body failed to parse as JSON OR the response was `HTTP 400` for a reason OTHER than `{ error: "invalid-ref" }` (malformed JSON, wrong tuple shape, or a well-formed valid ref alongside a separately malformed field — the r4 negative test, §8 V12c) OR the response was a 4xx/5xx the client didn't expect (§4's transport policy — anything other than the documented 400/200 shapes) | `both-look-now` → `transport-error` | preserve `idempotencyKey` and both stored tuples unchanged; **no seam was reached, nothing to roll back is the UI's operating assumption, not a proven fact** — a rejected fetch does not prove the server-side transaction never committed (it may still have been in flight, or committed with the response lost in transit); the seam's true state after a transport failure is UNKNOWN (r4, §6), which is exactly why `retry` below always resends the SAME `idempotencyKey` rather than minting a fresh one |
| `retry` | in `transport-error` | `transport-error` → `both-look-now` | re-fire `POST /api/casual/reconcile` with the **same** `idempotencyKey` (§6's idempotency contract exists precisely so this retry cannot duplicate a completion event or double-issue a ref) |
| `give-up` | in `transport-error` | `transport-error` → `idle` | clears both tuples, the response, and `idempotencyKey` from memory (return-to-entry path) |
| `continue` | `outcome-received` has occurred AND response was `ok: true` | `both-look-now` → `reveal` | stop the elapsed-time clock |
| `continue` (error path) | response was `ok: false` (a well-formed 200 engine rejection, §4) | `both-look-now` → `party-b-entry` | surface the engine's `error.detail` as an inline correction message on B's entry screen; A's tuple is retained in memory unchanged; `idempotencyKey` is discarded — a corrected resubmission is a new logical attempt and mints a fresh key at the next `b-submit` |
| `toggle-numbers` | in `reveal` | `reveal` → `reveal` | flips local `numbersShown` boolean, default `false` (R6) |
| `restart` | in `reveal` | `reveal` → `idle` | clears both tuples, the response, and `idempotencyKey` from memory |

Two hard invariants the component tests assert (§5):
1. **No template, prop, or DOM node ever renders A's tuple values during
   `handover`, `party-b-entry`, `both-look-now`, or `transport-error`** —
   this is the mechanical form of DoD item 9's "A's figures hidden before
   handover" and "B cannot reveal them" (there is no control in any of
   those four states that reads A's stored tuple).
2. **The reveal screen (fair price, zone, animation, result card) is
   never mounted before the `reveal` state is entered** — the mechanical
   form of "outcome appears only at the both-look step." The
   `both-look-now` screen may show a neutral "computing…" affordance
   while the fetch is in flight but must not branch its render on the
   response content.

## 4. Server contract (`src/lib/server/casual/casualReconcile.ts`)

Pure-ish orchestration function, unit-testable without spinning up a
SvelteKit request — the `+server.ts` route is a thin adapter over it.

```typescript
import { isRefCode, type RefCode } from '$lib/server/refCodes';
// NEUTRAL location (seam contract v2) — this brief creates this file
// if it lands first, or verifies byte-identity against T3-m1-data-core's
// copy if it lands second. Never `$lib/server/data/refCodes` — that
// path is data-core's own directory, which this brief does not write
// inside (§1).

export interface CasualReconcileRequest {
  partyATuple: readonly [string, string, string, string];
  partyBTuple: readonly [string, string, string, string];
  ref: RefCode | null; // inbound attribution ref, validated at the HTTP boundary (below)
  idempotencyKey: string; // client-minted UUID v4, §3 b-submit, validated as UUID v4 at the HTTP boundary
}

export type CasualReconcileResponse =
  | { ok: true; result: CasualResultPayload; shareRef: RefCode }
  | { ok: false; error: EngineError };

export function handleCasualReconcile(
  req: CasualReconcileRequest,
  deps: { completer: CasualPlayCompleter }
): Promise<CasualReconcileResponse>;
```

`handleCasualReconcile`:
1. Builds two `DirectionalParty` values from `casualTemplate.ts`'s fixed
   directional mapping (§2.5) and the two raw tuples, wrapping each raw
   value as a `DecimalString` (no re-validation beyond what `reconcile`
   itself performs — the engine is the sole validation authority per
   T3-m1-engine-port §2.3; this function does not duplicate grammar
   checks).
2. Calls `reconcile(partyA, partyB)` (default tolerance, `relative-r1`,
   per T3-m1-engine-port §2.5 ruling §6 R1).
3. On `{ ok: false }`: returns `{ ok: false, error }` unchanged. The
   seam is not called at all — no completion event, no ref code, per
   §2.6's ok-path-only rule.
4. On `{ ok: true }`: calls `deps.completer.completeCasualPlay({ ref:
   req.ref, templateId: CASUAL_TEMPLATE_ID, idempotencyKey:
   req.idempotencyKey })` (awaited — the response is not returned until
   this settles, so a caller's 200 is proof the completion was accepted
   and `shareRef` is the value the seam returned, not independently
   generated; §6 covers the exact idempotency contract) — **medium
   finding, fixed:** v1 called an unkeyed `issueCasualRef()` BEFORE the
   idempotent completion write, so a lost response between the two
   calls, followed by a retry, issued a SECOND persisted ref for the
   same logical play; `completeCasualPlay` is one call, keyed by
   `idempotencyKey` from the start, so a retry can only ever observe
   the SAME `shareRef` it got (or would have gotten) the first time.
   Projects `result` through the `CasualResultPayload` allowlist (§4.1)
   before returning `{ ok: true, result, shareRef }` — the full
   `ReconcileResult` never leaves this function.

**Transport policy (fixed — the r1 contradiction between §4 and V3 is
resolved to exactly this; the 400 body is now split in two, r4):**
- A `ref` present but not `null` and not matching `isRefCode` → **HTTP
  400** with the distinct flat body `{ error: "invalid-ref" }` (r4 —
  never the `EngineError`-shaped body below, so the client can guard
  the `ref-rejected` transition on this exact shape, per §3).
- Malformed JSON, or a request shape that fails structural validation
  for any OTHER reason (wrong array lengths, non-string tuple elements
  — including when a VALID ref is also present, §8 V12c) → **HTTP 400**
  with `{ ok: false, error: { kind: "malformed-decimal", detail: "..." } }`
  (the same `EngineError` shape, so the client has one error type to
  handle for every non-ref structural failure), returned **before**
  `handleCasualReconcile` is invoked — this is a transport-level
  rejection of a request the server cannot even attempt, not an engine
  outcome.
- A well-formed request that the **engine** rejects (e.g. a non-ascending
  tuple) → **HTTP 200** with `{ ok: false, error }` — engine-level
  rejection is not an HTTP error, it is a valid, expected response the
  client already has a screen for (§3's error-path transition).
- A well-formed request the engine accepts → **HTTP 200** with
  `{ ok: true, result, shareRef }`.

`src/routes/api/casual/reconcile/+server.ts`:
1. Parses the JSON body; a parse failure is the 400 case above.
2. Validates shape: `partyATuple`/`partyBTuple` are exactly
   4-element string arrays; `idempotencyKey` matches the UUID v4
   pattern (medium finding, fixed — v1 accepted any non-empty string,
   which the sibling data-core brief's `completeCasualPlay` stores in a
   `uuid`-typed column; a non-UUID string is now rejected at THIS
   boundary, before it can ever reach the seam or its idempotency
   check); and `ref` is **either `null` or a value for which
   `isRefCode(ref)` is `true`** (the shared ref-code authority,
   `src/lib/server/refCodes.ts` — the NEUTRAL location, seam contract
   v2, §1/§6 — `REF_CODE_REGEX = /^[a-z2-7]{10}$/`). **Invalid-ref
   policy, split (seam contract v2's fix for the r1 contradiction
   between "400 never null" and "becomes null"):** a `ref` that is
   PRESENT but fails `isRefCode` (wrong length/charset, an object, a
   string encoding tuple data) → **HTTP 400 with body `{ error:
   "invalid-ref" }`** (r4, addressing the r3 audit's medium finding —
   this exact, flat, machine-readable shape, distinct from every other
   400/200 body this route returns, so the client's `ref-rejected`
   transition (§3) can guard on the body's content rather than on
   status-plus-non-null-ref, which cannot tell an invalid-ref 400 apart
   from a malformed-tuple-shape 400 that also happens to carry a ref);
   `handleCasualReconcile` never invoked, neither the completer nor
   `reconcile` reached. A request that carries a VALID ref (passes
   `isRefCode`) alongside a SEPARATELY malformed field (e.g. a
   wrong-length tuple array) is **not** this case — it returns the
   ordinary structural-400 body (below), never `{ error: "invalid-ref"
   }`, and the stored ref must survive that path unchanged (§3's
   `transport-failed` transition, §8 V12c). A `ref` that is OMITTED or
   explicitly `null` → passes through as `null` and proceeds through
   `handleCasualReconcile` normally, which is the LEGITIMATE
   no-attribution case, never an error. The three are never conflated:
   a malformed ref alone is a client bug or a tampered URL (the
   distinct `invalid-ref` code); a valid ref alongside some other
   malformed field is an ordinary structural-400 that must not cost the
   ref; a null ref is an ordinary organic visit.
3. Calls `handleCasualReconcile` and returns its result verbatim as `200`
   JSON in both the `ok: true` and `ok: false` cases, per the policy
   above.

### 4.1 `CasualResultPayload` — an explicit allowlist, not the full `ReconcileResult`

**High finding, corrected.** The r1 draft returned the complete
`ReconcileResult` unfiltered and treated a non-empty-`FIELD_CLASSES`
assertion as proof of a deliberate decision; the audit correctly rejected
that — `FIELD_CLASSES`'s `internal-only` class exists precisely to keep
the developer audit trace (`layers`, `honesty`, `curves`, `hasComfortZone`,
`overlap`, `gap`) off any surface a viewer reaches, and casual's carve-out
under T2-product-surfaces §2.1/§6 R6 is scoped to *raw inputs and range
geometry for the reveal presentation*, not to the algorithm's internal
working.

`src/lib/server/casual/casualPayload.ts` defines the allowlist as an
explicit runtime projection — a fixed destructure-and-reassemble, never
a spread. **High finding of the r2 audit, corrected:** the r1 revision
claimed TypeScript's structural typing plus this `Pick`-shaped
interface "force a compile error... the moment a caller tries to pass
through anything not named here." That claim is false: `ReconcileResult`
is structurally assignable to `CasualResultPayload` (every field
`CasualResultPayload` names is present on `ReconcileResult` with a
compatible type), so a caller CAN write `return result as
CasualResultPayload` — or even, with a sufficiently permissive
signature, pass `result` through unchanged — without TypeScript
objecting; only the runtime tests below (V0a/V0b) actually catch a
regression. The boundary this brief relies on is the explicit
`const { ... } = result; return { ... };` destructure in
`buildCasualResultPayload`'s own body (below) PLUS those exact-key
runtime tests — not a compile-time guarantee, which this brief no
longer claims. A future hardening option, noted but not built here, is
an opaque brand on `CasualResultPayload` (a unique symbol field no
plain object literal or cast can supply) that would make an
accidental full pass-through a real type error — left as a documented
possibility, not a claim this revision makes:

```typescript
export interface CasualResultPayload {
  readonly zone: Zone;
  readonly fairPrice: PricePoint;
  readonly convergenceAchieved: boolean;
  readonly convergedTrivially: boolean;
  readonly meta: EngineVersionMeta;
  readonly distances: Readonly<Record<Role, PricePoint>>;
  readonly input: Readonly<Record<Role, { readonly tuple: VWTuple }>>;
  readonly dealLow: PricePoint;
  readonly dealHigh: PricePoint;
  readonly overlapLow: PricePoint;
  readonly overlapHigh: PricePoint;
}

export function buildCasualResultPayload(result: ReconcileResult): CasualResultPayload {
  const { zone, fairPrice, convergenceAchieved, convergedTrivially, meta,
    distances, input, dealLow, dealHigh, overlapLow, overlapHigh } = result;
  return { zone, fairPrice, convergenceAchieved, convergedTrivially, meta,
    distances, input, dealLow, dealHigh, overlapLow, overlapHigh };
}
```

**What's included and why, field by field:**
- `zone`, `fairPrice`, `convergenceAchieved`, `convergedTrivially`,
  `meta`, `distances` — already `per-party-safe` in `FIELD_CLASSES`;
  no carve-out needed, these are safe for any viewer in any mode.
- `input.low-preferring.tuple`, `input.high-preferring.tuple` — the
  documented **raw-inputs exception**. `FIELD_CLASSES` marks `input.*`
  `internal-only` as the general (invited/blind-mode) rule; casual is
  the enumerated exception that legitimately needs both parties' raw
  tuples, because R5/R6 require the client to be *able* to render them
  behind the `numbersShown` toggle (§5) — R6 governs when the UI shows
  them, not whether the server may ever compute them into this payload.
- `dealLow`, `dealHigh`, `overlapLow`, `overlapHigh` — the documented
  **range-geometry exception**, checked against T2-product-surfaces'
  actual reveal spec rather than assumed: `docs/design-brief.md`'s
  ruling describes the animation as "two ranges converging on a deal
  zone" and T2-product-surfaces §6 R6 permits "the both-range animation
  ... it encodes ranges." The deal-zone band the animation converges
  toward is these four numbers; without them the animation has no target
  to converge on and can only show each party's own tuple range (which
  `input.*` already gives it) with nothing to converge *toward*. This is
  the minimum numeric geometry the ruled presentation needs, not the
  engine's full audit trace.

**What's excluded and why:**
- `layers`, `honesty.low-preferring`, `honesty.high-preferring`,
  `curves` — **excluded.** These are `internal-only` algorithm/audit
  data (skewness/kurtosis honesty signals, per-method layer values, the
  joint-probability curve series) with no role in the ruled presentation.
  Checked specifically against `curves`: neither the design-brief ruling
  nor T2-product-surfaces' §2.6/§6 R6 text describes a probability-density
  curve render — "the maths is the motion" refers to the two-ranges-
  converging animation, which `input.*` plus the four deal/overlap
  numbers above fully support. No brief calls for rendering
  `CurvePoint[]`, so it stays excluded; if a future casual reveal design
  genuinely needs it, that is a new ruling, not a silent inclusion here.
- `hasComfortZone`, `overlap` — **excluded.** Both are `internal-only`
  booleans that duplicate information `zone` (already included, already
  per-party-safe) communicates to any UI consumer; no presentation
  requirement reads them directly.
- `gap` — **excluded.** Redundant with `distances` (already included) for
  any no-deal-zone messaging the reveal needs; including both an
  internal-only geometry field and the per-party-safe field that already
  covers the same ground would just be a second, unnecessary redaction
  surface to maintain.

**Negative tests** (in `casualPayload.test.ts`, run before
`casualReconcile.test.ts`'s V1/V2 so a regression here fails loudly and
close to the source):
- **V0a** — `Object.keys(buildCasualResultPayload(fixtureResult))` deep-
  equals exactly the eleven top-level keys named in `CasualResultPayload`
  above (`zone`, `fairPrice`, `convergenceAchieved`, `convergedTrivially`,
  `meta`, `distances`, `input`, `dealLow`, `dealHigh`, `overlapLow`,
  `overlapHigh`) — no more, no fewer.
- **V0b** — asserts `'layers' in payload`, `'honesty' in payload`,
  `'curves' in payload`, `'hasComfortZone' in payload`, `'overlap' in
  payload`, and `'gap' in payload` are all `false` against the same
  fixture. PASS: every excluded key absent.
- **V0c removed (high finding of the r2 audit).** The r1 revision's
  V0c asserted `CasualResultPayload` is "not structurally assignable
  from `ReconcileResult` without narrowing" — that assertion cannot
  pass, because it IS structurally assignable (every field
  `CasualResultPayload` names exists, compatibly typed, on
  `ReconcileResult`); TypeScript's structural type system has no way to
  reject a strict subset of an object's fields as "not assignable." A
  test asserting a false proposition either fails honestly or is
  written loosely enough to pass while proving nothing — neither is
  acceptable, so V0c is deleted outright rather than weakened. V0a/V0b's
  runtime exact-key checks are the real boundary (§4.1's revised
  framing above); an opaque brand is noted there as optional future
  hardening, not built or tested here.
- PASS: `npm run test:unit -- --run` includes V0a–V0b green (folded into
  §8's overall unit-test PASS criterion).

**`src/lib/server/refCodes.test.ts` (r4, new — see §6/§7):** a grammar
test asserting `isRefCode` returns `true` for a fixture matching
`REF_CODE_REGEX` and `false` for a fixture that does not (mirroring
`T3-m1-data-core`'s own `refCodes.test.ts`); when this brief lands
second, an additional byte-identity assertion that the file's on-disk
content deep-equals §6's pinned body verbatim.

T2-data-layer's payload constructor is not invoked: there is no stored
classified result for it to read (casual computes and returns in one
request), so `buildCasualResultPayload` is a second, narrower disclosure
point that this brief documents as the casual-mode exception to "the
payload constructor is the only egress" — legitimate under
T2-product-surfaces §2.1's carve-out, and now scoped exactly to what §5's
presentation requires rather than everything the engine happens to
compute.

## 5. UI presentation of R6 (hiding raw figures)

R6 is a **rendering** default layered on top of, not a substitute for,
the payload restriction (§4.1) — both apply: the server already excludes
audit-only fields (`layers`, `honesty`, `curves`, etc.) unconditionally,
and of what remains, `OutcomeReveal.svelte` receives the
`CasualResultPayload` and conditionally renders `result.input[role].tuple`
for each role only when local `numbersShown` is `true`. Default mount:
`numbersShown = false`. The convergence animation (both-ranges variant,
permitted in casual per the design-brief ruling) renders from
`result.dealLow`/`dealHigh`/`overlapLow`/`overlapHigh` regardless of
`numbersShown` — R6 conceals the four raw entry figures specifically, not
the range geometry (§4.1) the animation already encodes.

## 6. The cross-brief seam — binding orchestrator-ruled contract v2

**High finding of r1, corrected there; medium finding of r2, corrected
here.** The r1 draft's seams (a fire-and-forget `emit`, a sync
unpersisted `generate()`) were incompatible with the parallel data-core
draft. The r1→r2 revision's fix — a pair, `issueCasualRef` called
before the idempotent `recordCasualCompletion` — was STILL not
idempotent as a whole: a lost response between the two calls, followed
by a client retry, issued a SECOND persisted ref for the same logical
play, because the ref issuance itself carried no idempotency key. Seam
contract v2 (below) fixes this by collapsing the pair into one
transactional operation, keyed from the start. This section states the
**exact** v2 contract both this brief and the (separately revised)
data-core brief implement — quoted verbatim, so there is nothing left
to reconcile between them:

> `src/lib/server/refCodes.ts` (NEUTRAL location, directly under
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
> **Concurrency (r4, addressing the r3 audit's high finding on
> `completeCasualPlay`):** the operation serializes writers on the key
> by taking `pg_advisory_xact_lock(hashtextextended(idempotencyKey::text,
> 0))` at the top of its single transaction, so two concurrent FIRST
> calls for the same `idempotencyKey` never race the unique index — the
> second blocks on the lock until the first commits, then its own
> idempotency read finds the just-committed row and returns THAT row's
> value rather than attempting a second insert. If a unique-index
> conflict is nonetheless observed (belt-and-braces, e.g. a caller that
> bypassed the lock), the function re-reads by `idempotencyKey` and
> returns the winning row's value rather than raising — every caller,
> first or concurrent, resolves to the SAME value. That replay read is
> admitted by its own narrow, role-scoped RLS policy (a
> `casual_writer`-scoped SELECT on `events`, restricted to
> `session_id is null and event_type = 'reconciliation_completed'`),
> never a wider grant. The value returned on ANY replay — first call,
> lock-waiter, or conflict-recovery — is always the persisted event
> row's `payload ->> 'share_ref'` field, **never** the inbound
> `ref_code` (the two are distinct: `ref_code` is the caller's
> attribution input, `share_ref` is this operation's own minted output,
> and a replay must never substitute one for the other). A rejected
> transport call does NOT prove the underlying transaction never
> committed — it may still have been in flight, or committed with the
> response lost before the caller observed it; the seam's outcome after
> a transport failure is **UNKNOWN**, never assumed "not committed,"
> which is exactly why every retry — sequential or concurrent — must
> carry the SAME `idempotencyKey` rather than minting a fresh one.
> Casual's V16 gains a concurrent-call case in addition to its existing
> sequential-retry case: two callers fire `completeCasualPlay` with the
> SAME `idempotencyKey` at the same time; both must resolve to the SAME
> `shareRef`, matching the persisted ref and event payload, and exactly
> one event row and one `share_refs` row must exist afterward.
>
> Invalid-ref policy, everywhere in both briefs: a present-but-malformed
> `ref` (fails `isRefCode`) → HTTP 400 with the distinct, flat,
> machine-readable body `{ error: "invalid-ref" }` (r4, addressing the
> r3 audit's medium finding), never null-coercion; `ref: null`/absent is
> legitimate and proceeds. The casual client's distinct transition for
> that 400 guards on this exact body — never on "status 400 plus a
> non-null stored ref," which cannot distinguish an invalid-ref 400 from
> some other structural 400 that happens to also carry a valid ref —
> and DISCARDS the stored ref, retrying without it. A request carrying a
> VALID ref alongside a separately malformed field enters the ordinary
> transport-error path with the ref intact, never the ref-rejected one
> (a dedicated negative test, per brief). V10 is split into malformed
> (400 `{ error: "invalid-ref" }`, zero seam calls), valid-ref-plus-
> malformed-field (400, ordinary `EngineError` body, ref discarded by
> neither transition), and legitimate-null (proceeds, seam called)
> cases.
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

This brief gets the real `completeCasualPlay` interface plus a local,
self-executing stand-in so it ships without waiting on
`T3-m1-data-core`'s landing order. The interface is **async** (matching
data-core's persisted implementation exactly — no sync/async mismatch
to paper over at wiring time) and lives in
`src/lib/server/casual/casualCompletionSeam.ts`:

```typescript
export interface CasualPlayCompleter {
  completeCasualPlay(input: {
    ref: RefCode | null;
    templateId: string;
    idempotencyKey: string;
  }): Promise<{ shareRef: RefCode }>;
}
```

**6.1 Stand-in — `inMemoryCasualPlayCompleter`.** An in-process
`Map<idempotencyKey, RefCode>` guarding both the ref-mint and a
`console.info` of the completion event (`templateId`, `occurredAt:
new Date().toISOString()`, `ref`), so the endpoint is fully testable
and demoable, AND so the WHOLE-OPERATION idempotency behaviour
(replaying an `idempotencyKey` returns the identical `shareRef` from
the Map rather than minting a new one) is real and testable now, not
deferred to integration time — this is the exact shape seam contract
v2 requires: first call mints a fresh `RefCode`, checks it is not
already a Map value (collision-checked, not merely generated and
forgotten), stores `idempotencyKey -> shareRef`, and returns it; every
subsequent call with the SAME `idempotencyKey` returns the stored value
without touching the ref-minting path at all. Satisfies T2-data-layer
§2.6 ("casual sessions... the only persisted trace is an anonymous
completion event") and §2.8 ("casual sessions store no price data at
all") for the stand-in's own scope; `T3-m1-data-core`'s output is the
durable, cross-process, transactional implementation behind the same
`completeCasualPlay` signature.

**Wiring — a one-line import swap, not a redesign.** Whichever brief
lands second replaces `inMemoryCasualPlayCompleter` with data-core's
implementation in `src/routes/api/casual/reconcile/+server.ts`'s
constructor call; `handleCasualReconcile`'s signature (§4) never
changes, because both the stand-in and the real implementation satisfy
the same `CasualPlayCompleter` interface.

**Two-stage Done condition (fixes the r1 gap — wiring was excluded from
Done with no owner; r2 adds the rate-limit blocker):**
1. **Stage 1 (this brief, M1 item 4 partial):** `handleCasualReconcile`
   works end-to-end against the in-memory stand-in; §8's V1–V9 (plus
   V10–V15) pass against it.
2. **Stage 2 (required before M1 item 4 is marked Done, owned by
   whichever of this brief/`T3-m1-data-core` lands second):**
   - **V16 — end-to-end wiring test** (`casualReconcileWiring.e2e.ts` or
     equivalent) against the REAL `completeCasualPlay` (data-core's
     transactional implementation, not the stand-in), simulating
     response-loss-after-commit (the transaction commits, but the
     caller never observes the response — e.g. kill the connection
     immediately after the seam's promise resolves, before the route
     returns): a retried call with the SAME `idempotencyKey` returns
     the IDENTICAL `shareRef`, and exactly one completion event row and
     one `share_refs` row exist afterward — never two of either.
   - **V16b (r4, new)** — the concurrent-call case (§8): both calls
     resolve to the same `shareRef`, matching the persisted event
     payload's `share_ref` field, with exactly one event and one
     `share_refs` row. Stage 2 is not complete until V16 AND V16b both
     pass, not V16 alone.
   - **Rate-limit wiring** (medium finding, new): the casual route must
     be re-pointed through T2-agent-distribution's capability-catalogue
     dispatcher and its shared `compute` rate-limit budget (§2's
     `CASUAL_RECONCILE_CAPABILITY.rateLimitClass`) once the M1
     agent-doorway brief lands — T2-agent-distribution grants casual NO
     exemption from cross-adapter budget sharing. This is named here as
     an explicit M1 blocker owned by the doorway brief, not a silent
     "later," and Stage 2 is not complete until it is verified wired.
   Until BOTH of these land, M1 item 4's landing-event requirement is
   **not** satisfied by this brief alone.

**Inbound ref capture (fixed r4 — this note previously named the wrong
file; §7 was always correct):** `src/routes/+page.ts`'s `load` reads
`url.searchParams.get('ref')` and threads it as a prop into
`+page.svelte`, which mounts `CasualFlow.svelte` with it; `CasualFlow`
carries it unmodified (not user-editable, per T2-product-surfaces §3.1)
into the `POST` body's `ref` field at the `b-submit` transition; the
route (§4) is what actually validates it against `isRefCode` before it
reaches `handleCasualReconcile`.

**`refCodes.ts` pinned verbatim, shared-file ownership (r4, addressing
the r3 audit's medium finding — the "pinned verbatim in both briefs"
claim in prior revisions was false; only `T3-m1-data-core` actually
carried the body).** The exact module body, copied verbatim from
`T3-m1-data-core` §2.8 so both briefs implement byte-identical content:
```typescript
declare const refCodeBrand: unique symbol;
export type RefCode = string & { readonly [refCodeBrand]: 'RefCode' };
export const REF_CODE_REGEX = /^[a-z2-7]{10}$/;
export function isRefCode(x: unknown): x is RefCode {
	return typeof x === 'string' && REF_CODE_REGEX.test(x);
}
```
Landing-order instructions (unchanged from §1/seam contract v2, restated
here since the file is now listed in §7): whichever of this brief and
`T3-m1-data-core` lands FIRST creates `src/lib/server/refCodes.ts` with
exactly this body; whichever lands SECOND does not recreate it — it
reads the file and asserts byte-identity against the body above before
writing anything that imports it. `refCodes.test.ts` (§7, §8) covers
both directions: a grammar test (`REF_CODE_REGEX`/`isRefCode` against a
valid and an invalid sample, matching data-core's own `refCodes.test.ts`
assertion) and, when this brief lands second, a byte-identity check
(the file's on-disk content deep-equals the body above, verbatim,
whitespace included) run once at the top of this brief's own test
setup — a mismatch here is a STOP-and-report condition, not a silent
overwrite.

## 7. Component breakdown (files to create)

- `src/lib/server/refCodes.ts` — **shared with `T3-m1-data-core`, r4
  addition (this was omitted from this brief's own file list in every
  prior revision, per the r3 audit's medium finding)**. §6's verbatim
  body; this brief CREATES it if it lands first, or VERIFIES
  byte-identity against `T3-m1-data-core`'s copy if it lands second —
  never a second, independently-authored copy. `refCodes.test.ts`
  alongside it covers the grammar check (and the byte-identity check
  when landing second), per §6/§8.
- `src/lib/client/casual/casualTemplate.ts` — the M1 casual template as a
  static config object matching the shape T2-product-surfaces §2.5
  defines for templates generally (four question texts, party labels,
  directional mapping, currency default), hardcoded rather than loaded
  from a template system (custom template authoring is explicitly bound
  architecture for a later milestone, not M1 — T2-product-surfaces §3.7).
  The four questions are the canonical Van Westendorp set in ascending
  order — too-cheap, bargain, expensive, too-expensive — mapped to
  `Role`: Party A = `"low-preferring"`, Party B = `"high-preferring"`.
  `CASUAL_TEMPLATE_ID` is exported from here and reused in §4 step 4.
- `src/lib/client/casual/CasualFlow.svelte` — the state machine (§3);
  owns both tuples and the response in local state; renders exactly one
  of the child components below per current state.
- `src/lib/client/casual/PartyEntry.svelte` — the four-point meter entry,
  reused for both A and B via a `role` prop; client-side validation
  mirrors the engine's grammar/ascending rule for UX responsiveness only
  (§4's server call remains the sole authority — a client-side pass does
  not replace the `EngineError` handling path in §3's error transition).
- `src/lib/client/casual/ConfirmHideInterstitial.svelte` — renders after
  `a-submit`; confirms "you entered 4 prices," never echoes the values.
- `src/lib/client/casual/HandoverInterstitial.svelte` — "pass the phone
  to [Party B label]" prompt with a single continue control.
- `src/lib/client/casual/BothLookInterstitial.svelte` — "both of you look
  now" gate; shows a computing affordance while the fetch is pending;
  its continue control is disabled until `outcome-received` with
  `ok: true` (§3's guard table).
- `src/lib/client/casual/TransportErrorInterstitial.svelte` — renders on
  `transport-error` (§3's `transport-failed` transition); a plain "that
  didn't go through" message with a `retry` control (re-fires the POST
  with the same `idempotencyKey`) and a `give-up` control (return to
  `idle`); renders neither party's tuple.
- `src/lib/client/casual/OutcomeReveal.svelte` — the reveal screen (§5);
  renders zone/fair-price/animation unconditionally, raw tuples behind
  `numbersShown`.
- `src/lib/client/casual/ResultCard.svelte` — the shareable card:
  zone/fair-price summary, no raw figures ever (independent of
  `numbersShown` — the card is what leaves the device), and the share
  URL built as `${origin}/?ref=${shareRef}`.
- `src/lib/server/casual/casualPayload.ts` — §4.1's `CasualResultPayload`
  allowlist type and `buildCasualResultPayload` projection.
- `src/lib/server/casual/casualReconcile.ts` — §4's orchestration.
- `src/lib/server/casual/casualCompletionSeam.ts` — §6's
  `CasualPlayCompleter` interface plus the `inMemoryCasualPlayCompleter`
  stand-in.
- `src/routes/api/casual/reconcile/+server.ts` — §2's same-origin UI
  adapter: JSON parse, shape/ref validation (§4), calls
  `handleCasualReconcile`.
- `src/routes/+page.svelte` — modified (not created): hero content per
  the design brief, mounts `CasualFlow` with the captured `ref` prop.
- `src/routes/+page.ts` — new `load` reading `url.searchParams` for the
  inbound ref (universal load, no server-only data needed here).

## 8. Verification (mechanical pass criteria)

**Unit (Vitest, `server` project) — `src/lib/server/casual/casualPayload.test.ts`:**
V0a–V0b per §4.1's negative-test spec.

**Unit (Vitest, `server` project) — `src/lib/server/casual/casualReconcile.test.ts`:**
- **V1** — a valid comfort-zone pair (any T3-m1-engine-port golden
  fixture tuple, reused verbatim) plus a fresh `idempotencyKey` returns
  `{ ok: true, result, shareRef }` where `result` deep-equals
  `buildCasualResultPayload(reconcile(...))` for the same inputs (§4.1 —
  NOT the raw `ReconcileResult`), `shareRef` matches `REF_CODE_REGEX`,
  the stub `CasualPlayCompleter`'s `completeCasualPlay` was called
  exactly once with `templateId === CASUAL_TEMPLATE_ID`, the
  passed-through `ref`, and the same `idempotencyKey`.
- **V1b (medium finding, replay)** — the same `idempotencyKey` is
  submitted a second time (same tuples): `completeCasualPlay` is called
  again but the stand-in's Map returns the SAME `shareRef` as V1
  without minting a new one; asserts the response's `shareRef` is
  byte-identical across both calls.
- **V2** — an invalid pair (e.g. a non-ascending tuple) returns
  `{ ok: false, error }` with `error.kind` matching the engine's own
  classification, and `completeCasualPlay` was called zero times.
- **V3** — the `+server.ts` route: a well-formed request with a
  non-ascending tuple (an **engine**-level rejection) returns **HTTP
  200** with `{ ok: false, error }` (§4's transport policy). PASS
  criterion corrected from r1, which required HTTP 200 here while §4
  simultaneously required 400 for the same case — that contradiction is
  now resolved: 400 is reserved for malformed/malshaped requests (V10
  below), 200 for every engine outcome including rejection.
- **V10 (high finding, ref boundary — split per seam contract v2 into
  malformed vs. legitimate-null, exactly as the contract specifies; body
  shape and the new valid-ref-plus-malformed-field case corrected r4 per
  the r3 audit's medium finding)** — four sub-cases against the
  `+server.ts` route:
  - **Malformed (400, `{ error: "invalid-ref" }`, zero seam calls):** a
    request body with `ref` set to a string of the wrong length or
    charset (e.g. `"abc123"`, which is neither 10 characters nor
    restricted to `[a-z2-7]`) → **HTTP 400** with body deep-equal to
    `{ error: "invalid-ref" }`; `CasualPlayCompleter.completeCasualPlay`
    called zero times (spy assertion).
  - **Malformed (400, `{ error: "invalid-ref" }`, zero seam calls):** a
    request body with `ref` set to a JSON object or array encoding
    tuple-shaped data (an attempted smuggling case the finding named
    explicitly) → **HTTP 400** with the same `{ error: "invalid-ref" }`
    body; `completeCasualPlay` called zero times.
  - **Legitimate-null (proceeds, seam called):** a request body with
    `ref` omitted or explicitly `null` → passes through as `null` and
    reaches `handleCasualReconcile` normally on a valid tuple pair;
    `completeCasualPlay` IS called exactly once with `ref: null` —
    asserting the legitimate no-ref path still works and is never
    conflated with the malformed cases above.
  - **V10d (r4, new — valid ref plus a separately malformed field, the
    r3 audit's named risk):** a request body with a VALID `ref` (passes
    `isRefCode`) but a wrong-length `partyATuple` array → **HTTP 400**
    with the ORDINARY `{ ok: false, error: { kind: "malformed-decimal",
    ... } }` body, NOT `{ error: "invalid-ref" }`; `completeCasualPlay`
    called zero times. This is the regression test for the r3 finding:
    a client guarding on "400 + non-null ref" alone would misclassify
    this case as `ref-rejected` and silently discard a valid ref;
    asserting the body shape here proves the distinction is
    load-bearing, not cosmetic.
  PASS: the two `invalid-ref` sub-cases and V10d all return 400 before
  `handleCasualReconcile` is invoked at all, with the two DIFFERENT body
  shapes correctly distinguished; the null sub-case proceeds normally.
- **V11 (medium finding, transport-failure and malformed-JSON split)** —
  malformed JSON body (unparseable) and a wrong-length tuple array both
  return **HTTP 400** with `{ ok: false, error: { kind:
  "malformed-decimal", ... } }`, distinguished from V3's 200 case by
  request shape, not by response shape (both are the same `EngineError`
  shape, per §4's "one error type to handle" design) — the assertion
  distinguishing them is on the HTTP status code, not the body.
- PASS: `npm run test:unit -- --run` exits 0, V0a–V0b, V1–V3, V10
  (including V10d), V11, and `refCodes.test.ts` all named and green.

**E2E (Playwright) — `tests/e2e/casual-flow.e2e.ts`:**
- **V4 (DoD item 9, figures hidden)** — drive the flow through
  `party-a-entry` with a fixed tuple, submit, and at each of
  `a-confirm-hide`, `handover`, `party-b-entry`, `both-look-now` assert
  (via `page.content()` or the accessibility tree) that none of A's four
  entered strings appear anywhere in the rendered DOM. PASS: zero matches
  at all four checkpoints.
- **V5 (DoD item 9, B cannot reveal)** — during `party-b-entry`, assert
  no interactive element (button, link, disclosure) exists whose
  accessible name references "Party A" values or a reveal/show action;
  only `PartyEntry` controls for B are present. PASS: no such element
  found.
- **V6 (DoD item 9, outcome only at both-look)** — assert the reveal
  screen's DOM markers (fair-price text, zone label, `ResultCard`) are
  absent while state is `both-look-now`, and present only after the
  `continue` transition fires. PASS: absence then presence, in that
  order, asserted at both checkpoints.
- **V7 (R6, numbers hidden by default)** — on entering `reveal`, assert
  A's and B's four entered figures are absent from the DOM; click the
  "show the numbers" control; assert all eight values are now present.
  PASS: absent, then present after the click.
- **V8 (DoD item 2, sub-60-second completion)** — start a timer at the
  `start` transition (test harness reads the same clock semantics as
  §3's table — first interaction to `reveal`), drive a complete
  A→B→reveal run with realistic (not artificially fast) input actions,
  assert elapsed time `< 60_000` ms. PASS: elapsed time under the
  threshold. **VERIFY AT EXECUTION:** confirm this is a meaningful
  measurement under CI's actual latency (local dev server + real
  `fetch` to `/api/casual/reconcile`, no network mocking) before trusting
  it as a DoD gate — if CI environment overhead makes 60s an unreliable
  bound, flag rather than loosen it silently.
- **V9 (ref propagation)** — load `/?ref=abcd234efg` — **VERIFY AT
  EXECUTION:** substitute an actual `REF_CODE_REGEX`-valid 10-character
  fixture (`[a-z2-7]{10}`) once `refCodes.ts` lands; the exact string
  here is illustrative, not pinned — complete the flow, assert the
  `POST /api/casual/reconcile` request body's `ref` field equals the
  fixture (via `page.on('request')` body inspection), and that the
  rendered `ResultCard` share URL contains a **different** ref
  (`shareRef`, freshly generated) rather than echoing the inbound one.
  PASS: both assertions hold.
- **V12 (medium finding, transport-failure transition)** — force a
  `fetch` failure at `b-submit` (route the request to a 500 or abort the
  connection via Playwright's request interception), assert the UI
  reaches `transport-error` (via `TransportErrorInterstitial`'s DOM
  markers), assert neither party's tuple appears in the DOM (same check
  as V4), click `retry` with the interception removed, assert the flow
  reaches `reveal` normally, and assert (via `page.on('request')` body
  inspection on both attempts) the `idempotencyKey` field is **identical**
  across the failed attempt and the retry. PASS: transport-error reached,
  no figures leaked, retry succeeds, key unchanged across the retry.
- **V12b (medium finding, ref-rejected auto-retry — distinct from
  V12's generic transport failure; body assertion corrected r4)** —
  load `/?ref=abc123` (a malformed ref: wrong length/charset), complete
  the flow to `b-submit`; assert the FIRST `POST` carries `ref:
  "abc123"` and receives **HTTP 400 with body deep-equal to
  `{ error: "invalid-ref" }`** (the guard the client's `ref-rejected`
  transition actually checks, per §3/§4, r4 — not merely "status
  400"); assert the UI does NOT show
  `TransportErrorInterstitial` at any point (the `ref-rejected`
  transition, §3, is silent/automatic, never surfaced as an error);
  assert a SECOND `POST` fires automatically with the same
  `idempotencyKey` and `ref: null`; assert the flow reaches `reveal`
  normally from that second call. PASS: no error screen shown, exactly
  two requests observed, the second succeeds with `ref: null` — proving
  a corrupted/tampered inbound ref never traps the pair (the finding's
  named risk).
- **V13 (mobile viewport)** — repeat V4–V7's core assertions (figures
  hidden through handover, numbers-hidden-by-default, show-the-numbers
  reveal) at a 375×812 mobile viewport (T2-product-surfaces §2.7
  "mobile-responsive from the first screen"). PASS: same disclosure
  guarantees hold at mobile width; no horizontally-clipped or
  off-screen interactive control blocks a transition.
- **V14 (medium finding, accessibility)** — automated: run an
  axe-core (or equivalent, per whatever the scaffold's Playwright config
  already integrates — **VERIFY AT EXECUTION**) WCAG 2.1 AA scan at
  each of `party-a-entry`, `both-look-now`, and `reveal` (with
  `numbersShown` both `false` and `true`); zero violations at the
  configured severity threshold. Manual: the neumorphic-contrast audit
  T2-product-surfaces §2.7/§4 requires on the soft-shadow meter controls
  is recorded as a **VERIFY AT EXECUTION** manual sign-off gate (not
  mechanically testable — a human checks rendered contrast against WCAG
  2.1 AA on the actual neumorphic surfaces) and is a precondition of
  Done alongside the automated scan, not a substitute for it.
- **V15 (medium finding, precision round-trip)** — enter a 4-decimal-
  place tuple for both A and B (e.g. `12.3456`, `18.7891`, `24.1234`,
  `31.5678` — VERIFY AT EXECUTION against `casualTemplate.ts`'s actual
  domain bounds); complete the flow to `reveal`; assert the underlying
  stored/returned tuple values are unchanged at 4 d.p. through
  reconciliation (via the POST body echoing back in `result.input`, per
  §4.1's allowlist including `input.*`); toggle `numbersShown`; assert
  all eight displayed values still carry the full 4 d.p. (T2-product-
  surfaces §2.8/§4 "precision is presentation-transformed, never lost").
  PASS: entry, reconciliation, hidden-default, and shown states all
  preserve the 4 d.p. values unchanged.
- PASS overall: `npm run test:e2e` exits 0 with V4–V9 and V12–V15
  (including V12b) all green.

**Stage-2 wiring and rate-limit tests (§6's two-stage Done condition,
run once `T3-m1-data-core`/the M1 agent-doorway brief land — not part
of this brief's own PASS gate but named blockers on M1 item 4 being
marked Done):**
- **V16** — `casualReconcileWiring.e2e.ts` (or equivalent) against the
  REAL `completeCasualPlay` (data-core's transactional implementation):
  simulates response-loss-after-commit (kill the connection right after
  the seam's promise resolves, before the route returns) and asserts a
  retried call with the same `idempotencyKey` returns the IDENTICAL
  `shareRef`, with exactly one persisted completion event and one
  `share_refs` row — never two of either.
- **V16b (r4, new — the r3 audit's high finding: sequential retry alone
  does not cover overlapping first calls)** — same fixture, but fires
  TWO `completeCasualPlay` calls concurrently with the SAME
  `idempotencyKey` (no sequencing between them — e.g. `Promise.all`
  against two separate connections) instead of one call followed by a
  retry: asserts BOTH calls resolve to the SAME `shareRef`, that value
  matches the persisted event row's `payload ->> 'share_ref'` (never the
  inbound `ref_code`), and exactly one event row and one `share_refs`
  row exist afterward — proving the advisory-lock/conflict-re-read
  mechanism (§6) actually serializes concurrent first-callers rather
  than letting one win the unique-index race and the other error.
- **V17 (medium finding, rate-limit wiring — owned by the M1
  agent-doorway brief, tracked here as a named blocker)** — once that
  brief lands, a test asserting the casual route's requests are
  actually counted against T2-agent-distribution's shared `compute`
  budget (a burst of requests exceeding the budget is throttled
  identically whether it originates from this route or another
  catalogue adapter sharing the same budget) — proving the "no
  exemption" rule is wired, not merely declared in §2's
  `CASUAL_RECONCILE_CAPABILITY`.

## 9. Out of scope (do not touch)

- Invited or survey mode UI, session lifecycle, invites, credits — none
  of this route touches `src/lib/server/data/` tables or any
  authorisation matrix; casual has no lifecycle at all
  (T2-product-surfaces §2.2 "Casual: no lifecycle at all").
- The consumer-toy branded template and viral campaign surface (M3,
  M1-working-instrument §3) — this brief's template is the generic
  placeholder config (§7), not the toy.
- Custom template authoring (bound architecture, later milestone,
  T2-product-surfaces §3.7).
- The real `completeCasualPlay` implementation (`T3-m1-data-core`'s
  output) — this brief only declares and stubs the seam (§6) against
  the binding contract; wiring it is §6's Stage 2, explicitly tracked,
  not silently deferred.
- The MCP/HTTP agent-doorway adapter itself (T2-agent-distribution) —
  this brief only shapes `handleCasualReconcile` (§4) as the shared
  capability contract (§2) so that a later doorway brief can wrap it
  without a redesign (§2's justification point 2).
- Recruitment host visibility and any host-visible session flow
  (T2-product-surfaces §7 R7/§9 R11, T1 Addendum 7) — casual is the
  full-detail exception this brief implements; host-visible verticals
  are a separate, invited-mode exception this brief does not touch,
  extend, or generalise toward.
- Vertical demo walkthroughs (T2-product-surfaces §7 R8) — architecture
  bound elsewhere, no shipping milestone assigned to M1; this brief's
  casual flow is not a demo scaffold to be repurposed for it.
- Any change to `src/lib/server/engine/**` (T3-m1-engine-port's contract
  is consumed, never modified) or to `docs/design-brief.md`,
  `planning/`, `reference/`, `CLAUDE.md`.

## 10. Deviations and judgement calls (binding)

- **D1 — API route over form action.** §2's justification; the design
  language and multi-screen choreography make an AJAX-style JSON
  endpoint the better fit than SvelteKit's form-action idiom, at the cost
  of writing manual `fetch` calls in `CasualFlow.svelte` instead of
  `use:enhance`.
- **D2 — casual bypasses the T2-data-layer payload constructor.** §4.1;
  legitimate under T2-product-surfaces §2.1's own full-detail carve-out,
  but recorded because it is the one place this brief's disclosure path
  differs from every other session shape's. **Revised r1→r2:** the
  carve-out is now scoped by the explicit `CasualResultPayload` allowlist
  (§4.1), not "return everything" — the deviation is bypassing the
  constructor's *mechanism*, not its *discipline*.
- **D3 — outbound ref codes now persist, format is pinned, issuance is
  folded into one transactional operation (§6).** Superseding r1's
  "unpersisted, format-unverified" version (which the r1 audit's high
  finding correctly rejected) and r1→r2's separately-called
  `issueCasualRef` (which the r2 audit's medium finding correctly
  rejected as non-idempotent-as-a-pair): `completeCasualPlay` persists
  the ref as part of the SAME transaction that records the completion,
  per seam contract v2; the format (`REF_CODE_REGEX =
  /^[a-z2-7]{10}$/`) is pinned by `src/lib/server/refCodes.ts` — the
  NEUTRAL, non-data-core-owned location (r2's other high finding) — the
  single ref-code authority, not chosen independently by this brief.
- **D4 — hardcoded M1 casual template, not the template system.** §7;
  matches the *shape* T2-product-surfaces §2.5 defines for templates so
  a later swap to the real system is a data change, not a redesign.
- **D5 (new, r2) — `CasualResultPayload` includes `dealLow`/`dealHigh`/
  `overlapLow`/`overlapHigh` as range geometry, excludes `curves`.**
  §4.1; a judgement call made by checking the actual reveal spec
  (design-brief's "two ranges converging on a deal zone," T2-product-
  surfaces §6 R6) rather than assuming either "casual gets everything"
  (r1's error) or "casual gets only raw inputs" (an equally unverified
  narrower guess): the animation needs a deal-zone target to converge
  toward, which only those four fields supply; it does not need the
  joint-probability curve series, which no cited spec describes
  rendering. If a future casual reveal design wants curve-based
  visualisation, that is a new ruling to extend the allowlist, not a
  retroactive justification for having shipped it here.
- **D6 (new, r2) — the endpoint is a UI adapter over a named shared
  capability, not an independent public capability.** §2; resolves the
  medium finding by naming `handleCasualReconcile` as the function both
  this route and the future MCP/HTTP catalogue adapters call, with the
  catalogue entry's shape (auth tier, rate-limit class, payload class)
  declared here as a dependency, not built here.
- **D7 (new, r2) — the compile-time payload-boundary claim (V0c) is
  withdrawn, not replaced with a weaker version.** §4.1/§6; the r2
  audit showed the claim was false (structural typing makes
  `CasualResultPayload` assignable from `ReconcileResult`), so rather
  than soften the assertion into something that trivially passes, this
  revision removes it and relies solely on the runtime exact-key tests
  (V0a/V0b) — an opaque brand is noted as optional future hardening,
  a decision for a later revision to make deliberately, not a claim
  smuggled in now.
- **D8 (new, r2) — the two v1 seams collapse into one
  `completeCasualPlay` operation.** §6; a pair of calls cannot be made
  idempotent as a unit without either a distributed lock (unavailable
  to a stateless route) or collapsing them into a single keyed
  transaction — this brief and its sibling take the latter, simpler
  path, which is why Stage 2's Done condition now names a
  response-loss-after-commit test (V16) rather than two separate
  idempotency tests.

## 11. Open questions (HITL)

- **Q1 — casual copy, labels, and currency default (narrowed per the low
  finding).** M1's item 4 says "casual mode on the landing page" but does
  not name a template, and the consumer-toy template is explicitly
  M3-scoped (M1-working-instrument §3). This brief defaults to a
  generic, unbranded two-party pricing template (§7, D4) purely to make
  the brief executable — copy register, party labels, and currency
  default are placeholders pending an operator or business-side ruling
  on what the free homepage demo is actually *about* before real users
  see it. **Explicitly not this question's scope** (r1's wording read as
  broader than intended, since it predated rather than conflicted with
  the 7 Sep host-visible rulings): recruitment host visibility, the
  guided-demo concept, and any vertical-specific template configuration
  (T2-product-surfaces §7 R7–R10/§9 R11, T1 Addendum 7) are settled
  elsewhere and are not reopened by this brief's placeholder choice.
  Leaning: ship the generic placeholder for M1, restyle to the toy
  template's copy when M3's viral campaign work lands (no schema/engine
  change either way).

## 12. Capture and commit

Verify §8's V0a–V0b, V1–V3, V10–V15 all pass (this brief's own Stage 1
gate; V16 is Stage 2, tracked separately per §6 and not required for this
brief's own commit). Then capture via the apv-capture skill
(`exfu-agent-plan-visualiser:apv-capture`; `/apv-capture` is its
Claude-Code alias — read the skill source directly if the alias is
absent, per `CLAUDE.md`) against THIS plan id, recording
`verification.tested` with every V-number by result, and commit:

`feat(casual): homepage blind-handover flow with stateless server reconciliation`

If any of V4–V7 (the disclosure-safety checks) fails, STOP — do not ship
a passing build with a figures-leak; capture as blocked with the exact
failing assertion and screen state, and report. A disclosure-safety
failure here is a T1 §2.1 violation, not a cosmetic bug.
