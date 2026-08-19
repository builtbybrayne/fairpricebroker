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

Selection criteria ruled by Al (19 Aug 2026): simpler and faster than
Next.js (which is excluded); best fit for the problem, founder fluency NOT a
criterion; **agent data-access is first-class** — AI agents will search,
extract, and digest this data, so the datastore and API surfaces must be
friendly to programmatic/SQL/semantic access.

| Thing | Status | Decision / current position |
|---|---|---|
| Language | **LEANING** | TypeScript end-to-end (engine is pure TS regardless — T2-engine §2.1) |
| Framework | **RULED** (19 Aug 2026, T1 §5 addendum 2) | **SvelteKit**. SSR/SEO for landing-page-is-the-product, server endpoints for API + MCP in one deployable, simpler and faster than Next.js (excluded by operator). |
| Backend / data | **LEANING** (proposal v2, awaiting ruling — T1 Q1) | **Postgres, managed via Supabase**. Why it is the best fit: the domain is relational (auctions/parties/invites/orgs, an append-only credit ledger); NUMERIC gives true arbitrary-precision money (T2-engine R2 ruling: 3–4+ d.p. legitimate); the N≥20 aggregate layer is plain SQL views; row-level security gives defense-in-depth under the blindness rule; and for agent access SQL is the lingua franca — aggregates exposable as read-only views/APIs, pgvector available if semantic search over the corpus is wanted later. Supabase adds managed Auth (magic link / OAuth / OTP email tokens — all four tiers) without a second vendor. (Firebase default withdrawn by operator: fluency removed as a criterion; Firestore's float-only numbers alone now disqualify it against the precision ruling.) **Cost path (19 Aug 2026): $0 pre-revenue** — build and launch on the Free tier (500MB DB, 50k MAU auth); the free tier's pause-after-7-idle-days never triggers because the nightly analytics export is daily DB activity; the free tier's missing backups are covered by a nightly `pg_dump` folded into that same export job. Upgrade to Pro ($25/mo) at first paying customers — it self-funds. Fallback $0 option if pause-risk ever worries: Neon free tier (serverless Postgres, auto-wake, no manual unpause) + Auth.js in SvelteKit — two vendors' jobs in-app instead of one. Firebase+Postgres amalgam rejected: Firebase's own Postgres (Data Connect) runs on Cloud SQL at ~$10+/mo minimum, and pairing Firebase Auth with a separate Postgres adds a vendor for nothing Supabase Free doesn't already do. |
| Hosting | **LEANING** | Vercel or Cloudflare (SvelteKit adapters for both; pick at scaffold time — Cloudflare cheaper/faster edge, Vercel more conventional). Supabase hosts the data layer either way. |
| Payments | **RULED: international Merchant of Record** (19 Aug 2026, T1 §5). Provider **LEANING: Stripe Managed Payments** (Stripe's MoR product — Stripe becomes merchant of record: tax in 80+ countries, disputes, fraud, transaction-level support; UK-eligible; SaaS tax codes supported; Checkout/Payment Links only; subscriptions created via Checkout; needs Stripe eligibility review; fee premium unconfirmed — check at signup). **Fallback: Paddle** if eligibility or fees disappoint. Separate product-owned account either way (separability ruling). |
| Email (transactional) | RULED (venture docs) | Postmark/Mailgun-class service on the product domain; never Workspace. |
| Agent data-access | **LEANING** (new criterion, 19 Aug 2026) | MCP endpoints (already ruled, T1 §2.3) + read-only SQL views for aggregate/published data + `.md` twins of public pages. Raw party data stays behind the blindness boundary regardless of surface. |

## Analytics & measurement

| Thing | Status | Decision |
|---|---|---|
| Web analytics | **LEANING** (venture docs) | Umami self-hosted or Plausible — cookie-banner-free. No GA4. |
| Product events | **LEANING** (updated 19 Aug with stack proposal v2) | Events as a plain Postgres table; aggregates as SQL views. Scorecard agent reads via a read-only connection or a nightly sqlite export to the library scope (venture docs' original shape — keep whichever proves simpler). No Mixpanel/Amplitude. |
| Revenue truth | RULED (venture docs) | Stripe (or MoR) is the database; never duplicate. |
| Attribution | RULED (T1 §2.7) | Share-link ref codes on every shared result; completed reconciliations = the activation metric. |
| Resilience | RULED (venture docs) | Sentry free tier, uptime ping, backups. |

## Design

| Thing | Status | Decision |
|---|---|---|
| Design language | **OPEN — candidates live, brief captured** | Five candidates on the design canvas (A Terminal / B Contract Note / C Referee / D Overlap / E Instrument). Operator brief in `docs/design-brief.md` (19 Aug 2026): likes gamified design + neumorphism trends; neutral-SaaS references Stripe/Smallpdf/Trello/DocuSign; leaning toward viscerally engaging spatial motion / 3D / canvas as the differentiator. Constraints: one language, early, not typical-AI, WCAG 2.1 AA, Al rules personally. |
| A11y target | RULED (carried from March design, unchallenged) | WCAG 2.1 AA. |

## Process & conventions

| Thing | Status | Decision |
|---|---|---|
| Planning | RULED | Tiered methodology (T1→T3 + Mn) in `planning/`, APV-tracked, capture-before-commit, audit-before-acceptance via Codex delegate. |
| Plan style | RULED (19 Aug 2026, T1 §5) | Every plan opens with a plain-language "Human summary" section; the rest is the agent report (humane dual-audience convention). |
| Business/technical split | RULED (19 Aug 2026) | Business/GTM in the ExFu library scope (Dropbox, no APV yet); technical in this repo. Reference, never repeat. |
| Engine verification | RULED (T2-engine §4) | Golden vectors from the prototype + generative property tests. |
| vwpa prior art | **OPEN** (T1 Q4, deferred pending stack ruling) | Engine port = salvage. Under stack proposal v2 (Supabase back in): the March design's *data thinking* (schema shape, RLS/party-isolation approach, auction lifecycle, engine-extraction plan) transfers well; its Next.js-specific scaffolding does not (framework changed). Verdict trend: design-doc yes, code no. |
