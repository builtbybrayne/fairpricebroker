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
| Legal entity | **RULED** (20 Aug 2026, T1 §5 addendum 6) | Start inside **WhaleyBear Ltd**; Newco incorporated on a hair trigger — ANY evidence of desire (first paying customer, pilot commitment, acquirer interest). Separability discipline + written IP record inside WhaleyBear keep the eventual assignment cheap. Unblocks the Stripe MoR application (timing: as the paid phase approaches). |

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
| Backend / data | **RULED** (19 Aug 2026, operator: "supabase accepted") | **Postgres, managed via Supabase**. Why it is the best fit: the domain is relational (auctions/parties/invites/orgs, an append-only credit ledger); NUMERIC gives true arbitrary-precision money (T2-engine R2 ruling: 3–4+ d.p. legitimate); the N≥20 aggregate layer is plain SQL views; row-level security gives defense-in-depth under the blindness rule; and for agent access SQL is the lingua franca — aggregates exposable as read-only views/APIs, pgvector available if semantic search over the corpus is wanted later. Supabase adds managed Auth (magic link / OAuth / OTP email tokens — all four tiers) without a second vendor. (Firebase default withdrawn by operator: fluency removed as a criterion; Firestore's float-only numbers alone now disqualify it against the precision ruling.) **Cost path (19 Aug 2026): $0 pre-revenue** — build and launch on the Free tier (500MB DB, 50k MAU auth); the free tier's pause-after-7-idle-days never triggers because the nightly analytics export is daily DB activity; the free tier's missing backups are covered by a nightly `pg_dump` folded into that same export job. Upgrade to Pro ($25/mo) at first paying customers — it self-funds. Fallback $0 option if pause-risk ever worries: Neon free tier (serverless Postgres, auto-wake, no manual unpause) + Auth.js in SvelteKit — two vendors' jobs in-app instead of one. Firebase+Postgres amalgam rejected: Firebase's own Postgres (Data Connect) runs on Cloud SQL at ~$10+/mo minimum, and pairing Firebase Auth with a separate Postgres adds a vendor for nothing Supabase Free doesn't already do. |
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
| Design language | **RULED** (19 Aug 2026, operator) | **E — The Instrument**: Stripe-calm neutral shell; the meter as a tactile neumorphic instrument; gamified flow-progress (completion feedback, never points); the convergence reveal as living canvas animation ("the maths is the motion"). Fonts Sora + Albert Sans; palette on the canvas board. **Binding blindness constraint on the animation** (operator, same ruling): showing BOTH parties' ranges converging is only permitted in non-blind modes (casual / co-present / the viral partner toy). In blind brokerings the reveal must be blindness-safe — e.g. the viewer's own range + the fair price landing, or an abstract convergence that encodes no counterparty positions. The animation *principle* is accepted; per-mode variants are a T2-product-surfaces obligation. Brief and references: `docs/design-brief.md`. |
| A11y target | RULED (carried from March design, unchallenged) | WCAG 2.1 AA. |

## Process & conventions

| Thing | Status | Decision |
|---|---|---|
| Planning | RULED | Tiered methodology (T1→T3 + Mn) in `planning/`, APV-tracked, capture-before-commit, audit-before-acceptance via Codex delegate. |
| Plan style | RULED (19 Aug 2026, T1 §5) | Every plan opens with a plain-language "Human summary" section; the rest is the agent report (humane dual-audience convention). |
| Business/technical split | RULED (19 Aug 2026) | Business/GTM in the ExFu library scope (Dropbox, no APV yet); technical in this repo. Reference, never repeat. |
| Engine verification | RULED (T2-engine §4) | Golden vectors from the prototype + generative property tests. |
| vwpa prior art | **RULED** (19 Aug 2026, T1 §5 addendum 4) | Re-adopted as requirements: four session types, lifecycle state machine (incl. first-submitter-recall asymmetry), host safety panels, invite model, hidden developer-audit role, Postgres RLS isolation approach. Re-derived fresh: all visuals (The Instrument), pricing/tiers, recruiter-specific assumptions. Code is not reused; the design doc's listed decisions are. |
| Build order | **RULED** (19 Aug 2026, T1 §5 addendum 4) | Two-party reconciliation first (thesis, activation metric, landing page); founder survey mode fast-follows before launch week. |
| Session shapes & commercial model | **RULED** (19 Aug 2026, T2-product-surfaces §6 R3 + T2-platform §6 R5) | Three shapes: casual (free, ephemeral, co-present demo) · invited (creator holds account, pays per reconciliation via credits; invitee always free/account-less) · survey (commissioner pays per table × size). Org = shared-credit-pool account plumbing, milestone-scheduled. Credits ONLY at launch (free launch credits until Newco + MoR exist); subscription added only on the second-pack-rebuy trigger (>30% within 6 months). Supersedes the March design's four session types. |
| Agent/human parity | **RULED — standing sequencing law** (20 Aug 2026, T2-agent-distribution R3) | Every human-facing capability ships its agent (MCP/HTTP) access in the SAME milestone; a milestone with a red parity suite is not done. |
| Casual blind handover | **RULED** (20 Aug 2026, T2-product-surfaces R5) | Casual co-present flow uses pass-the-device choreography (enter → confirm-and-hide → hand over → enter → "both look" → reveal); entered figures never re-displayed outside the outcome view. |
| Invite email guardrails | **RULED** (19 Aug 2026, T2-platform §2.7) | ≤50 invite recipients per session by default (raise = operator-granted); per-account daily caps; complaint rate >0.1% auto-pauses invite sending; transactional provider only. |
