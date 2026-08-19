---
id: T1-top-level
plan_kind: thematic
tier: 1
status: draft
---

# T1 — Pricing Meter product: top-level technical intent

> Scope ruling (Alastair, 19 Aug 2026): this T1 is **technical-only**. The
> venture's why — practice frame, GTM, market strategy, exit thinking — lives
> in the ExFu library scope `pricing-meter` and is referenced here as
> background, never restated. Business-side planning methodology is its own
> open exploration in that scope.
>
> Revised 19 Aug 2026 addressing Codex audit round 1 (verdict: revise;
> 1 high / 5 medium / 1 low — return at `.exfu/returns/t1-top-level-audit-r1.json`).

## 1. Why

Build the software the Pricing Meter venture sells: a suite of tools around
the software implementation of the Van Westendorp Price Sensitivity Meter.
The first and novel inflection is **two-party blind price reconciliation**
(each party fills a four-point VW meter; the engine computes a fair midpoint
and whether a deal zone exists). The second is the orthodox **one-party,
N-respondent pricing survey** for founders. Both are inflections of one core
maths engine, and further inflections (calculators) are expected.

**Success, technically:** the free two-party tool live end-to-end, with the
venture's activation metric — **completed two-party reconciliations** —
measurable from share-link entry through completion; agents able to run
reconciliations through published MCP endpoints; the data layer capturing
resale-grade metadata from row one; the paid layer buildable but deliberately
deferred until pilots justify it (venture threshold: ~10 paying pilots). The
build must also serve the venture's practice goal: every piece reusable or
transferable, assets cleanly separable for a future sale.

**Audience of this corpus:** Alastair (solo founder-operator), agents
executing briefs cold, and eventually an acquirer's technical diligence.

