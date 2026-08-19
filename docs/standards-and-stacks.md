# Standards & Stacks — decision index

> One-stop lookup for technology, tooling, and convention decisions, so any
> future session finds the current state in one read. Each entry: status
> (**RULED** / **LEANING** / **OPEN**), the decision, why, and where it was
> ruled. This doc is an *index* — the ruling itself lives in the named plan
> or scope note; if this doc and a plan disagree, the plan wins. Update this
> file whenever a listed decision changes. (Created 19 Aug 2026.)

## Identity

| Thing | Status | Decision |
|---|---|---|
| Product name | **RULED** (19 Aug 2026, T1 §5) | **Fair Price Broker** |
| Domain | **RULED** (19 Aug 2026, T1 §5) | https://fairprice.broker (owned) |
| Repo name | RULED | stays `fairprice` |

## Application stack

| Thing | Status | Decision / current position |
|---|---|---|
| Language | **LEANING** | TypeScript end-to-end (engine is pure TS regardless — T2-engine §2.1) |
| Framework | **LEANING** (recommendation, awaiting ruling — T1 Q1) | Next.js, App Router. Why: landing-page-is-the-product needs SSR/SEO + API routes + MCP endpoints in one deployable; validated by the March 2026 design; TS end-to-end. |
| Backend / data | **LEANING** (operator default, awaiting ruling — T1 Q1) | **Firebase**: Auth (all four tiers) + Firestore. Why: founder fluency; venture docs already assume it (own Firebase project, Firestore events). Honest cost: relational shapes (credit ledger, org membership, N≥20 aggregates) are clunkier than Postgres — mitigated by the nightly raw-event export (below), which keeps a later warehouse/migration option open. Alternative considered: Supabase/Postgres (March design) — better aggregates + RLS, rejected-by-default for fluency reasons unless Al rules otherwise. |
| Hosting | **LEANING** | Vercel (native Next.js) — Firebase App Hosting acceptable alternative if consolidation preferred. |
| Payments | **LEANING** (operator default, awaiting ruling — T1 Q3) | **Stripe** (+ Stripe Tax). Recorded tension: business research (Update 1 §7) leaned Merchant of Record (Paddle/Lemon Squeezy) for global B2C VAT — ~3 margin points for zero tax admin. Suggested path: start Stripe (UK-first + B2B reverse-charge is simple), revisit MoR if international B2C volume appears. Separate product-owned Stripe account either way (separability ruling). |
| Email (transactional) | RULED (venture docs) | Postmark/Mailgun-class service on the product domain; never Workspace. |

## Analytics & measurement

| Thing | Status | Decision |
|---|---|---|
| Web analytics | **LEANING** (venture docs) | Umami self-hosted or Plausible — cookie-banner-free. No GA4. |
| Product events | **LEANING** (venture docs) | Events to Firestore; nightly export to a sqlite file in the library scope; the scorecard agent reads that. No Mixpanel/Amplitude. |
| Revenue truth | RULED (venture docs) | Stripe (or MoR) is the database; never duplicate. |
| Attribution | RULED (T1 §2.7) | Share-link ref codes on every shared result; completed reconciliations = the activation metric. |
| Resilience | RULED (venture docs) | Sentry free tier, uptime ping, backups. |

## Design

| Thing | Status | Decision |
|---|---|---|
| Design language | **OPEN — dedicated exploration session required** | Requirements set by Al (19 Aug 2026): ONE design language, chosen early, applied everywhere; distinctive styling that does NOT read as typical-AI output; Al cares about this a lot and rules on it personally. Candidate seed (not chosen): the vwpa prototype's dark terminal aesthetic — DM Mono / Space Mono, teal vs red parties, gold fair-price. Session should be run at the desktop with visual side-by-side candidates. |
| A11y target | RULED (carried from March design, unchallenged) | WCAG 2.1 AA. |

## Process & conventions

| Thing | Status | Decision |
|---|---|---|
| Planning | RULED | Tiered methodology (T1→T3 + Mn) in `planning/`, APV-tracked, capture-before-commit, audit-before-acceptance via Codex delegate. |
| Plan style | RULED (19 Aug 2026, T1 §5) | Every plan opens with a plain-language "Human summary" section; the rest is the agent report (humane dual-audience convention). |
| Business/technical split | RULED (19 Aug 2026) | Business/GTM in the ExFu library scope (Dropbox, no APV yet); technical in this repo. Reference, never repeat. |
| Engine verification | RULED (T2-engine §4) | Golden vectors from the prototype + generative property tests. |
| vwpa prior art | **OPEN** (T1 Q4, deferred pending stack ruling) | Engine port = salvage. Under a Firebase ruling: reuse Next.js scaffolding patterns, engine-extraction plan, and lifecycle thinking from the March design; drop the Supabase-specific parts. Verdict: patterns yes, repo no. |
