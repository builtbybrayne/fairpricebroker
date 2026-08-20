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
recorded examples that are already captured in this repo), plus the
agreed upgrades: works for any "low-preferrer vs high-preferrer" pair
(not just buyer/seller), prices that keep every decimal place they were
given, a smarter stop-rule for big numbers, honesty measurements, and a
version stamp on every result.

---

> Parent: `T2-engine` (all principles §2, contracts §3.1–3.2/§3.5,
> verification §4, rulings §6). Milestone: `M1-working-instrument`
> item 2. Depends on: `T3-m1-scaffold` completed (vitest wiring exists).
> Survey inflection (T2-engine §3.3) is NOT in this brief (M2).
>
> Revised 20 Aug 2026 addressing Codex audit r1 (verdict: revise;
> 5 high / 2 medium). Golden fixtures are now pre-generated and pinned
> in-repo (§1); the decimal boundary honours ruling §6 R2; direction
> normalisation, distances, and every numeric semantic are specified
> below. Deviations from the prototype are enumerated in §5.

## 1. Environment facts (pinned)

- Behaviour source: `/Users/al/Studio/projects/vwpa/product/vwpa.jsx`
  **lines 1–251 only** (Layer-1 methods, consensus methods,
  `runConvergence`, `buildCurveData`). Read it in full before writing
  code. Do not open the UI portion (lines 252+).
- **Golden fixtures are already pinned — do NOT regenerate them.**
  `reference/engine-golden-fixtures-v1.json` was produced on 20 Aug 2026
  by running the prototype maths verbatim (Node v25.9.0); the exact
  generator is archived beside it
  (`reference/engine-golden-fixtures-v1.generator.mjs`) and its
  provenance block is embedded in the JSON. It contains five fixtures —
  `comfort-zone`, `deal-only`, `no-deal`, `r1-divergence`,
  `decimal-precision` — each with **full layer traces** (every method
  value, every layer spread), zone bounds/flags, fair price, and
  convergence flag, in BOTH tolerance modes; `no-deal` also carries
  derived distances; `r1-divergence` diverges between modes (8 layers /
  not converged under absolute-0.01 vs 5 layers / converged under
  relative-r1, with different fair prices). The oracle is therefore the
  recorded prototype, not any in-test transcription.
- Target: `src/lib/server/engine/` (server-only path per the scaffold
  brief). TypeScript strict; no imports from outside the engine
  directory except dev/test tooling — the engine is pure (T2-engine
  §2.1): no I/O, no env access, no Date.now/randomness in results.
- Test runner: Vitest (`server` project — node environment; file pattern
  `src/**/*.{test,spec}.ts`, non-`.svelte.`) via
  `npm run test:unit -- --run`. Property tests: fast-check, pinned:
  `npm install -D fast-check@4.9.0`.

## 2. Files to create (exact)

**2.1 `types.ts`**

- `DecimalString` — a branded string type; grammar
  `^(0|[1-9][0-9]*)(\.[0-9]+)?$` with the additional rule value > 0
  (so `"0"` and `"0.000"` are invalid). This is the **lossless decimal
  boundary required by ruling §6 R2**: tuple values enter and are
  echoed as exact decimal strings; no precision cap.
- `VWTuple` — `readonly [DecimalString, DecimalString, DecimalString,
  DecimalString]`, strictly ascending under EXACT decimal comparison
  (§2.2), never float comparison.
- `DirectionalParty` — `{ tuple: VWTuple; direction: "low-preferring" |
  "high-preferring" }`.
- Field classes, **T2-engine §2.2's exact vocabulary**:
  `type FieldClass = "per-party-safe" | "host-safe" | "internal-only"`.
  Per-party-safe fields additionally carry
  `owner: "low-preferring" | "high-preferring" | "both"`. The engine
  labels; T2-data-layer redacts by label. Classification table (binding):

  | Result field | Class |
  |---|---|
  | fairPrice (= least-unfair price in no-deal), zone classification (`comfort` / `deal` / `no-deal`), `convergedTrivially`, `convergenceAchieved`, version metadata | per-party-safe, owner `both` |
  | each party's own distance (§2.4) | per-party-safe, owner = that party |
  | the counterparty's distance | internal-only (surfaced only via the other party's own-distance field) |
  | zone bounds (overlapLow/High, dealLow/High, gap), full layer trace, curve data, honesty signals, echoed inputs | internal-only |
  | (host-safe) | no reconciliation field is host-safe in v1; the class exists in the type for T2-data-layer's contract |

