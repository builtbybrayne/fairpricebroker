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
alerts, uptime checks, backups, cost caps. Two rules sharpened by review:
our error-reporting tools must never be allowed to ship people's price
numbers to a third party, and payment notifications must be treated like
bank statements — verified, deduplicated, and reconciled — so nobody gets
free or lost credit. Three decisions need Alastair — at the bottom.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 5 (19 Aug 2026). Inherits T1 §2 by
> reference — especially §2.5 (separability), §2.8 (build honestly small).
> Owns identity/authentication and backups/resilience (T1 §3). Stack
> ruled: SvelteKit + TypeScript, Supabase, MoR payments leaning Stripe
> Managed Payments (T1 §5 Addenda 2–3).
>
> Revised 19 Aug 2026 addressing Codex audit round 1 (verdict: revise;
> 2 high / 3 medium / 1 low — return at
> `.exfu/returns/t2-platform-audit-r1.json`).

## 1. Why (theme intent)

The platform exists to keep the promises the other themes make: available
(uptime), private (auth tiers and leak-proof observability), affordable
($0 pre-revenue path), sellable (every asset product-owned and
transferable), and honest about failure (boring resilience over
infrastructure ambition).

## 2. How — architectural principles

1. **One deployable.** The SvelteKit app carries pages, API routes, and
   the MCP endpoint; Supabase carries data/auth; the nightly job is the
   only scheduled compute. No queues, no clusters, no second service until
   a measured need exists.
2. **Authentication is a principal contract, not a login list.** The
   principals and what this layer asserts about each to T2-data-layer:
   - *anonymous* (casual): an ephemeral visit identifier; no account; may
     own nothing persistent except attribution correlation.
   - *invitee* (invited sessions and survey respondents): a one-time
     email-link principal bound to one role in one session; stable
     identifier = the invite grant, not an account; never pays.
   - *account* (creators and commissioners): magic link and/or Google
     OAuth; stable user id; holds history, defaults, and the credit
     balance. Creating invited/survey sessions requires this principal.
   - *org member/admin* (org plumbing, milestone-scheduled): OAuth-required
     account plus org membership claims; shared credit pool.
   - *developer*: a server-granted database role bound to named operator
     accounts; never self-selectable, invisible in user-facing surfaces
     (re-adopted, T1 Q4).
   This layer authenticates and passes verified principal + claims;
   role authorisation against data is T2-data-layer's matrix. Token
   lifecycle is defined: expiries per tier, refresh rules, immediate
   revocation honoured per-request; account linking (same email arriving
   by magic link and OAuth) merges only on proof of possession of both.
   **Anonymous-to-account upgrade** carries forward only artefacts the
   upgrading principal solely owns (their attribution trail, their own
   drafts): a casual co-present session contains BOTH subjects' data and
   is therefore never attached to either upgrader's account.
3. **Money enters only through the MoR checkout, over a provider-neutral
   seam.** Purchases run through the merchant-of-record's hosted checkout
   (Managed Payments constraint: Checkout/Payment Links only;
   subscriptions created via Checkout). The seam: a
   purchase-to-entitlement interface mapping verified provider events to
   account entitlements via the data-layer's neutral billing-reference
   table. **The launch catalogue is now ruled** (operator, 19 Aug 2026 —
   §6 R5): **credit packs only** — one-off purchases crediting the
   buyer's balance; one credit = one invited reconciliation; surveys
   priced per table × size in the same currency of credits. **No
   subscription at launch**: a subscription product is added only when
   the venture's trigger fires (>30% of pack buyers re-buying within 6
   months), as a Checkout-created product over the same seam — config,
   not rebuild. Until the company + MoR account exist, entitlements run
   on free launch credits (no checkout in the flow at all). Exact pack
   prices are business-side (venture ladder ~£9.99/10 as the working
   sketch). The MoR is the revenue system of record (never duplicated);
   the product-owned account is transferable (separability).
4. **Webhooks are treated as untrusted bank statements.** The receiver:
   verifies provider signatures; is idempotent, keyed on the provider's
   immutable event id (stored in the billing-reference table);
   tolerates replays and out-of-order delivery (entitlement adjustments
   are ordered by provider event time, not arrival); handles refund and
   chargeback events as first-class entitlement reversals; retries with
   backoff into a visible dead-letter state (scorecard-surfaced, never
   silently dropped); and is reconciled periodically against the MoR's
   own records, with drift surfaced as a scorecard line.
5. **Observability never exfiltrates.** Error tracking, logs, traces,
   alerts, uptime checks, and health responses operate under a
   scrub-before-egress contract: allowlisted metadata and opaque
   identifiers only — never raw price inputs, tuples, PII, invite or auth
   tokens, or payment payloads, in any field including exception messages
   and request bodies (default body capture disabled). This is T1 §2.4
   applied to vendors: a third-party error tracker is a disclosure
   channel unless bound. Leakage fixtures are part of verification.
