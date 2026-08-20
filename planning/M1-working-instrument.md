---
id: M1-working-instrument
plan_kind: milestone
milestone_index: 1
status: draft
---

# M1 — The Working Instrument

## 0. Human summary (plain language)

**Milestone 1 = the real product works, end to end, on the real domain.**
Two strangers can complete a blind reconciliation at fairprice.broker —
account for the creator, email link for the invitee, sealed entries, the
fair-price reveal — and anyone can play with the casual demo on the
homepage. Nothing about money (launch credits are free), nothing about
surveys, nothing about AI doorways, no marketing. When M1 is done, the
sentence *"try it — send someone a link"* is true.

## 1. Why this cut

The venture's activation metric is **completed two-party reconciliations**
— nothing else counts until that number can move. Two-party-first is ruled
(T1 Q2); the free-launch-credit phase is ruled (no checkout exists in this
milestone at all); and everything here is unblocked today — no company, no
MoR approval, no business prerequisite gates any M1 item.

## 2. In scope (drawn from the live T2s; each becomes one or more T3s)

1. **Scaffold** — SvelteKit + TS app, product-owned Supabase project,
   Vercel deploy from `main`, CI, credential-isolated previews, local dev
   environment. *(T2-platform)*
2. **Engine, reconciliation inflection only** — pure TS port of the
   prototype maths with golden vectors + property tests; honesty-signal
   instrumentation; version metadata. Survey maths is NOT in M1.
   *(T2-engine)*
3. **Data core** — schema with metadata snapshots and NUMERIC money; the
   deny-by-default authorisation matrix (RLS + guarded transitions);
   the payload constructor with field classes; events + attribution +
   idempotent completion events; nightly job skeleton (export + encrypted
   dump to B2; aggregate views exist but publish nothing at M1 volumes).
   *(T2-data-layer)*
4. **Casual mode on the landing page** — The Instrument design language,
   stateless server computation, full-detail reveal animation, shareable
   result card with ref codes, zero signup. *(T2-product-surfaces)*
5. **Invited reconciliation end-to-end** — creator accounts (magic link +
   Google), free launch credits (idempotent grant; balance visible; no
   checkout anywhere), email-bound single-use invites via the
   transactional provider (SPF/DKIM/DMARC green; caps + auto-pause wired),
   both compositions (creator-as-party, creator-as-host with safety
   panels), full lifecycle contract, blind-safe reveal, no-deal view.
   *(T2-product-surfaces, T2-platform)*
6. **Resilience floor** — error tracking under the scrubbing contract,
   uptime ping, backup pipeline with one rehearsed restore, spend caps.
   *(T2-platform)*
7. **Legal floor** — privacy policy + ToS pages (salary data, blindness,
   anonymised-aggregate reservation, quick-session disclosure line), ICO
   registration confirmed (WhaleyBear). *(business-side words, repo-side
   pages)*

## 3. Explicitly NOT in M1 (parked, not killed)

Survey mode (M2 — ruled fast-follow before launch) · MCP/agent doorway +
OpenAPI + `.md` twins + llms.txt (M2 — "agent-native at launch", not at
M1) · checkout/credit purchase (needs MoR; entitlements stay
free-launch-phase) · org plumbing · custom template authoring · the
consumer-toy template and viral campaign · directory listings, methodology
page, launch week (M3) · Umami analytics MAY slip to M2 without failing M1
(product events already land in Postgres).

## 4. Definition of done (all must hold on production)

1. A real pair, on different devices, completes a blind invited
   reconciliation end-to-end; neither could see the other's numbers at any
   point (payload-safety tests green, adversarial RLS suite green).
2. A visitor completes a casual reconciliation on the homepage in under
   60 seconds, and its anonymous completion event lands with its ref code.
3. The activation query returns a correct count of completed
   reconciliations, attributable from share-link entry.
4. Engine golden vectors and property tests pass; results carry version
   metadata.
5. One backup restore rehearsal has succeeded (dump → scratch project →
   tombstone replay).
6. Invite email lands in a normal inbox (not spam) from the product
   domain; the 51st recipient is refused.
7. Privacy policy and ToS are live; ICO registration confirmed.

## 5. Sequencing sketch beyond M1 (context, not commitment)

- **M2 — The Suite & the Doorway**: survey mode end-to-end; MCP/HTTP
  agent doorway over the capability catalogue; discovery artefacts;
  Umami if slipped.
- **M3 — Launch-Ready**: methodology page + cornerstone content,
  directory listings, toy template + shareable campaign surface, polish
  pass, launch-week execution (business-side leads, repo supports).
- Checkout/paid phase and the subscription trigger live OUTSIDE this
  sketch — they gate on desire evidence (Newco trigger) and MoR approval,
  not on a milestone.

## 6. Open questions (HITL)

- **Q1 — is the legal floor (item 7) genuinely M1?** It gates real
  strangers using the blind flow, but drafting policy words is
  business-side work. Leaning: yes, M1 — an unlaunched tool holding
  strangers' salary expectations without a privacy policy is not
  "working".
