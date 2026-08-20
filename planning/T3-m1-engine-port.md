---
id: T3-m1-engine-port
plan_kind: thematic
tier: 3
t2_parent: T2-engine
milestone: M1-working-instrument
status: draft
---

# T3 — M1 engine port: the reconciliation maths, typed and proven

## 0. Human summary (plain language)

**Port the proven prototype maths into the real app as typed, tested,
server-only code.** Same answers as the prototype (checked against
recorded examples), plus the agreed upgrades: works for any
"low-preferrer vs high-preferrer" pair (not just buyer/seller), a
smarter stop-rule for big numbers, honesty measurements, and a version
stamp on every result.

---

> Parent: `T2-engine` (all principles §2, contracts §3.1–3.2/§3.5,
> verification §4, rulings §6). Milestone: `M1-working-instrument`
> item 2. Depends on: `T3-m1-scaffold` completed (vitest wiring exists).
> Survey inflection (T2-engine §3.3) is NOT in this brief (M2).

## 1. Environment facts (pinned)

- Source of truth for behaviour:
  `/Users/al/Studio/projects/vwpa/product/vwpa.jsx` **lines 1–251 only**
  (Layer-1 methods, consensus methods, `runConvergence`,
  `buildCurveData`). Read it in full before writing code. Do not open
  the UI portion (lines 252+).
- Target: `src/lib/server/engine/` in this repo (server-only path per
  the scaffold brief). TypeScript strict; no imports from outside the
  engine directory except dev/test tooling — the engine is pure
  (T2-engine §2.1): no I/O, no env access, no Date.now/randomness in
  results.
- Test runner: Vitest via `npm run test:unit -- --run`. Property tests
  use `fast-check`: `npm install -D fast-check`.

## 2. Files to create (exact)

1. `src/lib/server/engine/types.ts` — `VWTuple` (four ascending positive
   finite numbers), `DirectionalParty` (`{ tuple: VWTuple; direction:
   "low-preferring" | "high-preferring" }`), zone/result/layer types
   mirroring the prototype's result shape PLUS: `fieldClass` labels on
   result fields (`"party-safe" | "host-safe" | "internal-only"` — per
   T2-engine §2.2: distances are internal-only except own-distance;
   layers/trace internal-only; fairPrice and zone classification
   party-safe), and `EngineVersionMeta` (`engineVersion`,
   `algorithmVersion: "reconciliation/1"`, `numericPolicyVersion`).
2. `src/lib/server/engine/validate.ts` — tuple/domain validation with
   typed errors (ascending, finite, > 0; per T2-engine §2.5). Exactly one
   currency per computation is the caller's concern — the engine never
   sees currency.
3. `src/lib/server/engine/reconcile.ts` — the port. Public entry:
   `reconcile(a: DirectionalParty, b: DirectionalParty, opts?)`.
   Internally normalise to (lowPreferrer, highPreferrer) — reject two
   same-direction parties with a typed error (T2-engine §2.3). Port
   faithfully: zone algebra (comfort/deal/phantom incl. the phantom-gap
   bounds), the six Layer-1 methods, the five consensus methods, the
   fixed-point loop (max 8 layers), fair price = median of final layer.
   **Tolerance (ruling §6 R1):** spread threshold =
   `max(0.01, zoneWidth * 1e-4)` where zoneWidth = |overlapHigh −
   overlapLow| (document both constants in `numericPolicy.ts`);
   zero-width zones return the bound marked `convergedTrivially`
   (T2-engine §2.5).
4. `src/lib/server/engine/numericPolicy.ts` — every named constant
   (grid steps 200, KDE bandwidth = range/3, tolerance floor 0.01,
   relative factor 1e-4, curve steps 300, curve padding 0.85/1.15) with
   one-line rationales; exported as the `numericPolicyVersion: "np/1"`.
5. `src/lib/server/engine/curves.ts` — `buildCurveData` port
   (trapezoid acceptability; internal-only field class — the reveal's
   data needs are the payload constructor's concern downstream).
6. `src/lib/server/engine/honesty.ts` — per T2-engine §3.5, signal-set
   version `"honesty/1"`: adjusted Fisher–Pearson sample skewness;
   range compression `(v4−v1)/((v1+v4)/2)`; sample excess kurtosis;
   zero-variance → `{ value: null, reason: "zero-variance" }`.
7. `src/lib/server/engine/index.ts` — barrel export; everything typed.
8. Tests (replace the scaffold smoke test):
   - `golden.test.ts` — golden vectors: run the PROTOTYPE's exact maths
     (transcribe its literal algorithm as an in-test oracle, or
     hand-compute) for at least: one comfort-zone case, one stretch-zone
     case, one no-deal case, using the prototype's ABSOLUTE 0.01
     tolerance mode (expose `opts.tolerance = {mode:"absolute-0.01"}`)
     so the port is anchored before the R1 semantics apply; assert zone
     classification, layer-1 values (±1e-9), and fair price. Then the
     same vectors under the default R1 tolerance with a fidelity note
     where results differ.
   - `properties.test.ts` (fast-check): fair price within active zone;
     spread non-increasing per layer; determinism; validation rejects
     bad tuples (non-ascending, ≤0, NaN/∞); direction-mirror symmetry
     (swap parties + flip directions ⇒ mirrored result); zero-width zone
     behaviour.
   - `honesty.test.ts` — hand-computed signal values for two fixtures +
     the zero-variance case.

## 3. Out of scope (do not touch)

Survey maths; any route/endpoint; any UI; the data layer; persistence of
any kind; the payload constructor (downstream consumes the field-class
labels this brief defines); currency handling; rounding for display.

## 4. Verification, capture, commit

`npm run test:unit -- --run` fully green and `npm run lint` clean.
Then /apv-capture (this plan id; include `verification.tested` with the
command and result) and commit:
`feat(engine): port reconciliation engine with golden vectors and property tests`
If any golden vector cannot be made to match the prototype's algorithm,
STOP — do not adjust the vector to fit; capture as blocked with the
discrepancy and report (a maths mismatch is a finding, not a rounding
detail).
