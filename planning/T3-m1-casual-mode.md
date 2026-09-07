---
id: T3-m1-casual-mode
plan_kind: thematic
tier: 3
t2_parent: T2-product-surfaces
milestone: M1-working-instrument
status: draft
---

# T3 — M1 casual mode: the homepage instrument

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
> declares the two seams it needs from the data layer (§2.6) and ships
> self-executable stand-ins so it does not wait on landing order.

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
- Disclosure ruling this brief implements exactly, no more: casual is the
  **sole** T1 §2.1 exception — one device transiently holds both parties'
  tuples client-side (T2-product-surfaces §6 R5's honest note: this is
  UX-enforced etiquette, not cryptographic blindness). Nothing entered is
  **persisted** server-side under any outcome (T2-data-layer §2.8: casual
  sessions store no price data at all — the only persisted trace is the
  anonymous completion event, §2.6).

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
3. The endpoint performs no I/O beyond the pure engine call and the two
   seam calls (§2.6) — it never reads or writes `src/lib/server/data/`
   session tables, so it carries none of form actions' session/CSRF
   machinery that exists for stateful mutations.
- The endpoint takes no cookies, issues no session, and is safe to call
  repeatedly (idempotent modulo the completion-event and ref-generation
  side effects, §2.6, which are themselves idempotent-safe per their
  seam contracts).

## 3. Client state machine (exact states and transitions)

Owned by `src/lib/client/casual/CasualFlow.svelte`. All state is
in-memory Svelte state (`$state` runes) — never `localStorage`,
`sessionStorage`, nor any store with persistence middleware; a page
reload loses everything, which is correct (nothing must survive past the
tab).

**States:** `idle` · `party-a-entry` · `a-confirm-hide` · `handover` ·
`party-b-entry` · `both-look-now` · `reveal`.

**Transitions** (event, guard, from → to, side effect):