- `EngineVersionMeta` — per T2-engine §2.4, complete:
  `{ inflection: "reconciliation"; algorithmVersion: "reconciliation/1";
  numericPolicyVersion: "np/1"; honestySignalSetVersion: "honesty/1";
  engineVersion: string; toleranceMode: "relative-r1" | "absolute-0.01" }`.
  `engineVersion` is the literal exported constant `ENGINE_VERSION =
  "0.1.0"` (a const in `types.ts` — not read from package.json: the
  engine does no I/O).

**2.2 `validate.ts`** — typed errors, exact decimal arithmetic:

- Errors (typed discriminated union): `MalformedDecimal`, `NonPositive`,
  `NotAscending`, `SameDirectionParties`.
- Exact decimal comparison algorithm (spelled so there is no float
  detour): split on `.`; compare integer parts as `BigInt`; on tie,
  right-pad the shorter fractional part with zeros to equal length and
  compare the fractional parts as `BigInt`. Strictly-ascending check
  uses this comparison across the four values.
- Float conversion (for computation) happens only AFTER exact
  validation. Conversion is `Number(decimalString)` — IEEE-754 double,
  round-to-nearest-even — permitted by T2-engine §2.6 ("internals may
  compute in binary floating point"), documented as policy
  `decimal-io/1` in `numericPolicy.ts`. Note recorded there: conversion
  is monotone non-decreasing, so exact-ascending inputs can collapse to
  equal floats but never invert; a collapse lands in the zero-width /
  trivial-convergence paths, which are defined behaviour.

**2.3 `reconcile.ts`** — the port. Public entry:
`reconcile(a: DirectionalParty, b: DirectionalParty, opts?: ReconcileOpts)`.

- **Direction normalisation (exact):** exactly one `low-preferring` and
  one `high-preferring` party, else `SameDirectionParties`. Normalise to
  the pair `(low, high)` regardless of argument order. Mapping to the
  prototype's positions: everywhere the prototype says `buyer`, read
  `low` (`buyer[i]` → `low.tuple[i]`); everywhere `seller`, read `high`.
  Direction-generalised method formulas (prototype lines cited):
  - Nash (l.13–22): `worst_high = high[0]`, `worst_low = low[3]`;
    candidate `(worst_low + worst_high) / 2`, clamped to
    `[overlapLow, overlapHigh]`.
  - Kalai-Smorodinsky (l.24–43): `lowIdeal = overlapLow`,
    `lowWorst = low[3]`, `highIdeal = overlapHigh`,
    `highWorst = high[0]`; same formula, same zero-range fallback to the
    midpoint, same clamp.
  - Flexibility-weighted (l.71–80): `lowWidth = low[3] − low[0]`,
    `highWidth = high[3] − high[0]`;
    `highWeight = lowWidth / (lowWidth + highWidth)` (the wider — more
    flexible — low side pulls the price toward the high side, exactly
    the prototype's `sellerWeight`); zero total width → midpoint.
  - Midpoint, geometric mean, joint-acceptability: direction-free;
    port as-is.
- **Zone algebra:** `dealLow = max(low[0], high[0])`,
  `dealHigh = min(low[3], high[3])`,
  `comfortLow = max(low[1], high[1])`,
  `comfortHigh = min(low[2], high[2])`; `hasComfortZone: comfortLow <=
  comfortHigh` (zero-width comfort allowed), `hasOverlap: dealLow <=
  dealHigh`. Active zone: comfort if present, else deal if present,
  else the phantom gap.
- **Phantom bounds, order-safe (deviation D1, §5):** when there is no
  overlap, `overlapLow = dealHigh`, `overlapHigh = dealLow`. In the
  classic gap (low range below high range) this equals the prototype's
  `[buyer[3], seller[0]]` exactly; in the inverted-disjoint case the
  prototype never handled (the low-preferrer's whole range ABOVE the
  high-preferrer's), it still yields a well-ordered interval. Invariant
  (property-tested): `overlapLow <= overlapHigh` for every valid pair.
  `gap = hasOverlap ? 0 : overlapHigh − overlapLow` (now non-negative in
  both disjoint orientations).
- **Layers:** Layer 1 = the six methods over the active zone; layers 2+
  = the five consensus methods over the previous layer's values, per the
  prototype's loop. All loop semantics per §2.6.
- **Distances (deviation D2, §5 — not prototype output):** per party,
  the distance from the fair price to that party's acceptable interval:
  `distance_p = max(0, p.tuple[0] − fairPrice, fairPrice − p.tuple[3])`
  (floats). Zero whenever the fair price lies inside the party's range —
  so zero for both in comfort/deal outcomes; in no-deal it is each
  party's stretch to the least-unfair price. Classes per §2.1's table.
  The pinned `no-deal` fixture carries the expected values.
- **Tolerance (ruling §6 R1):** `opts.tolerance` is
  `{ mode: "relative-r1" }` (default) or `{ mode: "absolute-0.01" }`
  (golden-anchoring mode only). Threshold: relative-r1 =
  `max(0.01, zoneWidth * 1e-4)` with `zoneWidth = overlapHigh −
  overlapLow` (non-negative post-D1); absolute-0.01 = `0.01`. The
  result's `EngineVersionMeta.toleranceMode` records the mode used —
  every result stamps mode + `numericPolicyVersion` (audit M-finding).
- Zero-width active zone (both bounds equal, including float-collapse
  per §2.2): return that bound as fairPrice, `convergedTrivially: true`,
  single-layer trace (T2-engine §2.5).

**2.4 `numericPolicy.ts`** — every constant named and exported, with
one-line rationales; the set is version `"np/1"`: tolerance floor
`0.01`; relative factor `1e-4`; grid `steps = 200` (201 evaluation
points); KDE bandwidth = `range / 3`; KDE degenerate-range shortcut
`0.01`; curve `steps = 300` (301 points); curve padding `0.85` / `1.15`;
`maxLayers = 8`; and the `decimal-io/1` conversion policy note (§2.2).

**2.5 `curves.ts`** — `buildCurveData` port (l.229–251): trapezoid
acceptability over `[globalMin, globalMax]` = padded union of both
tuples' ranges; 301 points; fields `{ price, low, high, joint }`
(direction-keyed names replacing buyer/seller); class internal-only —
the reveal's data needs are the payload constructor's concern
downstream.

**2.6 Numeric semantics (pinned — port these behaviours, not
approximations of them):**

- Grid searches (joint-acceptability l.55–68, KDE l.116–134) evaluate
  `steps + 1` points inclusive of both ends; best-so-far comparison is
  strict `>`, so ties resolve to the LOWEST price/x — preserve the
  iteration order.
- KDE: unnormalised Gaussian kernel `exp(-0.5·u²)`, bandwidth
  `(max−min)/3`, and the degenerate shortcut: if `max − min < 0.01`,
  return the midpoint (an ABSOLUTE constant from np/1 — deliberately
  independent of the tolerance mode).
- Convergence loop (l.196–208): layer 1's spread is never tested; each
  consensus layer is pushed, THEN `if (spread < threshold) break` —
  strict `<`, test-after-push; `maxLayers = 8` total layers including
  layer 1 (so at most 7 consensus layers). `convergenceAchieved` =
  final layer's spread `< threshold`.
- Median (l.97–101): numeric ascending sort; odd count → middle element
  (5-value consensus layers → the 3rd); even → mean of the two middle.
  `fairPrice` = median of the FINAL layer's values.
- Trimmed mean (l.103–108): length ≤ 2 → arithmetic mean; else drop
  exactly one minimum and one maximum (`slice(1, -1)` after sort).
- Geometric mean (l.137–140): `product^(1/n)`; positive domain is
  guaranteed by validation (T2-engine §2.5).
- Layer-1 spread = `max − min` of the six method values; consensus
  spread likewise over five.

**2.7 `honesty.ts`** — per T2-engine §3.5, signal-set `"honesty/1"`,
formulas pinned so a cold agent computes identical values. Functions
take `readonly number[]` (post-conversion floats; n = 4 in practice) and
do NOT re-validate — reachability note in §5 F2. With `x̄` the mean,
`dᵢ = xᵢ − x̄`, and `s` the sample standard deviation
(`s² = Σdᵢ² / (n−1)`):

- Skewness (adjusted Fisher–Pearson, the estimator Excel/Sheets call
  SKEW): `G1 = [n / ((n−1)(n−2))] · Σ(dᵢ/s)³`.
- Kurtosis (sample excess kurtosis, the estimator Excel calls KURT):
  `G2 = [n(n+1) / ((n−1)(n−2)(n−3))] · Σ(dᵢ/s)⁴ − 3(n−1)²/((n−2)(n−3))`.
  (n = 4 is the minimum n for which G2 is defined — fine here.)
- Range compression: `(v₄ − v₁) / ((v₁ + v₄)/2)` — dimensionless.
- Zero variance (all values equal): every signal returns
  `{ value: null, reason: "zero-variance" }` — never NaN.

**2.8 `index.ts`** — barrel export; everything typed; no default export.

**2.9 Fixtures:** copy `reference/engine-golden-fixtures-v1.json`
verbatim to `src/lib/server/engine/fixtures/golden.json` (the
`reference/` copy is the canonical archive; the engine copy is what
tests import). Never edit either copy — a mismatch is a blocker, not a
tuning target (§4).

**2.10 Tests** (replace the scaffold smoke test):

- `golden.test.ts` — for each of the five fixtures × both tolerance
  modes: build `DirectionalParty` inputs from the fixture (numbers →
  `DecimalString` via `String(n)`; `lowPreferrer` array = low-preferring
  party), run `reconcile` in the matching mode, and assert against the
  recorded result: zone flags and bounds, layer count, EVERY method
  value in EVERY layer, every layer spread, `fairPrice`, and
  `convergenceAchieved` — numeric comparisons within
  `1e-9 · max(1, |expected|)`. Additionally: `r1-divergence` asserts the
  two modes differ exactly as recorded (8 vs 5 layers, different fair
  prices); `no-deal` asserts both distances against `derivedDistances`;
  `decimal-precision` asserts the echoed input tuples reproduce the
  input strings losslessly.
- `properties.test.ts` — fast-check, pinned run config
  `{ seed: 20260820, numRuns: 200 }` on every property. Generator:
  4-value strictly-ascending positive tuples (generate 4 distinct
  positive floats in a bounded range, sort) with both direction
  assignments, both argument orders, and disjoint/overlapping/inverted
  geometries reachable. Properties:
  1. fairPrice ∈ `[overlapLow, overlapHigh]` (inclusive).
  2. consensus-layer spreads non-increasing (tolerance `1e-12`
     for float noise).
  3. determinism: two identical calls give deeply-equal results.
  4. **argument-order invariance:** `reconcile(a, b)` deeply equals
     `reconcile(b, a)` — see §5 F1 for why this is the binding reading
     of T2-engine §4's "role-direction symmetry".
  5. `overlapLow <= overlapHigh` for every valid pair, including
     inverted-disjoint (exercises D1).
  6. zero-width active zone → `convergedTrivially`, fairPrice = the
     bound.
  7. validation: non-ascending (exact-decimal), non-positive, and
     malformed strings (`"1e5"`, `"-3"`, `"1.2.3"`, `".5"`, `"NaN"`,
     `""`) are rejected with the typed errors of §2.2; two
     same-direction parties rejected with `SameDirectionParties`.
- `honesty.test.ts` — closed-form expectations (derivations in test
  comments, independent of the implementation); every numeric assertion
  within `1e-12` (the derivations are exact in ℝ; float evaluation is
  not):
  - Fixture A `[10, 20, 30, 40]`: mean 25, `Σd² = 500`, symmetric ⇒
    skewness `0`; kurtosis: `Σ(d/s)⁴ = 3.69` ⇒
    `G2 = (20/6)·3.69 − 13.5 = −1.2`; range compression `30/25 = 1.2`.
  - Fixture B `[10, 12, 14, 40]`: mean 19, `Σd² = 596`, `Σd³ = 8064`,
    `Σd⁴ = 204068` ⇒ expected skewness
    `(2/3) · 8064 / (596/3)**1.5`, expected kurtosis
    `(10/3) · 204068 / (596/3)**2 − 13.5`, range compression
    `30/25 = 1.2`.
  - Zero variance: direct call with `[5, 5, 5, 5]` →
    `{ value: null, reason: "zero-variance" }` for skewness and
    kurtosis.

## 3. Out of scope (do not touch)

Survey maths; any route/endpoint; any UI; the data layer; persistence of
any kind; the payload constructor (downstream consumes the field-class
labels this brief defines); currency handling; rounding for display;
honesty correction machinery (T2-engine §2.7 — signals only);
regenerating or editing the golden fixtures.

## 4. Verification, capture, commit

`npm run test:unit -- --run` fully green and `npm run lint` clean.
Then capture via the apv-capture skill
(`exfu-agent-plan-visualiser:apv-capture`; `/apv-capture` is its
Claude-Code alias) against THIS plan id, including `verification.tested`
with the command and result, and commit:
`feat(engine): port reconciliation engine with golden vectors and property tests`
If any golden assertion cannot be made to pass, STOP — do not adjust
fixtures or tolerances to fit; capture as blocked with the exact
discrepancy (fixture id, mode, layer, method, expected vs actual) and
report. A maths mismatch is a finding, not a rounding detail.

## 5. Deviations and fidelity notes (binding)

- **D1 — order-safe phantom bounds.** No-overlap bounds are
  `[dealHigh, dealLow]` — identical to the prototype's
  `[buyer[3], seller[0]]` in the classic gap, well-ordered in the
  inverted-disjoint case the prototype never handled. Property 5 pins
  it.
- **D2 — distances.** Not computed by the prototype; defined here by
  the interval-distance formula (§2.3) to satisfy T2-engine §2.2's
  no-deal contract. The pinned `no-deal` fixture records the expected
  values (its provenance note marks them as derived, not
  prototype-recorded).
- **D3 — decimal boundary.** The prototype takes JS numbers; this port
  takes `DecimalString` per ruling §6 R2, with the `decimal-io/1`
  conversion policy (§2.2). The fixtures' numeric inputs are converted
  via `String(n)`, which is lossless for every value they contain.
- **F1 — symmetry interpretation.** T2-engine §4's "role-direction
  symmetry (swapping parties and mirroring direction yields the mirrored
  result)" is implemented as argument-order invariance (property 4):
  normalisation is direction-keyed, so swapping the argument positions
  of the same two directional parties must change nothing. A price-axis
  reflection symmetry is NOT claimed — Nash, Kalai-Smorodinsky,
  flexibility weighting, and the geometric mean are not
  reflection-invariant, so no such invariant exists to test. If the
  auditor or operator intended a stronger reading, that is a T2
  question, not an implementation choice.
- **F2 — zero-variance reachability.** Through `reconcile()` the
  zero-variance honesty branch is unreachable (validation requires
  strictly ascending tuples, so variance > 0). The contract of T2-engine
  §3.5 is kept at the honesty-function level and tested by direct call
  (§2.10). This is deliberate: the functions are exported toolkit
  members (T2-engine §3.1) and future inflections may feed them
  non-tuple value sets.
- **F3 — R1 tolerance divergence.** Where relative-r1 and absolute-0.01
  disagree, the fixtures record both modes; the `r1-divergence` fixture
  exists precisely to pin the disagreement (per ruling §6 R1's
  per-vector fidelity-note requirement).
