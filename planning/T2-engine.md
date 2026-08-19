---
id: T2-engine
plan_kind: thematic
tier: 2
status: active
---

# T2-engine — the maths core

## 0. Human summary (plain language)

**This is the blueprint for the maths brain of Fair Price Broker.** It does
two jobs with one engine: (1) two people each secretly enter four price
points and it finds the fair middle (or says "no deal possible — here's the
least unfair number"), and (2) one founder asks many people about a price
and it draws the classic pricing-survey answer.

The rules that matter: **the engine's full answer is for our servers only**
— what each person is allowed to see gets filtered elsewhere, so nobody can
ever peek at the other side. The maths must give **the same answer every
time**, show its working, and be tested against the proven prototype so we
know the port didn't change the numbers. It also quietly measures whether
someone's four numbers look honest (measured and stored only — no
punishing anyone yet).

Three small decisions still need Alastair — listed at the bottom.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 1 (19 Aug 2026). Architecture
> altitude: names real components and contracts, no file paths or code.
> Inherits all T1 §2 principles by reference — notably principle 1
> (blindness), 2 (horizontal core), 4 (data/disclosure).
>
> Revised 19 Aug 2026 addressing Codex audit round 1 (verdict: revise;
> 2 high / 4 medium / 1 low — return at `.exfu/returns/t2-engine-audit-r1.json`).
>
> **Accepted 19 Aug 2026 by Alastair** (operator ceremony, in-chat), after
> Codex pre-acceptance audit, revision addressing all findings, and the
> operator's §6 rulings on all three open questions.

## 1. Why (theme intent)

One maths core owns every inflection of the Van Westendorp method the
product ships — two-party reconciliation and one-party survey now,
calculators later — so that inflections are configurations of shared
primitives, never forks (T1 §2 principle 2). The engine is also the
product's credibility: its outputs must be deterministic, explainable, and
faithful to the proven prototype.

## 2. How — architectural principles

1. **Pure, deterministic, stateless.** The engine is a side-effect-free
   module: typed values in, typed result out. No I/O, no persistence, no
   framework or platform coupling — which makes this theme independent of
   the stack ruling (T1 Q1). Same inputs and same engine version always
   produce the same output.