6. **Backups are platform-owned end-to-end.** The backup contract:
   T2-data-layer hands this layer one encrypted dump artefact per day
   (its content is data-layer's; see its §2.9 interface); this layer owns
   the scheduler, credentials, and the **product-owned offsite target**
   (separability: transferable with the Newco), retention/expiry schedule
   (aligned with the data-layer's purge-ageing rule), freshness
   monitoring (scorecard checks last-dump age), and recovery objectives:
   RPO 24h (the nightly cadence), RTO one working day, with a
   restore-plus-tombstone-replay rehearsal before launch and after any
   schema overhaul.
7. **Transactional email from the product domain** via a Postmark-class
   provider (venture ruling): invites, one-time codes, results
   notifications, lifecycle nudges. Marketing email is out of scope here
   (business-side owns it); the sending domain and its reputation are
   product assets. SPF/DKIM/DMARC green before any invite ships.
   **Deliverability guardrails** (operator ruling, 19 Aug 2026): invite
   sends are capped per session (default 50 recipients — a survey invite
   list is not a mailing list) and per account per day; bounce and
   spam-complaint rates are monitored with auto-pause thresholds
   (complaints >0.1% pause invite sending, mirroring the venture's
   outreach thresholds); all invite mail goes through the transactional
   provider, never raw SMTP.
8. **Cost ceiling pre-revenue: ~£0/month** (Supabase Free, free-tier
   hosting and resilience, free-tier email volume). Spend caps and
   billing alerts on everywhere they exist. Any change introducing a
   recurring cost >£10/month needs an operator decision.
9. **Environments:** local dev against local Supabase; one production
   project; no staging until the paid layer exists (honestly small).
   Branch preview deploys, if the host offers them free, are
   **credential-isolated**: previews never receive production secrets and
   cannot reach the production database — they run against local/test
   backends or render static-only; integration E2E runs against
   local/test-mode dependencies.

## 3. What — components

1. **Hosting/deploy**: SvelteKit adapter + CI deploy from `main` (the APV
   gate already protects main); credential-isolated previews per §2.9.
2. **Auth integration**: the §2.2 principal contract on Supabase Auth —
   anonymous flow, OTP email codes, magic link + Google OAuth, org
   claims, account-linking rules, upgrade path, revocation.
3. **Billing seam**: MoR account setup (eligibility outcome per Q3),
   checkout hand-off, the §2.4 webhook receiver → billing-reference
   table → entitlement interface, reconciliation job, VAT-invoice
   surfacing (the MoR's artefact — we link to it).
4. **Email service**: provider account on the product domain,
   SPF/DKIM/DMARC, templated transactional sends per lifecycle event.
5. **Resilience kit**: error tracking under the §2.5 scrubbing contract,
   health route (status only, no internals), external uptime monitor,
   backup pipeline per §2.6, spend caps and billing alerts.
6. **Web analytics**: cookie-banner-free analytics (Q2) wired to
   attribution refs where possible, under the same no-PII egress rule.

## 4. Verification approach (binding on T3s)

- Auth matrix E2E: each session type reachable exactly at its tier, never
  below; token expiry/revocation honoured per-request; account-linking
  requires both proofs; upgrade never attaches co-present casual data.
- Webhook contract tests in the provider's test mode: signature-invalid
  rejected; duplicate and out-of-order events idempotent; refund and
  chargeback reverse entitlements; dead-letter path visible;
  reconciliation detects an injected drift.
- Observability leakage fixtures: seeded requests containing fake tuples,
  emails, and tokens produce error events, logs, and health responses
  free of every seeded value.
- Backup drill: nightly artefact lands offsite; scorecard flags a stale
  dump; restore + tombstone replay rehearsed against a scratch project,
  meeting the stated RPO/RTO.
- Deliverability: SPF/DKIM/DMARC checks green before invite E2E runs.

## 5. Open questions (HITL)

- **Q1 — host: Vercel or Cloudflare?** Both free-tier friendly with
  SvelteKit adapters. Vercel: most conventional, best DX. Cloudflare:
  faster/cheaper at the edge, tighter limits on some Node APIs. Leaning
  Vercel for v1 (fewest surprises), revisit at scale.
- **Q2 — web analytics: Plausible (~£9/mo) or self-hosted Umami (free,
  small ops burden)?** Interacts with the £0 pre-revenue ceiling. Leaning
  Umami on a free host until revenue, Plausible when £9 is noise.
- **Q3 — Managed Payments application timing.** Apply for Stripe Managed
  Payments now (risk: review friction pre-launch) or at paid-layer build
  (risk: late rejection forces the Paddle fallback under time pressure)?
  Leaning: apply early, build nothing against it until approved.
- **Q4 — backup offsite target** (absorbed from T2-data-layer per audit):
  which product-owned object store holds the nightly dumps (e.g. a
  Cloudflare R2 or Backblaze B2 bucket in the Newco's name)? Leaning: R2
  if Cloudflare hosting is chosen, else B2 — either ~£0 at this volume.

## 6. Rulings (19 Aug 2026, operator, in-chat)

- **R1 (Q1 — host): RULED — Vercel** for v1; revisit at scale.
- **R2 (Q2 — analytics): RULED — self-hosted Umami** until revenue;
  Plausible when £9/month is noise.
- **R3 (Q3 — Managed Payments application): DEFERRED by operator.**
  Blocked on business prerequisites (no company set up yet — the Newco
  question, business-side). Intent recorded: apply as soon as the entity
  exists; build nothing against it until approved; Paddle remains the
  fallback.
- **R4 (Q4 — backup target): RULED — Backblaze B2** (follows the Vercel
  ruling; product-owned bucket in the Newco's name once it exists,
  personal-but-transferable until then).
- **R5 — launch catalogue ruled** (operator, 19 Aug 2026): credits only
  at launch (creator-pays-per-reconciliation; free launch credits until
  the MoR exists); subscription deferred to the second-pack-rebuy
  trigger. Session shapes restructured accordingly (T2-product-surfaces
  §6 R3): invitees never authenticate beyond the invite grant, so the
  former "email-verified quick" principal generalises to the *invitee*
  principal above.
