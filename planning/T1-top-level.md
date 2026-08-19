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

## 1. Why

Build the software the Pricing Meter venture sells: a suite of tools around
the software implementation of the Van Westendorp Price Sensitivity Meter.
The first and novel inflection is **two-party blind price reconciliation**
(each party fills a four-point VW meter; the engine computes a fair midpoint
and whether a deal zone exists). The second is the orthodox **one-party,
N-respondent pricing survey** for founders. Both are inflections of one core
maths engine.

**Success, technically:** the free two-party tool live end-to-end with
shareable, attribution-tagged results; agents able to run reconciliations
through published MCP endpoints; the data layer capturing resale-grade
metadata from row one; the paid layer buildable but deliberately deferred
until pilots justify it. The build must also serve the venture's practice
goal: every piece reusable or transferable, assets cleanly separable for a
future sale.

**Audience of this corpus:** Alastair (solo founder-operator), agents
executing briefs cold, and eventually an acquirer's technical diligence.

**Background (T0-class, read before any T2 work):**
- Library scope `pricing-meter` — `context/Venture Overview.md`,
  `context/research/` Updates 1/2a/2b/3 (later supersedes earlier),
  `context/Project Principles -- Practice Frame -- 18 Aug 2026.md`
- `reference/Pricing Meter -- Conversation Transcript (16-18 Aug 2026).md`
  (this repo)
- Prior art: `/Users/al/Studio/projects/vwpa/` — working engine prototype
  (`product/vwpa.jsx`) and the March 2026 FairPriceBroker design doc.
  Reference, not a starting point: its algorithm, auction lifecycle, and
  security constraints remain sound; its GTM/pricing/stack choices are
  superseded by the Aug 2026 scope docs.

## 2. How — standing principles

1. **Blindness is enforced in the data model and API authorisation, never
   the client.** The convergence algorithm runs server-side only; no
   response ever contains the other party's raw inputs (casual/co-present
   mode is the sole, explicit exception). Doubly critical because agents
   act for one party via MCP.
2. **Horizontal core, vertical skins.** One engine; user-definable A-vs-B
   four-question setups; verticals (recruiters, founders, the consumer toy)
   are templates, never forks.
3. **Agent-native from day one.** Every API endpoint has an MCP sibling via
   a shared-handler pattern; MCP is free at every tier; agent-readable docs
   and OpenAPI ship alongside; public pages get `.md` endpoints.
4. **The data layer is a day-one schema decision.** Every row carries
   vertical/role/region/currency/date metadata; aggregates only ever
   produced at N≥20; raw data never leaves. (Consent/privacy wording is
   business-side; the enforcement is ours.)
5. **Separability.** Data-gravity assets (database project, payment
   account, domain, sending domain, this repo) are product-owned instances,
   assignable to the proposed Newco. Standalone revenue history and cohort
   metrics from day one.
6. **The landing page is the product.** Casual mode runs on the homepage
   with zero signup; conversion is play → privacy → persistence.
7. **Measure the loop.** Share-link ref codes on every shared result;
   product events to the database with a nightly export the venture's
   scorecard agent can read; no bought analytics.
8. **Build honestly small.** Free tool first; paid layer only after ~10
   paying pilots (venture threshold); boring resilience (error tracking,
   uptime ping, backups) over infrastructure ambition.

## 3. What — themes (each becomes a T2)

1. **T2-engine** — extract/port the convergence engine (6 fairness methods,
   5 consensus methods, deal zones, least-unfair-price) to typed,
   server-side, tested code; honesty-signal instrumentation (calculate and
   store only — no correction in v1).
2. **T2-product-surfaces** — auction/session lifecycle (draft → submit →
   recall → lock → close), modes (casual, two-party invited, survey),
   party-role/label system, the horizontal template system, UI.
3. **T2-agent-distribution** — MCP server siblings, OpenAPI, `.md`
   endpoints, llms.txt, registry publication, API-key auth and rate
   limiting for agent traffic.
4. **T2-data-layer** — schema with day-one metadata, blindness enforcement
   in model + authorisation, aggregate pipeline (N≥20), event
   instrumentation, attribution, GDPR mechanics (export, PII purge,
   retention).
5. **T2-platform** — hosting, auth tiers (none / email token / magic link /
   OAuth), billing integration point (MoR or Stripe — undecided), lifecycle
   email, resilience, backups.

## 4. Open questions (HITL)

- **Q1 — stack ruling.** The Aug 2026 conversation assumes Firebase/
  Firestore ("own Firebase project", Firestore events); the March 2026
  design specifies Next.js + Supabase + Vercel. Which stack governs the
  build? (Decides T2-engine's target and T2-platform wholesale.)
- **Q2 — build order of modes.** Two-party reconciliation first or founder
  survey mode first? (Marketing wedge sequencing is business-side; this is
  the technical sequencing consequence, for milestone extraction.)
- **Q3 — payments.** Merchant of Record vs Stripe + Stripe Tax — leaning
  MoR business-side; T2-platform blocks on the ruling.
- **Q4 — vwpa salvage boundary.** Engine port is clearly salvage; is any of
  the vwpa UI/design doc lifecycle carried over verbatim, or is product
  surface work greenfield against the horizontal-core principle?
- **Q5 — name and domain.** Business-side decision; technical consequence
  is repo/package/domain naming. Placeholder "fairprice" until ruled.