2. **Engine results are trusted-internal only.** The engine computes on
   both parties' raw inputs and returns the complete result — trace and
   all — to its server-side caller. That result never crosses a trust
   boundary as-is: **T2-data-layer alone constructs authorised, role-safe
   payloads from it** (per T1 §3's security-surface assignment), and
   product surfaces may only further omit fields from an already-safe
   payload, never add. The engine classifies its own result fields
   (per-party-safe / host-safe / internal-only) so the authorisation layer
   redacts by declared class, not by guesswork. **No-deal contract:** a
   party's safe payload contains the least-unfair price and *that party's
   own* distance only; the counterparty's distance is internal-only. Sole
   exception: the explicitly co-present casual mode (T1 §2.1), where the
   full-detail payload class is permitted.
3. **Role generalisation.** The prototype hard-codes buyer/seller. The
   engine binds the reconciliation inflection to exactly **two directional
   roles — one low-preferring, one high-preferring**; labels and template
   mappings are T2-product-surfaces' concern. Every Layer-1 method's
   asymmetry (Nash's worst-points, Kalai-Smorodinsky's ideals, flexibility
   weighting) is expressed in terms of direction, not "buyer"/"seller".
   The consumer toy and all verticals are templates over this contract
   (ruled: T1 §2.2). If a template's real shape cannot satisfy the
   two-directional-roles contract (e.g. a same-direction comparison), that
   is escalated as a proposed T1 amendment — never resolved by quietly
   adding an inflection.
4. **Explainability is a first-class output.** Results carry the full
   trace: zone classification, every layer's per-method values and spread,
   convergence status — all class-labelled per principle 2. Every result
   also carries **version metadata**: inflection name and algorithm
   version, plus the effective numerical-policy version (tolerances,
   discretisations), so a historical result remains reproducible and
   attributable after constants change. Golden vectors are scoped to the
   version they anchor.
5. **Numerical domain and discipline.** The engine's scalar domain is
   **finite, strictly positive numbers in one declared currency/unit per
   computation** — no zero or negative prices (the geometric-mean methods
   require a positive domain), no non-finite values, no implicit unit or
   currency conversion (currency is a display label owned upstream;
   conversion is out of scope for the engine entirely). Validation rejects
   out-of-domain input at the boundary with typed errors. All
   discretisations (grid searches, KDE bandwidth) and tolerances are named
   constants with documented rationale; zero-width zones (both bounds
   equal) are a defined case returning that bound with a
   converged-trivially marking, not an edge-case crash. Rounding for
   display is the caller's job; the engine documents its own boundary
   rounding, if any, in the numerical policy.
6. **Precision is preserved, presentation is transformed** (ruled — §6 R2).
   Prices are exact decimals and may legitimately carry 3–4+ decimal places
   (volume-product haggling); the engine accepts and returns full input
   precision, never silently rounding. Storage is an
   arbitrary-precision-capable mechanism (T2-data-layer's column choice);
   display rounding is a *presentation transform* owned by callers, sane
   default two decimal places. Engine internals may compute in binary
   floating point (results are advisory prices), with output precision and
   any boundary rounding documented in the numerical policy.
7. **Honesty signals are instrumentation only** (v1): computed per party,
   returned alongside results for storage, never applied as correction.
   Correction machinery (compression, confidence weighting) is a
   designed-but-dormant v2 concern and must not leak into v1 interfaces
   beyond the signal values themselves.

## 3. What — components and contracts

**3.1 Primitives, honestly partitioned.**
- *Engine-wide primitives* (every inflection consumes these): the
  four-point VW tuple (strictly ascending, in-domain per principle 5, with
  boundary validation) and the trapezoidal acceptability curve over a
  tuple.
- *Mathematical toolkits* (reusable where an inflection needs them, not
  universal): the consensus toolkit (mean, median, trimmed mean, KDE mode,
  geometric mean over a value set).
- *Inflection-specific components*: zone algebra for two directional
  tuples (comfort zone = inner ranges overlap; deal/stretch zone = outer
  ranges overlap; phantom zone = the gap between the low-preferrer's
  maximum and the high-preferrer's minimum) belongs to the reconciliation
  inflection. Cumulative-curve construction belongs to the survey
  inflection.
- Consumption map: reconciliation uses engine-wide primitives + zone
  algebra + the consensus toolkit; survey uses engine-wide primitives +
  cumulative-curve construction. Future calculators declare their
  consumption the same way.

**3.2 Reconciliation inflection** (two-party; port of the proven
prototype):
- Layer 1 — six adversarial fairness methods over the active zone:
  arithmetic midpoint, geometric mean, Nash bargaining,
  Kalai-Smorodinsky, joint-acceptability peak, flexibility-weighted.
- Layer 2+ — the five consensus methods iterate on the previous layer's
  values as a fixed-point loop: bounded layer count,
  spread-below-tolerance termination; fair price = median of the final
  layer.
- No-deal case still runs the engine across the gap, yielding the
  **least-unfair price** plus each party's distance — classified and
  disclosed per principle 2's no-deal contract.
- Port fidelity: behaviour anchored to the prototype
  (`vwpa/product/vwpa.jsx`) by golden test vectors captured from it;
  deliberate deviations (e.g. Q1 tolerance semantics) documented
  per-vector against the version metadata of principle 4.

**3.3 Survey inflection** (one-party, N respondents; orthodox VWPM) — the
normative contract a T3 implements:
- *Curve construction:* from N validated tuples, four cumulative curves
  over price — "too cheap" and "cheap/bargain" as descending cumulative
  proportions, "expensive" and "too expensive" as ascending cumulative
  proportions ("not cheap" and "not expensive" are the complements of the
  second and third curves where a pairing requires them).
- *Intersection points:* point of marginal cheapness (too cheap ×
  not cheap), point of marginal expensiveness (too expensive ×
  not expensive), optimal price point (too cheap × too expensive),
  indifference price point (cheap × expensive). Crossings are computed by
  **linear interpolation between adjacent sample prices**; where curves
  touch over an interval rather than crossing at a point, the interval
  midpoint is returned and the result flagged `interval-crossing`; where a
  pairing never crosses in the sampled range, that point is returned as an
  explicit `no-crossing` result state, never extrapolated.
- *Result:* the four points (or their explicit result states), the
  acceptable price range (PMC–PME), and N — always reported, never judged
  (ruled — §6 R3: we are a broker, not an analyser; the engine computes
  from N=2 upward with no sample-adequacy gate or mandatory flag; a
  friendly small-N note is a presentation option owned by product
  surfaces, not an engine contract). Invalid respondent tuples are
  rejected individually with a per-respondent validation report; a survey
  computes only over valid tuples and reports both counts. (Distinct
  concern, unchanged: the venture's N≥20 rule governs *published
  aggregates* in T2-data-layer, not survey results returned to their own
  commissioning user.)
- *Verification:* representative and edge-case vectors (interval-crossing,
  no-crossing, all-identical respondents, minimum-N) are binding on the
  implementing T3, alongside at least one hand-computed classic VWPM
  worked example.

**3.4 Extension contract** (future calculators): an inflection is a named,
versioned pure function from typed inputs (built on declared primitives per
§3.1's consumption map) to a typed, field-classified result carrying its
own explanation payload and version metadata. New inflections register
alongside the existing two; none may reach around the contract into another
inflection's internals. The consumer toy is NOT an inflection — it is a
template over the reconciliation inflection (ruled: T1 §2.2).

**3.5 Honesty signals** — versioned definitions, not just names (v1
computes and returns; storage is T2-data-layer's; developer-only visibility
is a product-surface rule):
- *Skewness:* adjusted Fisher–Pearson sample skewness over the four tuple
  values; undefined (zero variance) returns an explicit null-with-reason,
  never NaN.
- *Range compression:* tuple width divided by tuple midpoint
  ((V4 − V1) / ((V1 + V4)/2)) — dimensionless; lower = more compressed.
- *Kurtosis:* sample excess kurtosis over the four values; same undefined
  handling as skewness.
- Each signal result carries the signal-set version (principle 4), so v2
  correction work can re-derive against known definitions.

## 4. Verification approach (binding on T3s)

- Golden vectors from the prototype: comfort-zone, stretch-zone, and
  no-deal cases with expected zone classification, layer traces, and fair
  price — scoped to engine version per principle 4.
- Property invariants, tested generatively: fair price always within the
  active zone bounds; layer spread monotonically non-increasing;
  determinism (identical inputs + version → identical results);
  validation rejects non-ascending and out-of-domain tuples;
  role-direction symmetry (swapping parties and mirroring direction yields
  the mirrored result); zero-width zone returns the bound, marked
  converged-trivially.
- Survey inflection: the §3.3 vector set plus the hand-computed classic
  example.

## 5. Open questions (HITL)

- **Q1 — convergence tolerance semantics.** The prototype uses an absolute
  0.01 (currency-unit) spread threshold. Keep absolute (faithful port) or
  make it relative to the active zone width with an absolute floor
  (scale-invariant across magnitudes)? Leaning relative-with-floor;
  affects golden-vector fidelity notes.
- **Q2 — money representation.** Floats (as prototype) or integer minor
  units with fixed-point maths? Affects every interface signature; leaning
  floats-with-documented-rounding at the engine boundary (results are
  advisory prices, not ledger entries). Domain rules are already fixed by
  principle 5 either way.
- **Q3 — small-sample threshold.** Below what N does the survey inflection
  flag results as small-sample (and should tiny N — e.g. below 5 — refuse
  to compute intersections at all rather than flag)? Leaning flag below
  N=20 (mirrors the venture's N≥20 aggregate-publishing rule), compute
  from N=2 with the flag.

## 6. Rulings (19 Aug 2026, operator, in-chat)

- **R1 (Q1 — convergence tolerance): RULED as proposed.** Relative to the
  active zone width, with an absolute floor. Golden vectors captured from
  the prototype's absolute-0.01 behaviour carry a per-vector fidelity note
  where the semantics diverge.
- **R2 (Q2 — money representation): RULED, superseding the float leaning.**
  No assumption that prices are "sane" 2-d.p. figures — volume-product
  haggling can hinge on 3–4 d.p. Contract: precision-preserving decimal
  values end-to-end (arbitrary-precision-capable storage), with display
  rounding as a caller-owned presentation transform, sane default 2 d.p.
  Principle 6 (§2) carries the binding text.
- **R3 (Q3 — small-sample threshold): RULED — not our problem.** The
  product is a broker, not an analyser (yet): no sample-adequacy gate, no
  mandatory flag; N is always reported; a friendly note is a
  product-surface presentation option only. §3.3 carries the binding text.
  The N≥20 rule remains in force where it always lived: published
  aggregates (T2-data-layer).
