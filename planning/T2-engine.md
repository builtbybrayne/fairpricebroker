---
id: T2-engine
plan_kind: thematic
tier: 2
status: draft
---

# T2-engine — the maths core

> Spawned from `T1-top-level` §3 theme 1 (19 Aug 2026). Architecture
> altitude: names real components and contracts, no file paths or code.
> Inherits all T1 §2 principles by reference — notably principle 1
> (blindness), 2 (horizontal core), 4 (data/disclosure).

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
   the stack ruling (T1 Q1). Same inputs always produce the same output;
   every result is reproducible after the fact.
2. **The engine is server-side-only by decree, not by design knowledge.**
   Blindness (T1 §2.1) is enforced by where the engine runs and what
   callers may see — the engine itself computes on both parties' raw
   inputs and returns full detail to its (server-side) caller. Redaction
   per role/tier is the data-layer and product-surface's job
   (T2-data-layer authorisation seam), never the engine's. The engine must
   therefore never be packaged where a client could import it.
3. **Role generalisation.** The prototype hard-codes buyer/seller. The
   engine generalises to two directional roles: a **low-preferring party**
   and a **high-preferring party** (labels are presentation concerns,
   T2-product-surfaces). Every Layer-1 method's asymmetry (Nash's
   worst-points, Kalai-Smorodinsky's ideals, flexibility weighting) is
   expressed in terms of direction, not of "buyer"/"seller".
4. **Explainability is a first-class output.** Results carry the full
   trace: zone classification, every layer's per-method values and spread,
   convergence status. Consumers choose how much to show; the engine never
   discards the working.
5. **Numerical discipline.** All discretisations (grid searches, KDE
   bandwidth) and thresholds are named constants with documented
   rationale. Convergence tolerance must be meaningful across currencies
   and magnitudes (day-rates in the hundreds vs salaries in the tens of
   thousands) — see Q1 below.
6. **Honesty signals are instrumentation only** (v1): computed per party,
   returned alongside results for storage, never applied as correction.
   The correction machinery (compression, confidence weighting) is a
   designed-but-dormant v2 concern and must not leak into v1 interfaces
   beyond the signal values themselves.

## 3. What — components and contracts

**3.1 Shared primitives** (used by every inflection):
- The four-point VW tuple: strictly ascending values
  (too-cheap < low < high < too-expensive), validated at the boundary.
- Trapezoidal acceptability curve over a VW tuple.
- Zone algebra for two directional tuples: comfort zone (inner ranges
  overlap), deal/stretch zone (outer ranges overlap), phantom zone (no
  overlap — the gap between the low-preferrer's maximum and the
  high-preferrer's minimum).
- The consensus toolkit: mean, median, trimmed mean, KDE mode, geometric
  mean over a value set.

**3.2 Reconciliation inflection** (two-party; port of the proven
prototype):
- Layer 1 — six adversarial fairness methods over the active zone:
  arithmetic midpoint, geometric mean, Nash bargaining,
  Kalai-Smorodinsky, joint-acceptability peak, flexibility-weighted.
- Layer 2+ — the five consensus methods iterate on the previous layer's
  values as a fixed-point loop: bounded layer count, spread-below-
  tolerance termination; fair price = median of the final layer.
- No-deal case still runs the engine across the gap, yielding the
  **least-unfair price** plus each party's own distance from it (movement
  is fair, not equal; the counterparty's distance is never part of a
  party-facing payload — enforcement per principle 2's seam).
- Port fidelity: behaviour is anchored to the prototype
  (`vwpa/product/vwpa.jsx`) by golden test vectors captured from it;
  deliberate deviations (e.g. Q1's tolerance semantics) are documented
  per-vector.

**3.3 Survey inflection** (one-party, N respondents; orthodox VWPM):
- Cumulative-frequency curves over N respondents' tuples and the four
  classic intersection points (point of marginal cheapness, point of
  marginal expensiveness, optimal price point, indifference price point),
  yielding the acceptable price range.
- Sample-size honesty is part of the result contract: N, and a
  small-sample flag below a named threshold, always accompany the
  numbers (the venture's "among users of X, honest caveats" ruling).
- Reuses the shared primitives; adds no second maths culture.

**3.4 Extension contract** (future calculators): an inflection is a named,
versioned pure function from typed inputs (built on the shared primitives)
to a typed result carrying its own explanation payload. New inflections
register alongside the existing two; none may reach around the contract
into another inflection's internals. (The consumer toy is NOT an
inflection — it is a template over the reconciliation inflection, per T1
§2.2.)

**3.5 Honesty signals**: per-party skewness, range-compression, and
kurtosis over the VW tuple, computed for every reconciliation, returned
for storage (T2-data-layer owns where they land; developer-only
visibility is a product-surface rule).

## 4. Verification approach (binding on T3s)

- Golden vectors from the prototype: comfort-zone, stretch-zone, and
  no-deal cases with expected zone classification, layer traces, and fair
  price.
- Property invariants, tested generatively: fair price always within the
  active zone bounds; layer spread monotonically non-increasing;
  determinism (identical inputs, identical results); validation rejects
  non-ascending tuples; role-direction symmetry (swapping the parties and
  mirroring direction yields the mirrored result).
- Survey inflection verified against hand-computed classic VWPM examples
  from the literature.

## 5. Open questions (HITL)

- **Q1 — convergence tolerance semantics.** The prototype uses an
  absolute 0.01 (currency-unit) spread threshold. Keep absolute (faithful
  port) or make it relative to the active zone width (scale-invariant
  across currencies/magnitudes)? Leaning relative-with-floor; affects
  golden-vector fidelity notes.
- **Q2 — money representation.** Floats (as prototype) or integer minor
  units with fixed-point maths? Affects every interface signature;
  leaning floats-with-documented-rounding at engine boundary (results are
  advisory prices, not ledger entries).
- **Q3 — role model confirmation.** Is "exactly two directional parties
  (one low-preferring, one high-preferring)" sufficient for all imagined
  A-vs-B templates, or must the engine anticipate same-direction
  comparisons (e.g. two friends comparing willingness-to-pay, which may
  be the consumer toy's real shape)? Decides whether the toy is a
  template (current assumption) or a third inflection.