| Event | Guard | From → To | Side effect |
|---|---|---|---|
| `start` | — | `idle` → `party-a-entry` | start the elapsed-time clock (§5 V-e2e-1) |
| `a-submit` | tuple is 4 strictly-ascending values per `casualTemplate.ts`'s client-side mirror of the engine grammar (§2.3 note) | `party-a-entry` → `a-confirm-hide` | store A's tuple in component state only |
| `a-confirm` | — | `a-confirm-hide` → `handover` | none (A's entries stop being rendered anywhere from this point until `reveal` with `numbersShown`) |
| `handover-ready` | — | `handover` → `party-b-entry` | none |
| `b-submit` | tuple valid per the same client mirror | `party-b-entry` → `both-look-now` | fire `POST /api/casual/reconcile` (§4) immediately; store the pending promise, do not await it before the transition |
| `outcome-received` | response resolved (ok or error) | `both-look-now` → `both-look-now` (internal) | store `CasualReconcileResponse` in state; does not by itself advance the screen |
| `continue` | `outcome-received` has occurred AND response was `ok: true` | `both-look-now` → `reveal` | stop the elapsed-time clock |
| `continue` (error path) | response was `ok: false` | `both-look-now` → `party-b-entry` | surface the engine's `error.detail` as an inline correction message on B's entry screen; A's tuple is retained in memory unchanged |
| `toggle-numbers` | in `reveal` | `reveal` → `reveal` | flips local `numbersShown` boolean, default `false` (R6) |
| `restart` | in `reveal` | `reveal` → `idle` | clears both tuples and the response from memory |

Two hard invariants the component tests assert (§5):
1. **No template, prop, or DOM node ever renders A's tuple values during
   `handover`, `party-b-entry`, or `both-look-now`** — this is the
   mechanical form of DoD item 9's "A's figures hidden before handover"
   and "B cannot reveal them" (there is no control in any of those three
   states that reads A's stored tuple).
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
export interface CasualReconcileRequest {
  partyATuple: readonly [string, string, string, string];
  partyBTuple: readonly [string, string, string, string];
  ref: string | null; // inbound attribution ref, §2.6
}

export type CasualReconcileResponse =
  | { ok: true; result: ReconcileResult; shareRef: string }
  | { ok: false; error: EngineError };

export function handleCasualReconcile(
  req: CasualReconcileRequest,
  deps: { emitter: CasualCompletionEmitter; refCodes: RefCodeGenerator }
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
3. On `{ ok: false }`: returns `{ ok: false, error }` unchanged. Neither
   seam is called — no completion event, no ref code, per §2.6's
   ok-path-only rule.
4. On `{ ok: true }`: calls `deps.refCodes.generate()` for `shareRef`,
   then `deps.emitter.emit({ templateId: CASUAL_TEMPLATE_ID, occurredAt:
   new Date().toISOString(), ref: req.ref })` (fire-and-await — the
   response is not returned until the emit settles, so a caller's 200 is
   proof the completion event was accepted; §2.6 seam contract covers
   retry/failure semantics). Returns `{ ok: true, result, shareRef }`.

`src/routes/api/casual/reconcile/+server.ts` parses the JSON body,
rejects non-array/wrong-length tuple fields with a 400 and
`{ ok: false, error: { kind: "malformed-decimal", detail: "..." } }`
(the same `EngineError` shape, so the client has one error type to
handle) before calling `handleCasualReconcile`, and returns its result
as `200` JSON in both the `ok: true` and `ok: false` cases (engine-level
rejection is not an HTTP error — it is a valid, expected response the
client already has a screen for, §3's error-path transition).

### 4.1 Full-detail payload is a documented no-op against `FIELD_CLASSES`

Casual is the sole full-detail session per T2-product-surfaces §2.1; the
response above returns the complete `ReconcileResult`, every field,
unfiltered. `FIELD_CLASSES` (T3-m1-engine-port §2.2) is still imported
and referenced in a one-line assertion in `casualReconcile.test.ts` —
`Object.keys(FIELD_CLASSES).length > 0` plus a comment recording that no
field is stripped here — so the "server payload class is the sole
disclosure authority" principle (§2.1) is an auditable, explicit decision
for casual (send everything) rather than an accidental omission of
redaction logic. T2-data-layer's payload constructor is not invoked:
there is no stored classified result for it to read (casual computes and
returns in one request), so this endpoint is a second, narrower
disclosure point that this brief documents as the casual-mode exception
to "the payload constructor is the only egress" — legitimate under
T2-product-surfaces §2.1's own full-detail-for-casual carve-out.

## 5. UI presentation of R6 (hiding raw figures)

R6 is a **rendering** default, not a payload restriction (§4.1): the
`OutcomeReveal.svelte` component receives the complete `ReconcileResult`
and conditionally renders `result.input[role].tuple` for each role only
when local `numbersShown` is `true`. Default mount: `numbersShown =
false`. The convergence animation (both-ranges variant, permitted in
casual per the design-brief ruling) renders regardless of
`numbersShown` — R6 conceals the four raw entry figures specifically,
not the range geometry the animation already encodes.

## 6. Two cross-brief seams (declared here, not implemented by T3-m1-data-core in this brief's scope)

Both seams get a real interface plus a local, self-executing stand-in so
this brief ships without waiting on `T3-m1-data-core`'s landing order.
Whichever brief lands second wires the real implementation behind the
same interface — a one-line import swap in
`src/lib/server/casual/casualReconcile.ts`'s dependency wiring
(`src/routes/api/casual/reconcile/+server.ts`'s constructor call), never
a change to `handleCasualReconcile`'s signature.

**6.1 Completion-event emission** — `src/lib/server/casual/completionEvent.ts`:

```typescript
export interface CasualCompletionEvent {
  templateId: string;
  occurredAt: string; // ISO 8601
  ref: string | null;
}
export interface CasualCompletionEmitter {
  emit(event: CasualCompletionEvent): Promise<void>;
}
```

Satisfies T2-data-layer §2.6 ("casual sessions... the only persisted
trace is an anonymous completion event: template id, timestamp,
attribution ref") and §2.8 ("casual sessions store no price data at
all"). This brief ships `consoleCasualCompletionEmitter` (an
`emit` that `console.info`s the event and resolves) as the default
wiring so the endpoint is fully testable and demoable before
`T3-m1-data-core` supplies the real events-table writer. **Cross-brief
dependency, not an open question:** the real emitter's construction
(reading `src/lib/server/data/events`) is `T3-m1-data-core`'s output;
integrating it here is a follow-up one-line change, tracked outside
this brief's Done condition (§8).

**6.2 Ref code generation** — `src/lib/server/casual/refCode.ts`:

```typescript
export interface RefCodeGenerator {
  generate(): string;
}
```

Satisfies T1 §2.7 ("share-link ref codes on every shared result").
Casual's outbound ref is intentionally unpersisted and unattributable
back to a specific pair (T2-data-layer §2.8 — nothing about the
reconciliation is stored): it exists only so that the NEXT visitor who
follows the shared link carries `?ref=<code>` into their own completion
event (§4 step 4's `req.ref`), giving the activation funnel a
correlation key without a row ever existing for the code itself. This
brief ships `randomRefCodeGenerator` (`crypto.randomUUID()`,
first 8 hex characters, collision risk accepted — the code is a
correlation tag on future events, not a unique identifier requiring
uniqueness guarantees) as the default. **VERIFY AT EXECUTION:** confirm
`T2-data-layer`/`T3-m1-data-core` has not since ruled a specific ref-code
format (length, charset, checksum) that other surfaces must share; if so,
swap this generator to match rather than leaving two incompatible
formats live.

**Inbound ref capture:** `src/routes/+page.svelte`'s `load` reads
`url.searchParams.get('ref')` and threads it as a prop into
`CasualFlow.svelte`, which carries it unmodified (not user-editable, per
T2-product-surfaces §3.1) into the `POST` body's `ref` field at the
`b-submit` transition.

## 7. Component breakdown (files to create)

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
- `src/lib/client/casual/OutcomeReveal.svelte` — the reveal screen (§5);
  renders zone/fair-price/animation unconditionally, raw tuples behind
  `numbersShown`.
- `src/lib/client/casual/ResultCard.svelte` — the shareable card:
  zone/fair-price summary, no raw figures ever (independent of
  `numbersShown` — the card is what leaves the device), and the share
  URL built as `${origin}/?ref=${shareRef}`.
- `src/lib/server/casual/casualReconcile.ts` — §4's orchestration.
- `src/lib/server/casual/completionEvent.ts` — §6.1's interface + stub.
- `src/lib/server/casual/refCode.ts` — §6.2's interface + stub.
- `src/routes/api/casual/reconcile/+server.ts` — §2's adapter.
- `src/routes/+page.svelte` — modified (not created): hero content per
  the design brief, mounts `CasualFlow` with the captured `ref` prop.
- `src/routes/+page.ts` — new `load` reading `url.searchParams` for the
  inbound ref (universal load, no server-only data needed here).

## 8. Verification (mechanical pass criteria)

**Unit (Vitest, `server` project) — `src/lib/server/casual/casualReconcile.test.ts`:**
- **V1** — a valid comfort-zone pair (any T3-m1-engine-port golden
  fixture tuple, reused verbatim) returns `{ ok: true, result, shareRef }`
  where `result` deep-equals what `reconcile()` returns directly for the
  same inputs, `shareRef` is a non-empty string, the stub emitter's
  `emit` was called exactly once with `templateId === CASUAL_TEMPLATE_ID`
  and the passed-through `ref`.
- **V2** — an invalid pair (e.g. a non-ascending tuple) returns
  `{ ok: false, error }` with `error.kind` matching the engine's own
  classification, and the stub emitter's `emit` was called zero times,
  and `refCodes.generate` was called zero times.
- **V3** — the `+server.ts` route: malformed JSON body (wrong array
  length) returns HTTP 200 with `{ ok: false, error: { kind:
  "malformed-decimal", ... } }` before `handleCasualReconcile` is
  invoked (spy assertion).
- PASS: `npm run test:unit -- --run` exits 0, all three named.

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
- **V9 (ref propagation)** — load `/?ref=abc123`, complete the flow,
  assert the `POST /api/casual/reconcile` request body's `ref` field
  equals `"abc123"` (via `page.on('request')` body inspection), and that
  the rendered `ResultCard` share URL contains a **different** ref
  (`shareRef`, freshly generated) rather than echoing the inbound one.
  PASS: both assertions hold.
- PASS overall: `npm run test:e2e` exits 0 with V4–V9 all green.

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
- The real completion-event emitter and ref-code authority
  (`T3-m1-data-core`'s output) — this brief only declares and stubs the
  seams (§6).
- The MCP/HTTP agent-doorway adapter itself (T2-agent-distribution) —
  this brief only shapes `/api/casual/reconcile`'s contract so that a
  later doorway brief can wrap it without a redesign (§2's justification
  point 2).
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
  differs from every other session shape's.
- **D3 — outbound ref codes are unpersisted, format-unverified.** §6.2;
  flagged VERIFY AT EXECUTION rather than treated as settled, since a
  shared ref-code format ruling could land in T2-data-layer or
  T3-m1-data-core after this brief is authored.
- **D4 — hardcoded M1 casual template, not the template system.** §7;
  matches the *shape* T2-product-surfaces §2.5 defines for templates so
  a later swap to the real system is a data change, not a redesign.

## 11. Open questions (HITL)

- **Q1 — which template governs the M1 casual homepage demo?** M1's item
  4 says "casual mode on the landing page" but does not name a template,
  and the consumer-toy template is explicitly M3-scoped
  (M1-working-instrument §3). This brief defaults to a generic,
  unbranded two-party pricing template (§7, D4) purely to make the
  brief executable — copy register, party labels, and currency default
  are placeholders pending an operator or business-side ruling on what
  the free homepage demo is actually *about* before real users see it.
  Leaning: ship the generic placeholder for M1, restyle to the toy
  template's copy when M3's viral campaign work lands (no schema/engine
  change either way).

## 12. Capture and commit

Verify §8's V1–V9 all pass. Then capture via the apv-capture skill
(`exfu-agent-plan-visualiser:apv-capture`; `/apv-capture` is its
Claude-Code alias — read the skill source directly if the alias is
absent, per `CLAUDE.md`) against THIS plan id, recording
`verification.tested` with V1–V9 by number and result, and commit:

`feat(casual): homepage blind-handover flow with stateless server reconciliation`

If any of V4–V7 (the disclosure-safety checks) fails, STOP — do not ship
a passing build with a figures-leak; capture as blocked with the exact
failing assertion and screen state, and report. A disclosure-safety
failure here is a T1 §2.1 violation, not a cosmetic bug.
