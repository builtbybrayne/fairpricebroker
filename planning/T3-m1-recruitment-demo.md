---
id: T3-m1-recruitment-demo
plan_kind: thematic
tier: 3
t2_parent: T2-product-surfaces
milestone: M1-working-instrument
status: active
---

# T3 — M1 recruitment demo: the guided walkthrough that doubles as validation

## 0. Human summary (plain language)

**A public "try it as a recruiter" walkthrough.** One visitor plays both
sides: they enter a made-up client budget as the recruiter, then "switch
hats" and answer as the candidate, then see the recruiter's result. At
each step we ask two or three quick questions ("would you send this
before the first call?") with a comment box. Every answer is saved the
moment it's given, flagged as demo data, so even people who quit halfway
still teach us something. Nothing here counts as real usage.

---

> Parent: `T2-product-surfaces` (§7 R8 guided demos, R9 guidance layer,
> R7/§9 R11 disclosure), `T2-data-layer` §7 R5 (demo-flagged events).
> Milestone: added to M1 by operator directive (8 Sep 2026) — R8's
> "shipping milestone deferred" is superseded for the recruitment demo
> only. Depends on: `T3-m1-recruitment-core` (template content, the
> meter/entry/result components), `T3-m1-data-core` (`events` table),
> `T3-m1-casual-mode` (stateless server compute pattern). Seed content:
> `reference/fair-pricebroker-canvas/documents/recruiter-demo-build-spec-and-outreach.md`
> (stage framing and directed questions, used as-is; the Netlify/fork
> hosting idea is ruled out — same codebase).

## 1. Shape

- Route `src/routes/recruitment/+page.svelte` — the vertical's page:
  the recruitment story (standoff, two-sided signal, who sees what),
  the outcome explained, entry to the demo, entry to sign-in.
- Route `src/routes/recruitment/demo/+page.svelte` — the walkthrough,
  a client-driven state machine like the casual flow, five stages
  exactly as the seed spec: **1 budget entry (recruiter hat)** → **2
  "link sent", switch hats** → **3 candidate answers** (with the R11
  disclosure and the incentive copy shown as the candidate would see
  them) → **4 overlap output (recruiter hat)** → **5 wrap-up**. Each
  stage carries its directed questions (Likert or yes/no where the
  spec's question is closed, free text where open) and one comment box.
- **Progressive submission:** every stage's "Continue" POSTs that
  stage's answers to `/api/demo/answer` before advancing; a failed POST
  does not block the walkthrough (retry silently once, then continue —
  demo answers are best-effort, the flow is not).
- **Demo identity:** a client-minted `demoId` (UUID v4) at stage 1,
  carried through every POST; no account, no cookie beyond the page.
- **Reconciliation:** stage 4 calls `handleCasualReconcile`'s engine
  path? No — it calls a demo-specific server function
  `runDemoReconciliation(budgetTuple, candidateTuple)` that invokes the
  pure engine and returns the host-full-shaped view (both tuples are
  the visitor's own) plus the recruitment guidance layer. No session
  row, no `results` row, no credit.

## 2. Events (T2-data-layer §7 R5)

Rows in `events` with `session_id = null`, `idempotency_key` = a UUID
minted per stage submit:
- `event_type = 'demo_stage_answered'`, payload
  `{ demo: true, vertical: 'recruitment', demo_id, stage: 1..5,
  answers: {...}, comment: string|null, ref_code: RefCode|null }`.
- `event_type = 'demo_completed'` at stage 5 with the same envelope.
The activation view only counts `reconciliation_completed`, so demo
rows never pollute activation; a `demo_answers` read-only view
(`scorecard_reader`) flattens them for validation reading. Casual's
`casual_writer` role/policy admits `session_id is null` inserts — reuse
it (one more `event_type` value, no new role).

## 3. Server

- `src/lib/server/demo/demoAnswers.ts` — `recordDemoStage(input)`
  (validated shape, idempotent on key, under `casual_writer`).
- `src/lib/server/demo/demoReconcile.ts` — `runDemoReconciliation`.
- `src/routes/api/demo/answer/+server.ts`, `/api/demo/reconcile/+server.ts`
  — thin adapters; rate-limit class `compute` declared for the
  catalogue as in the casual brief.

## 4. Verification

- **V1 (e2e)** — walk all five stages with the spec's questions; assert
  five `demo_stage_answered` rows + one `demo_completed` for the
  `demo_id`; `activation_events` count unchanged.
- **V2** — abandon after stage 2: exactly two rows exist.
- **V3** — replaying a stage POST with the same idempotency key adds no
  row.
- **V4** — stage 3 renders the R11 disclosure and incentive copy before
  the inputs; stage 4 renders overlap level + non-remuneration steer.
- PASS: unit + e2e green, V1–V4 named.

## 5. Out of scope

Founders demo, any other vertical, outreach copy (business-side), the
LinkedIn post, analytics beyond the events rows.

## 6. Capture and commit

`feat(recruitment): guided demo walkthrough with progressive demo-flagged answers`
