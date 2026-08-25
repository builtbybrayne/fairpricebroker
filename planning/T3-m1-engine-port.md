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
version stamp on every result. One question needs Alastair (§6).

---

> Parent: `T2-engine` (all principles §2, contracts §3.1–3.2/§3.5,
> verification §4, rulings §6). Milestone: `M1-working-instrument`
> item 2. Depends on: `T3-m1-scaffold` completed (vitest wiring exists).
> Survey inflection (T2-engine §3.3) is NOT in this brief (M2).
>
> Revised 20 Aug 2026 addressing Codex audit r1 (verdict: revise;
> 5 high / 2 medium): fixtures pre-generated and pinned in-repo, decimal
> boundary per ruling R2, normalisation/distances/numerics specified.
> Revised again same day addressing audit r2 (verdict: revise; 3 high /
> 3 medium): complete public TypeScript contract (§2.2) with an
> outcome union and a static field-class map; validated magnitude domain
> and output serialisation closing the R2 boundary (§2.1/§2.3); the
> symmetry-property question escalated to the operator as §6 Q1 (a child
> plan cannot reinterpret an accepted T2); fixture archive now carries
> version anchors; property arbitraries pinned constructively; honesty
> zero-variance aligned with T2 §3.5's letter.
> Revised a third time addressing audit r3 (verdict: revise; 2 high /
> 1 medium — the delegation round cap is now exhausted, so this
> revision is unaudited and goes to the operator with the full trail):
> zero-width zones get an explicit branch (deviation D4 — the natural
> pipeline provably violates T2 §2.5 at large magnitudes, pinned by the
> auditor's counterexample as a contract test); outputs get their own
> `OutputDecimal` brand admitting `"0"`; the anchors assertion covers
> the complete five-field identity including `inflection`.

## 1. Environment facts (pinned)

- Behaviour source: `/Users/al/Studio/projects/vwpa/product/vwpa.jsx`
  **lines 1–251 only** (Layer-1 methods, consensus methods,
  `runConvergence`, `buildCurveData`). Read it in full before writing
  code. Do not open the UI portion (lines 252+).
- **Golden fixtures are already pinned — do NOT regenerate them.**
  `reference/engine-golden-fixtures-v1.json` was produced on 20 Aug 2026
  by running the prototype maths verbatim (Node v25.9.0); the exact
  generator is archived beside it
  (`reference/engine-golden-fixtures-v1.generator.mjs`), its provenance
  block is embedded in the JSON, and its `anchors` block scopes the
  vectors to `reconciliation/1` / `np/1` / `honesty/1` / engine `0.1.0`
  (T2-engine §2.4). It contains five fixtures — `comfort-zone`,
  `deal-only`, `no-deal`, `r1-divergence`, `decimal-precision` — each
  with **full layer traces** (every method value, every layer spread),
  zone bounds/flags, fair price, and convergence flag, in BOTH tolerance
  modes; `no-deal` also carries derived distances; `r1-divergence`
  diverges between modes (8 layers / not converged under absolute-0.01
  vs 5 layers / converged under relative-r1, with different fair
  prices). The oracle is the recorded prototype, not any in-test
  transcription. (Audit r2 verified the generator behaviourally faithful
  to vwpa.jsx and the archive byte-for-byte regenerable.)
- Target: `src/lib/server/engine/` (server-only path per the scaffold
  brief). TypeScript strict; no imports from outside the engine
  directory except dev/test tooling — the engine is pure (T2-engine
  §2.1): no I/O, no env access, no Date.now/randomness in results.
- Test runner: Vitest (`server` project — node environment; file pattern
  `src/**/*.{test,spec}.ts`, non-`.svelte.`) via
  `npm run test:unit -- --run`. Property tests: fast-check, pinned:
  `npm install -D fast-check@4.9.0`.

## 2. Files to create (exact)

**2.1 `types.ts` — scalar boundary types**

- `DecimalString` — a branded string type; grammar
  `^(0|[1-9][0-9]*)(\.[0-9]+)?$` with the additional rule value > 0
  (so `"0"` and `"0.000"` are invalid). Trailing fractional zeros are
  grammatical (`"100.00"` is well-formed) — equality is decided by the
  EXACT comparison of §2.4, under which `"100.00"` equals `"100"`.
  This is the **lossless input boundary required by ruling §6 R2**:
  tuple values enter and are echoed as exact decimal strings; no
  precision cap in the grammar.
- **Magnitude domain (closes the r2 overflow finding):** after float
  conversion, every tuple value must lie in `[MAG_MIN, MAG_MAX]` =
  `[1e-9, 1e15]` (named constants in `numericPolicy.ts`, part of np/1),
  else the typed error `out-of-magnitude-domain`. Rationale (recorded
  with the constants): (a) caps every product the engine forms — the
  6-value consensus geometric mean's worst case `(1e15)^6 = 1e90` and
  the joint-acceptability products stay far inside IEEE-754 double
  range, and `(1e-9)^6 = 1e-54` stays far above underflow; (b) bounds
  every computed output magnitude at `1e15 · 1.15`. Valid decimal
  strings outside the domain (e.g. `"10000000000000000"`,
  `"0.0000000001"`) are REJECTED, never silently converted to
  `0`/`Infinity`-adjacent floats.
- `OutputDecimal` — a second branded string type for OUTPUTS: same
  grammar as `DecimalString` but value ≥ 0 (`"0"` is valid — gap and
  distances are legitimately zero; `DecimalString` itself stays
  strictly positive because INPUT prices must be). Distinct brands keep
  the compiler from accepting an output where an input is required.
- `PricePoint` — every party-relevant monetary OUTPUT is
  `{ float: number; decimal: OutputDecimal }`. Serialisation (the
  `decimal-io/1` output rule): start from `String(float)` (V8 shortest
  round-trip — re-parses to the identical double); if that rendering is
  exponential (contains `e` — reachable for derived values below
  `1e-6`, e.g. a tiny gap or distance), rewrite it losslessly to plain
  decimal expansion by shifting the mantissa's digits per the exponent
  (a pure string transform — no re-rounding); zero serialises as `"0"`.
  The invariant tests rely on: `Number(decimal) === float`, always.
  This is the documented output boundary R2 requires: computed prices
  are float-derived (permitted by T2 §2.6) and serialised canonically;
  the policy is recorded in `numericPolicy.ts`. Internal-only trace and
  curve values stay plain `number` — they never cross a trust boundary
  (T2 §2.2), and decimal-io/1 records exactly this split.
- `VWTuple` — `readonly [DecimalString, DecimalString, DecimalString,
  DecimalString]`, strictly ascending under the EXACT comparison
  (§2.4), never float comparison.
- `DirectionalParty` — `{ tuple: VWTuple; direction: Role }` with
  `type Role = "low-preferring" | "high-preferring"`.
- `ENGINE_VERSION = "0.1.0"` — a literal exported constant (not read
  from package.json: the engine does no I/O).

**2.2 `types.ts` — the complete public contract (closes the r2
contract finding).** Declare exactly these shapes (names binding;
`readonly` throughout):

```typescript
export type Zone = "comfort" | "deal" | "no-deal";
export type ToleranceMode = "relative-r1" | "absolute-0.01";

export interface EngineVersionMeta {
  inflection: "reconciliation";
  algorithmVersion: "reconciliation/1";
  numericPolicyVersion: "np/1";
  honestySignalSetVersion: "honesty/1";
  engineVersion: typeof ENGINE_VERSION;
  toleranceMode: ToleranceMode;
}

export interface MethodValue { name: string; value: number }      // internal-only
export interface LayerTrace {
  methods: readonly MethodValue[];                                 // 6 in layer 1, 5 after
  values: readonly number[];
  spread: number;
}

export type SignalValue =
  | { value: number }
  | { value: null; reason: "zero-variance" };
export interface HonestySignals {
  skewness: SignalValue;
  kurtosis: SignalValue;
  rangeCompression: number;            // closed-form; 0 at zero variance (T2 §3.5)
  signalSetVersion: "honesty/1";
}

export interface CurvePoint { price: number; low: number; high: number; joint: number }

export interface ReconcileResult {
  zone: Zone;
  hasComfortZone: boolean;
  overlap: boolean;
  overlapLow: PricePoint;  overlapHigh: PricePoint;
  dealLow: PricePoint;     dealHigh: PricePoint;
  gap: PricePoint;                       // 0-valued when overlap
  fairPrice: PricePoint;
  convergenceAchieved: boolean;
  convergedTrivially: boolean;
  layers: readonly LayerTrace[];
  distances: Readonly<Record<Role, PricePoint>>;
  honesty: Readonly<Record<Role, HonestySignals>>;
  curves: readonly CurvePoint[];
  input: Readonly<Record<Role, { tuple: VWTuple }>>;  // role-keyed, echoed verbatim
  meta: EngineVersionMeta;
}

export type EngineErrorKind =
  | "malformed-decimal" | "non-positive" | "out-of-magnitude-domain"
  | "not-ascending" | "same-direction-parties";
export interface EngineError { kind: EngineErrorKind; detail: string }

export type ReconcileOutcome =
  | { ok: true; result: ReconcileResult }
  | { ok: false; error: EngineError };
```

- **Error channel:** `reconcile` returns `ReconcileOutcome` and NEVER
  throws; validation failures arrive as `{ ok: false, error }`.
- **Field classification** is a static exported map, not per-instance
  tags — the engine classifies by declaration; T2-data-layer redacts by
  path lookup:

```typescript
export type FieldClassification =
  | { class: "per-party-safe"; owner: Role | "both" }
  | { class: "host-safe" }
  | { class: "internal-only" };

export const FIELD_CLASSES = {
  "zone":                     { class: "per-party-safe", owner: "both" },
  "fairPrice":                { class: "per-party-safe", owner: "both" },
  "convergenceAchieved":      { class: "per-party-safe", owner: "both" },
  "convergedTrivially":       { class: "per-party-safe", owner: "both" },
  "meta":                     { class: "per-party-safe", owner: "both" },
  "distances.low-preferring": { class: "per-party-safe", owner: "low-preferring" },
  "distances.high-preferring":{ class: "per-party-safe", owner: "high-preferring" },
  "hasComfortZone":           { class: "internal-only" },
  "overlap":                  { class: "internal-only" },
  "overlapLow":               { class: "internal-only" },
  "overlapHigh":              { class: "internal-only" },
  "dealLow":                  { class: "internal-only" },
  "dealHigh":                 { class: "internal-only" },
  "gap":                      { class: "internal-only" },
  "layers":                   { class: "internal-only" },
  "honesty.low-preferring":   { class: "internal-only" },
  "honesty.high-preferring":  { class: "internal-only" },
  "curves":                   { class: "internal-only" },
  "input.low-preferring":     { class: "internal-only" },
  "input.high-preferring":    { class: "internal-only" },
} as const satisfies Record<string, FieldClassification>;
```

  Keys are the exhaustive set of classification paths: every top-level
  `ReconcileResult` field appears either as itself or as its two
  role-split children (`distances`, `honesty`, `input`). A party's own
  distance is per-party-safe to that party; the counterparty's distance
  is thereby internal to them (T2 §2.2's no-deal contract). No
  reconciliation field is host-safe in v1; the class exists in the type
  for T2-data-layer's contract. A unit test asserts this map covers
  every field of a real result object (§2.10).

**2.3 `validate.ts`** — typed errors, exact decimal arithmetic:

- Produces `EngineError` values (never throws): `malformed-decimal`
  (grammar), `non-positive` (value rule), `out-of-magnitude-domain`
  (§2.1), `not-ascending` (equal counts as not ascending — so `"100"`
  followed by `"100.00"` is rejected), `same-direction-parties`.
- Validation order per tuple value: grammar → positivity → float
  conversion → magnitude domain; then tuple ascending check on EXACT
  decimals; then the two-party direction check.

**2.4 Exact decimal comparison** (in `validate.ts`; no float detour):
split on `.`; compare integer parts as `BigInt`; on tie, right-pad the
shorter fractional part with zeros to equal length and compare the
fractional parts as `BigInt`. Equality under this comparison defines
`DecimalString` equality (`"100.00" == "100"`).
Float conversion (for computation) is `Number(decimalString)` —
IEEE-754 double, round-to-nearest-even — applied only AFTER exact
validation, and documented under `decimal-io/1`. Recorded note:
conversion is monotone non-decreasing, so exact-ascending inputs can
collapse to equal floats but never invert; a collapse lands in the
zero-width path (§2.5), which is defined behaviour.

**2.5 `reconcile.ts`** — the port. Public entry:
`reconcile(a: DirectionalParty, b: DirectionalParty, opts?: { tolerance?: { mode: ToleranceMode } }): ReconcileOutcome`.

- **Direction normalisation (exact):** exactly one `low-preferring` and
  one `high-preferring` party, else `same-direction-parties`. Normalise
  to the pair `(low, high)` regardless of argument order; the result's
  `input`, `distances`, and `honesty` are keyed by ROLE, never by
  argument position. Mapping to the prototype's positions: everywhere
  the prototype says `buyer`, read `low` (`buyer[i]` → `low.tuple[i]`);
  everywhere `seller`, read `high`. Direction-generalised method
  formulas (prototype lines cited):
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
  else the phantom gap. `zone` = `"comfort"` / `"deal"` / `"no-deal"`
  respectively.
- **Phantom bounds, order-safe (deviation D1, §5):** when there is no
  overlap, `overlapLow = dealHigh`, `overlapHigh = dealLow`. In the
  classic gap (low range below high range) this equals the prototype's
  `[buyer[3], seller[0]]` exactly; in the inverted-disjoint case the
  prototype never handled (the low-preferrer's whole range ABOVE the
  high-preferrer's), it still yields a well-ordered interval. Invariant
  (property-tested): `overlapLow <= overlapHigh` for every valid pair.
  `gap = hasOverlap ? 0 : overlapHigh − overlapLow` (non-negative in
  both disjoint orientations).
- **Zero-width active zone** (both bounds equal, including
  float-collapse per §2.4) — **explicit branch, deviation D4 (§5)**:
  when `overlapHigh − overlapLow === 0`, do NOT run the method
  pipeline. Return the bound `m` directly: `fairPrice = m`;
  `convergedTrivially: true`; `convergenceAchieved: true`; `layers` =
  one synthetic layer whose six method entries all carry value `m` and
  whose spread is `0`. Rationale (the r3 audit's counterexample): run
  naturally at large magnitudes, the consensus geometric mean's
  floating-point drift can exceed the tolerance and the prototype then
  fails to converge on a zero-width zone — violating T2 §2.5's
  return-the-bound-marked-trivially contract. The explicit branch makes
  the T2 contract hold exactly at every magnitude in the domain.
  `convergedTrivially` is false in all other cases.
- **Distances (deviation D2, §5 — not prototype output):** per party,
  the distance from the fair price to that party's acceptable interval:
  `distance_p = max(0, p.tuple[0] − fairPrice, fairPrice − p.tuple[3])`
  (floats, then PricePoint-serialised). Zero whenever the fair price
  lies inside the party's range — so zero for both in comfort/deal
  outcomes; in no-deal it is each party's stretch to the least-unfair
  price. The pinned `no-deal` fixture carries the expected values.
- **Tolerance (ruling §6 R1):** `opts.tolerance` defaults to
  `{ mode: "relative-r1" }`; `{ mode: "absolute-0.01" }` is the
  golden-anchoring mode only. Threshold: relative-r1 =
  `max(0.01, zoneWidth * 1e-4)` with `zoneWidth = overlapHigh −
  overlapLow`; absolute-0.01 = `0.01`. Every result stamps the mode in
  `meta.toleranceMode` alongside `numericPolicyVersion`.
- **Honesty signals** are computed per party on the converted floats
  and attached role-keyed (internal-only).

**2.6 `numericPolicy.ts`** — every constant named and exported, with
one-line rationales; the set is version `"np/1"`: tolerance floor
`0.01`; relative factor `1e-4`; grid `steps = 200` (201 evaluation
points); KDE bandwidth = `range / 3`; KDE degenerate-range shortcut
`0.01`; curve `steps = 300` (301 points); curve padding `0.85` / `1.15`;
`maxLayers = 8`; `MAG_MIN = 1e-9`; `MAG_MAX = 1e15`; and the
`decimal-io/1` conversion-policy record (§2.1/§2.4).

**2.7 `curves.ts`** — `buildCurveData` port (l.229–251): trapezoid
acceptability over `[globalMin, globalMax]` = padded union of both
tuples' ranges; 301 points; fields per `CurvePoint` (direction-keyed
names replacing buyer/seller); internal-only — the reveal's data needs
are the payload constructor's concern downstream.

**2.8 Numeric semantics (pinned — port these behaviours, not
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
- Geometric mean (l.137–140): `product^(1/n)` — safe within the
  magnitude domain (§2.1); positive domain guaranteed by validation.
- Nash/KS clamp: `clamp(x, overlapLow, overlapHigh)`.
- Layer-1 spread = `max − min` of the six method values; consensus
  spread likewise over five.

**2.9 `honesty.ts`** — per T2-engine §3.5, signal-set `"honesty/1"`,
formulas pinned so a cold agent computes identical values.
**Precondition (documented on each function):** input is exactly four
finite positive numbers in ascending (not necessarily strict) order —
the post-conversion floats of a validated tuple; the functions do not
re-validate (rationale §5 F2). With `x̄` the mean, `dᵢ = xᵢ − x̄`, `n =
4`, and `s` the sample standard deviation (`s² = Σdᵢ² / (n−1)`):

- Skewness (adjusted Fisher–Pearson, the estimator Excel/Sheets call
  SKEW): `G1 = [n / ((n−1)(n−2))] · Σ(dᵢ/s)³`. Zero variance (all four
  equal) → `{ value: null, reason: "zero-variance" }`.
- Kurtosis (sample excess kurtosis, the estimator Excel calls KURT):
  `G2 = [n(n+1) / ((n−1)(n−2)(n−3))] · Σ(dᵢ/s)⁴ − 3(n−1)²/((n−2)(n−3))`
  (n = 4 is the minimum n for which G2 is defined). Zero variance →
  `{ value: null, reason: "zero-variance" }`.
- Range compression: `(v₄ − v₁) / ((v₁ + v₄)/2)` — dimensionless,
  well-defined always (positive domain); **returns `0` at zero
  variance** — T2 §3.5 assigns null-with-reason to skewness and
  kurtosis only, and the closed form simply evaluates.

**2.10 `index.ts`** — barrel export; everything typed; no default
export.

**2.11 Fixtures:** copy `reference/engine-golden-fixtures-v1.json`
verbatim to `src/lib/server/engine/fixtures/golden.json` (the
`reference/` copy is the canonical archive; the engine copy is what
tests import). Never edit either copy — a mismatch is a blocker, not a
tuning target (§4). The archive's `anchors` block must equal the
implementation's version constants — asserted in tests.

**2.12 Tests** (replace the scaffold smoke test):

- `golden.test.ts` — first assert the COMPLETE `fixtures.anchors`
  identity against the implementation — all five fields: `inflection`,
  `algorithmVersion`, `numericPolicyVersion`, `honestySignalSetVersion`,
  `engineVersion === ENGINE_VERSION` (an archive scoped to any other
  identity must fail here, per T2 §2.4). Then
  for each of the five fixtures × both tolerance modes: build
  `DirectionalParty` inputs from the fixture (numbers → `DecimalString`
  via `String(n)`; `lowPreferrer` array = low-preferring party), run
  `reconcile` in the matching mode, and assert against the recorded
  result: zone flags and bounds, layer count, EVERY method value in
  EVERY layer, every layer spread, `fairPrice.float`, and
  `convergenceAchieved` — numeric comparisons within
  `1e-9 · max(1, |expected|)` — PLUS, on every result: the complete
  `meta` object (all six fields, `toleranceMode` equal to the mode
  run), the `zone` string, and `fairPrice.decimal ===
  String(fairPrice.float)`. Additionally: `r1-divergence` asserts the
  two modes differ exactly as recorded (8 vs 5 layers, different fair
  prices); `no-deal` asserts both distances against `derivedDistances`;
  `decimal-precision` asserts the echoed `input` tuples reproduce the
  input strings losslessly.
- `contract.test.ts` — structural checks: (a) `FIELD_CLASSES` covers
  every field of a real result — for each top-level key of a computed
  `ReconcileResult`, either the key itself or its two role-split
  children (`<key>.low-preferring`, `<key>.high-preferring`) appear in
  the map, and the map has no other keys; (b) boundary cases produce
  `{ ok: false, error }` with the right `kind`:
  `"10000000000000000"` and `"0.0000000001"` → `out-of-magnitude-domain`
  (never a computed result); `"100"` then `"100.00"` in one tuple →
  `not-ascending`; `"1e5"`, `"-3"`, `"1.2.3"`, `".5"`, `"NaN"`, `""` →
  `malformed-decimal`; `"0"`, `"0.000"` → `non-positive`; two
  same-direction parties → `same-direction-parties`; (c) two distinct
  decimals that collapse to one float (e.g.
  `"1.00000000000000001"` vs `"1.00000000000000002"` used as a
  zone-bound pair) produce a defined zero-width outcome (the D4
  branch), not an error; (d) deterministic serialisation: a
  comfort-zone result's `gap` is `{ float: 0, decimal: "0" }`; the
  no-overlap pair low = `["1", "2", "3", "4.000000001"]`, high =
  `["4.000000002", "5", "6", "7"]` yields a gap float near `1e-9`
  whose `decimal` contains no `e`, matches `/^0\.0+[0-9]+$/` (plain
  expansion), and satisfies `Number(decimal) === float`; (e)
  deterministic large-magnitude zero-width (the r3 counterexample —
  near MAG_MAX, where the natural pipeline would drift): low =
  `["1", "2", "900000000000000", "900000000000100"]`, high =
  `["1.5", "900000000000000", "900000000000050", "900000000000200"]`
  → `fairPrice.float === 900000000000000` exactly,
  `convergedTrivially === true`, `layers.length === 1`.
- `properties.test.ts` — fast-check, pinned run config
  `{ seed: 20260820, numRuns: 200 }` on every property, one
  `fc.assert` per geometry so the fixed seed cannot starve any of them.
  **Pinned arbitraries** — base scalar
  `fc.double({ min: 1e-3, max: 1e12, noNaN: true })`; draw k distinct
  sorted values via `fc.uniqueArray(base, { minLength: k, maxLength:
  k })` sorted ascending, then construct (v-notation = the sorted
  draw):
  - `genComfort` (k=8): low = `[v1, v3, v6, v8]`, high =
    `[v2, v4, v5, v7]` → comfort zone `[v4, v5]`.
  - `genDealOnly` (k=8): low = `[v1, v6, v7, v8]`, high =
    `[v2, v3, v4, v5]` → no comfort, deal `[v2, v5]`.
  - `genDisjointClassic` (k=8): low = `[v1, v2, v3, v4]`, high =
    `[v5, v6, v7, v8]` → gap `[v4, v5]`.
  - `genDisjointInverted` (k=8): low = `[v5, v6, v7, v8]`, high =
    `[v1, v2, v3, v4]` → inverted disjoint, gap `[v4, v5]`.
  - `genZeroWidth` (k=7): with `m = v4`: low = `[v1, v2, m, v6]`,
    high = `[v3, m, v5, v7]` → comfort zone exactly `[m, m]`
    (constructive — zero width is guaranteed, not hoped for).
  Each generated pair is wrapped with both direction assignments and
  both argument orders. Properties (run against the applicable
  geometries):
  1. fairPrice.float ∈ `[overlapLow.float, overlapHigh.float]`
     (inclusive) — all geometries.
  2. consensus-layer spreads non-increasing (tolerance `1e-12`) — all.
  3. determinism: two identical calls give deeply-equal results — all.
  4. argument-order invariance: `reconcile(a, b)` deeply equals
     `reconcile(b, a)` — all. (**Provisional pending §6 Q1** — this
     property is necessary under any reading of T2 §4's symmetry
     clause; whether it is also sufficient is the operator's ruling.)
  5. `overlapLow.float <= overlapHigh.float` — all, exercising D1 via
     `genDisjointInverted`.
  6. `genZeroWidth` → `convergedTrivially === true`,
     `convergenceAchieved === true`, `fairPrice.float === m` exactly,
     `layers.length === 1` with spread `0` (the explicit D4 branch of
     §2.5).
  7. every PricePoint in the result satisfies
     `Number(p.decimal) === p.float` — all geometries.
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
  - Zero variance `[5, 5, 5, 5]` (direct call — unreachable through
    `reconcile`, §5 F2): skewness and kurtosis →
    `{ value: null, reason: "zero-variance" }`; rangeCompression → `0`.

## 3. Out of scope (do not touch)

Survey maths; any route/endpoint; any UI; the data layer; persistence of
any kind; the payload constructor (downstream consumes the field-class
map this brief defines); currency handling; rounding for display;
honesty correction machinery (T2-engine §2.7 — signals only);
regenerating or editing the golden fixtures; resolving §6 Q1 (operator
only).

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
  the interval-distance formula (§2.5) to satisfy T2-engine §2.2's
  no-deal contract. The pinned `no-deal` fixture records the expected
  values (its provenance note marks them as derived, not
  prototype-recorded).
- **D3 — decimal boundary and magnitude domain.** The prototype takes
  unrestricted JS numbers; this port takes `DecimalString` per ruling
  §6 R2, restricted to the validated magnitude domain (§2.1), with the
  `decimal-io/1` conversion and serialisation policy (§2.1/§2.4) and
  `PricePoint` outputs. The fixtures' numeric inputs are all inside the
  domain and convert via `String(n)` losslessly.
- **D4 — explicit zero-width branch.** The prototype runs its method
  pipeline on zero-width zones; at large magnitudes inside this brief's
  domain, consensus geometric-mean float drift can then exceed the
  tolerance and the run ends unconverged off the bound (r3 audit
  counterexample, pinned as contract test (e)) — violating T2 §2.5.
  This port therefore short-circuits: bound returned exactly, marked
  `convergedTrivially`, one synthetic layer (§2.5). Golden fixtures are
  unaffected (none has a zero-width active zone).
- **F1 — symmetry property: escalated, not reinterpreted.** T2 §4's
  "role-direction symmetry (swapping parties and mirroring direction
  yields the mirrored result)", read as a price-axis reflection, is
  provably NOT an invariant of the ported algorithm (the geometric-mean
  methods in layer 1 and the consensus toolkit are not
  reflection-invariant; grid tie-breaks orient toward low prices). An
  accepted T2 cannot be reinterpreted by a child plan, so the question
  goes to the operator as §6 Q1. Until ruled, property 4 tests
  argument-order invariance as a necessary-under-any-reading floor,
  explicitly marked provisional.
- **F2 — zero-variance reachability.** Through `reconcile()` the
  zero-variance honesty branch is unreachable (validation requires
  strictly ascending tuples, so variance > 0). The contract of T2-engine
  §3.5 is kept at the honesty-function level and tested by direct call
  (§2.12). This is deliberate: the functions are exported toolkit
  members (T2-engine §3.1) and future inflections may feed them
  non-tuple value sets.
- **F3 — R1 tolerance divergence.** Where relative-r1 and absolute-0.01
  disagree, the fixtures record both modes; the `r1-divergence` fixture
  exists precisely to pin the disagreement (per ruling §6 R1's
  per-vector fidelity-note requirement).

## 6. Open questions (HITL)

- **Q1 — the T2 §4 symmetry property.** T2-engine §4 requires
  "role-direction symmetry (swapping parties and mirroring direction
  yields the mirrored result)". Audit r2 correctly held that this
  child plan may not weaken an accepted T2's property on its own
  authority. The mathematical facts for the ruling: (a) a full
  price-axis mirror symmetry cannot hold for a faithful port — the
  prototype's geometric means (layer 1 and consensus) and low-oriented
  grid tie-breaks are not reflection-invariant; (b) argument-order
  invariance (`reconcile(a,b) ≡ reconcile(b,a)`) IS a true, testable
  invariant guaranteeing the engine has no positional bias between the
  two directional roles. Proposed ruling (needs Alastair): amend T2 §4
  to read "argument-order invariance: swapping the two parties'
  argument positions yields the identical role-keyed result", recorded
  as a T2 addendum. Alternatives: (b2) additionally require a
  reflection property restricted to the reflection-invariant methods
  (midpoint, Nash, KS, flexibility) as a second, weaker invariant; or
  (c) some other reading the operator intends. Implementation may
  proceed under the provisional property 4; the T2 amendment is the
  operator's ceremony.