**Background (T0-class, read before any T2 work):**
- Library scope root: `/Users/al/Dropbox/ExFu Library/scopes/pricing-meter/`
  (also recorded in this repo's `CLAUDE.md`). Governing files in `context/`:
  `Venture Overview.md`,
  `Project Principles -- Practice Frame -- 18 Aug 2026.md`,
  `Project Split -- Repo and Library -- 19 Aug 2026.md`, and
  `research/Update 1 (17 Aug 2026).md`,
  `research/Update 2a -- Product GTM and Data Strategy (18 Aug 2026).md`,
  `research/Update 2b -- Exit Strategy (18 Aug 2026).md`,
  `research/Update 3 -- Project Principles (18 Aug 2026).md`
  (later docs supersede earlier).
- In this repo: `reference/Pricing Meter -- Conversation Transcript
  (16-18 Aug 2026).md` (the founding conversation, verbatim).
- Prior art: the March 2026 prototype project `vwpa`
  (`/Users/al/Studio/projects/vwpa/` on Alastair's machine) — a working
  convergence-engine prototype (`product/vwpa.jsx`) and a full product
  design doc (`docs/plans/2026-03-17-fairpricebroker-design.md`).
  **Reference, not a starting point.** Its algorithm, blindness/security
  constraints, and session-lifecycle thinking remain sound; its GTM and
  pricing choices are superseded by the Aug 2026 scope docs; its stack
  choice is neither adopted nor superseded — that ruling is open (Q1).

## 2. How — standing principles

1. **Blindness is enforced in the data model and API authorisation, never
   the client.** The convergence algorithm runs server-side only; no
   response ever contains the other party's raw inputs (casual/co-present
   mode is the sole, explicit exception). Doubly critical because agents
   act for one party via MCP.
2. **Horizontal core, vertical skins.** One engine; user-definable A-vs-B
   four-question setups; verticals (recruiters, founders, the consumer toy)
   are templates, never forks.
3. **Agent-native from day one.** Every *public product capability* is
   exposed to agents (MCP) with the same reach a human user has at that
   tier; privileged, cross-party, and raw-data operations are explicitly
   excluded wherever principle 1 or authorisation demands it. Agent-readable
   documentation ships alongside the product, not after it.
4. **The data layer is a day-one schema decision.** Every row carries
   vertical/role/region/currency/date metadata; aggregates only ever
   produced at N≥20. **Disclosure boundary:** identifiable raw data is
   never disclosed to any party other than its subject — not to the
   counterparty, not to analytics consumers, not to data buyers.
   Authenticated data-subject access (each party retrieving their own
   inputs; GDPR export) and necessary controlled processing (hosting,
   backups) are explicitly permitted.
5. **Separability.** Data-gravity assets (database project, payment
   account, domain, sending domain, this repo) are product-owned instances,
   assignable to the proposed Newco. Standalone revenue history and cohort
   metrics from day one.
6. **The landing page is the product.** The casual mode runs on the
   homepage with zero signup; conversion is play → privacy → persistence.
7. **Measure the loop.** Share-link ref codes on every shared result;
   completed-reconciliation activation events attributable from link entry
   through completion; product usage readable by the venture's scorecard
   agent on demand, without bought analytics. (Mechanisms belong to
   T2-data-layer.)
8. **Build honestly small.** Free tool first; paid layer only after the
   pilot threshold; boring resilience (error tracking, uptime ping,
   backups) over infrastructure ambition.

## 3. What — themes (each becomes a T2)

Theme boundaries also assign the three security surfaces distinctly:
**identity/authentication** → T2-platform; **authorisation and blindness
enforcement** → T2-data-layer; **agent credentials and rate limiting** →
T2-agent-distribution.

1. **T2-engine** — the maths core, owning *both* shipped inflections and
   the extension seam: two-party reconciliation (multi-layer convergence,
   deal zones, least-unfair-price) *and* orthodox one-party VWPM survey
   analysis (classic curves and intersection points); a stated set of
   shared primitives; an extension contract by which future calculator
   inflections plug into the same core; honesty-signal instrumentation
   (calculate and store only — no correction in v1).
2. **T2-product-surfaces** — session lifecycle (draft → submit → recall →
   lock → close), the mode surfaces built on the engine (casual, two-party
   invited, survey), party-role/label system, the horizontal template
   system, UI.
3. **T2-agent-distribution** — MCP exposure of public capabilities per
   principle 3, agent-readable docs and machine-readable API description,
   discovery/registry presence, agent credential issuance and rate
   limiting.
4. **T2-data-layer** — schema with day-one metadata; authorisation and
   blindness enforcement per principles 1 and 4; the N≥20 aggregate
   pipeline; activation/attribution instrumentation per principle 7; GDPR
   mechanics (data-subject export, PII purge, retention).
5. **T2-platform** — hosting, identity and authentication tiers (none /
   email token / magic link / OAuth), billing integration point (Q3),
   lifecycle email, resilience, backups.

## 4. Open questions (HITL)

- **Q1 — stack ruling.** The Aug 2026 venture docs assume Firebase/
  Firestore in passing; the March 2026 design specified Next.js + Supabase
  + Vercel; neither has been deliberately ruled. Which stack governs the
  build? (Decides T2-engine's target and T2-platform wholesale.)
- **Q2 — build order of modes.** Two-party first is the standing default —
  it is the validation plan's activation target. If the business-side wedge
  ruling (founder-survey first vs recruiters first, open in the scope)
  lands on founders, does that change *build* order or only *marketing*
  order?
- **Q3 — payments.** Merchant of Record vs Stripe + Stripe Tax — leaning
  MoR business-side; T2-platform's billing integration point blocks on the
  ruling.
- **Q4 — prior-art re-adoption boundary.** The engine port is salvage by
  default. Which of the vwpa design doc's *product decisions* (its four
  session types, lifecycle states, host-view safety panels) are re-adopted
  as requirements for T2-product-surfaces, and which are re-derived fresh
  against the horizontal-core principle?
- **Q5 — name and domain.** Business-side decision; technical consequence
  is repo/package/domain naming. Placeholder "fairprice" until ruled.
