---
id: T2-platform
plan_kind: thematic
tier: 2
status: draft
---

# T2-platform — plumbing, identity, money, resilience

## 0. Human summary (plain language)

**This is the blueprint for the unglamorous machinery:** where the app
runs, how people sign in (four levels, from "no account at all" to "company
login"), how money will be taken when the paid layer arrives (a
merchant-of-record checkout so international tax is somebody else's
problem), the emails the product sends, and the safety nets — error
alerts, uptime checks, backups, cost caps. The guiding rule: everything
here should cost close to nothing before revenue and never surprise us.
Three decisions need Alastair — at the bottom.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 5 (19 Aug 2026). Inherits T1 §2 by
> reference — especially §2.5 (separability), §2.8 (build honestly small).
> Owns identity/authentication (T1 §3). Stack ruled: SvelteKit +
> TypeScript, Supabase, MoR payments leaning Stripe Managed Payments
> (T1 §5 Addenda 2–3).

## 1. Why (theme intent)

The platform exists to keep the promises the other themes make: available
(uptime), private (auth tiers), affordable ($0 pre-revenue path), sellable
(every asset product-owned and transferable), and honest about failure
(boring resilience over infrastructure ambition).

## 2. How — architectural principles

1. **One deployable.** The SvelteKit app carries pages, API routes, and
   the MCP endpoint; Supabase carries data/auth; the nightly job is the
   only scheduled compute. No queues, no clusters, no second service until
   a measured need exists.
2. **Auth tiers map to session types** (T2-product-surfaces §2.3): casual
   = none; quick = email one-time codes; direct = magic link + Google
   OAuth; org = OAuth required. All via Supabase Auth — one vendor, no
   passwords stored by us, anonymous-to-registered upgrade preserves a
   user's history.
3. **Money enters only through the MoR checkout.** Purchases (credit
   packs, subscriptions when the paid layer lands) go through the
   merchant-of-record's hosted checkout (Managed Payments constraint:
   Checkout/Payment Links only; subscriptions created via Checkout).
   Webhooks write to the credit ledger (T2-data-layer); the app never
   touches card data; the MoR is the revenue system of record (T1 §2.7 —
   never duplicate it). Product-owned account, transferable (separability).
4. **Transactional email from the product domain** via a Postmark-class
   provider (venture ruling): invites, one-time codes, results
   notifications, lifecycle nudges. Marketing email is out of scope here
   (business-side owns it); the sending domain and its reputation are
   product assets.
5. **Boring resilience, all free tiers:** error tracking (Sentry-class),
   an external uptime ping on the landing page and API health route, the
   nightly `pg_dump` (T2-data-layer §2.7), Supabase spend caps on,
   provider billing alerts on. Every alert lands in the weekly scorecard;
   only pages that mean "product is down for users" may interrupt a day.
6. **Environments:** local dev against a local Supabase; one production
   project. No staging until the paid layer exists (honestly small); the
   free casual mode is the de-facto canary.
7. **Cost ceiling pre-revenue: ~£0/month** (Supabase Free, free-tier
   hosting, free-tier resilience; the only near-certain cash cost is the
   transactional email provider's ~free tier and the domain already
   owned). Any change that introduces a recurring cost >£10/month needs an
   operator decision.

## 3. What — components

1. **Hosting/deploy**: SvelteKit adapter + CI deploy from `main` (gate
   already protects main); preview deploys per branch if the host offers
   them free.
2. **Auth integration**: Supabase Auth wiring for the four tiers,
   anonymous casual flow, session-to-account upgrade path, org OAuth.
3. **Billing integration point**: MoR account setup (eligibility check!),
   product catalogue mapping (credit packs, subscription), checkout
   hand-off, webhook receiver → ledger, VAT-invoice surfacing to buyers
   (the MoR's job — we link to it).
4. **Email service**: provider account on the product domain,
   SPF/DKIM/DMARC, templated transactional sends per lifecycle event.
5. **Resilience kit**: error tracking, health route, uptime monitor,
   backup verification (the scorecard checks last-dump age), spend caps.
6. **Web analytics**: cookie-banner-free analytics (Umami or Plausible —
   Q2) wired to attribution refs where possible.

## 4. Verification approach (binding on T3s)

- Auth-tier matrix E2E: each session type reachable exactly at its tier,
  never below it.
- Webhook contract tests with the MoR's test mode: purchase → ledger row →
  quota effect; failure/refund paths.
- Deliverability check on the sending domain (SPF/DKIM/DMARC green) before
  any invite email ships.
- Kill-the-database drill: health route degrades honestly; uptime monitor
  fires; restore-from-dump rehearsed once before launch.

## 5. Open questions (HITL)

- **Q1 — host: Vercel or Cloudflare?** Both free-tier friendly with
  SvelteKit adapters. Vercel: most conventional, best DX. Cloudflare:
  faster/cheaper at the edge, tighter limits on some Node APIs. Leaning
  Vercel for v1 (fewest surprises), revisit at scale.
- **Q2 — web analytics: Plausible (~£9/mo) or self-hosted Umami (free,
  small ops burden)?** Interacts with the £0 pre-revenue ceiling. Leaning
  Umami on a free host until revenue, Plausible when £9 is noise.
- **Q3 — Managed Payments eligibility timing.** Apply for Stripe Managed
  Payments now (risk: review friction pre-launch) or at paid-layer build
  (risk: rejection late forces the Paddle fallback under time pressure)?
  Leaning: apply early, build nothing against it until approved.
