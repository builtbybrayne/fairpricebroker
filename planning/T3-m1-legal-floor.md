---
id: T3-m1-legal-floor
plan_kind: thematic
tier: 3
t2_parent: T2-product-surfaces
milestone: M1-working-instrument
status: draft
---

# T3 — M1 legal floor: privacy and terms pages, shared footer, disclosure lines

## 0. Human summary (plain language)

**Give the site a privacy policy and terms page, link them from every
page, and make the "nothing stored" / "stored anonymously" lines point at
the policy.** The repo can build all of that now with clearly-marked
draft wording, so the plumbing is ready the day the real words arrive
from the business side. Two things this plan cannot finish itself: the
policy text and the ICO registration, which are WhaleyBear's to do and
are listed as blockers. The site does not need a cookie banner.

> Parent: `T2-product-surfaces` (§2 principle 1; §6 R2; §9 R11).
> Milestone: `M1-working-instrument` §2 item 8, §4 DoD 7, §6 Q1.
> Depends on: `T3-m1-casual-mode` (the casual copy this plan edits),
> `T3-m1-recruitment-core` (the `/rec/[id]` disclosure panel), and
> `T3-m1-platform-hosting` §3.2 for the prod URL the pages go live on.

## 1. Why this shape

- Static pages, not a CMS: `src/routes/method/+page.svelte` is the
  proven pattern (one `<main>`, `<svelte:head>` title, scoped styles on
  the design tokens). Copy it.
- The footer moves into `src/routes/+layout.svelte` so `/privacy` and
  `/terms` are reachable from every route (T1 §2.4 permits data-subject
  access; a policy nobody can find is not a floor). Today the only
  footer is inline in `src/routes/+page.svelte` lines 230–238.
- Copy stays in one module so the business-side words can be dropped in
  by a single edit without touching markup, and a `draft` flag renders a
  visible banner until they are.
- The flow lines already exist (§2); they gain a link, not new claims.
  The payload class stays the sole disclosure authority (T2 §2.1): the
  policy describes; it never decides what a party sees.

## 2. Environment facts

- Existing disclosure copy, verbatim (edit targets in §3.4):
  - `src/routes/+page.svelte:84` meta "…Free, sixty seconds, nothing
    stored."; `:108` "free · 60 seconds · nothing stored"; `:182` "Two
    people, one phone. Nothing you type is kept."; `:194` "On this free
    version nothing you type is kept."; `:237` footer note "Your numbers
    stay private. This free instrument keeps no prices."
  - `src/lib/client/casual/OutcomeReveal.svelte:174` "Nothing you
    entered was stored."; `CasualFlow.svelte:287` "…nothing was stored
    either way."
  - `src/routes/join/[token]/+page.svelte:18–19` "Your email is only used
    so the recruiter knows who answered; nothing is sent to it."
  - `src/routes/rec/[id]/+page.svelte:70–80` renders the R11 panel from
    `src/lib/templates/salaryNegotiation.ts:195–202` ("Who sees your
    answers") when `showDisclosure` is true (`+page.server.ts:58`).
  - `src/routes/signin/+page.svelte:17` "No password, nothing sent."
- **No standing R2 line exists yet** on invited surfaces ("anonymised
  session data is stored long-term for analysis"). This plan adds it.
- **Cookies:** `src/hooks.server.ts` only wires `createRequestSupabase`;
  the sole cookies are the Supabase auth session
  (`src/lib/server/auth/supabaseServer.ts:11`, `httpOnly`, `sameSite:
  lax`). No analytics, no third-party scripts (`grep -rni cookie src`
  confirms). Strictly-necessary only, so no consent banner (PECR reg 6(4)).
- Design tokens: `src/app.css` `:root` (`--navy`, `--slate`, `--ink`,
  `--hairline`, `--font-display`, `--font-body`); `DESIGN.md` "Navigation
  → Footer" specifies hairline top, Sora Bold wordmark, Slate links, note
  pushed right, stacks on phones.
- Library scope (read-only `ls`, 10 Sep 2026): **no privacy policy or
  ToS draft exists** under `/Users/al/Dropbox/ExFu Library/scopes/
  pricing-meter/context/`. Relevant notes only: `Analytics and Remaining
  Work Areas.md` (ICO fee ~£52/yr, "do not defer"; privacy/ToS/retention
  "do not defer"); `Entity Decision -- 20 Aug 2026.md` (ICO registration
  proceeds under WhaleyBear); `Aggregate Data Resale Layer -- 18 Aug
  2026.md` (aggregates must be declared upfront in the policy); `Global
  vs UK-First -- 17 Aug 2026.md` (UK GDPR covers EU in substance; Art. 27
  EU representative noted, parked).
- Tests: `npm run lint`, `npm run check`, `npm run test:e2e` (Playwright,
  `tests/e2e/*.e2e.ts`). No CI workflow exists yet (hosting §3.3).

## 3. Files and steps

### 3.1 `src/lib/content/legal.ts` (new) — the words, in one place

Export `legal = { updated: 'YYYY-MM-DD', draft: true, controller: {...},
privacy: Section[], terms: Section[] }` where `Section = { heading,
paragraphs: string[] }`. Seed with placeholder sections whose headings
are final and whose paragraphs begin `[DRAFT — awaiting legal-policy-text]`.
Privacy headings, fixed: Who we are (WhaleyBear Ltd, ICO number
`[ICO-PENDING]`); What we collect (casual: none beyond an anonymous
completion event; invited: email, four figures, reconciliation
metadata); Why and on what basis; Who sees what (blindness; host-visible
verticals per R11); Anonymised aggregates (only ever at N≥20, T1 §2.4);
Retention; Your rights (access/export/erasure; contact address);
Cookies (auth session only); Changes. Terms headings, fixed: The
service; Accounts and credits; Acceptable use; The result is not
advice; Liability; Governing law (England and Wales); Changes.

### 3.2 `src/routes/privacy/+page.svelte`, `src/routes/terms/+page.svelte` (new)

Copy `src/routes/method/+page.svelte`'s shell and styles. Each renders
its `legal.*` sections, an `h1`, a `<p class="updated">Last updated
{legal.updated}</p>`, and when `legal.draft` a top banner
`<aside class="draft" data-testid="legal-draft">Draft wording — not yet
in force.</aside>` (terracotta text, inset panel). `<svelte:head>` titles
"Privacy — Fair Price Broker" / "Terms — Fair Price Broker". No load
function; both are prerenderable (`export const prerender = true` in a
`+page.ts`).

### 3.3 `src/routes/+layout.svelte` — shared footer

After `{@render children()}` add `<footer class="foot">` with wordmark,
`<nav aria-label="Footer">` links Method / For recruiters / Privacy /
Terms / Sign in (`resolve()` each), and `<span class="foot__note">` "©
{year} WhaleyBear Ltd". Move the `.foot*` styles from
`src/routes/+page.svelte:557–` into the layout; delete the inline footer
at `+page.svelte:230–238` and its styles. Follow DESIGN.md's footer rule.

### 3.4 Disclosure lines gain a link (no new claims)

- Casual: `OutcomeReveal.svelte:174` → "Nothing you entered was stored.
  <a href={resolve('/privacy')}>How we handle data</a>". `+page.svelte:194`
  gets the same link after "kept." Leave `:84`, `:108`, `:182`,
  `CasualFlow.svelte:287` unchanged.
- Invited (R2 standing line): add `<p class="disclosure__standing"
  data-testid="standing-disclosure">` to `src/routes/rec/[id]/+page.svelte`
  directly under `.shell__sub` at `:66`, rendered in **every** phase
  branch's `enter` state regardless of `showDisclosure`: "Your figures are
  kept for this reconciliation and, once anonymised, for analysis. See
  the <a>privacy policy</a>." Same paragraph on
  `src/routes/join/[token]/+page.svelte` under `:19`.
- Sign-in: `src/routes/signin/+page.svelte:17` append "By continuing you
  accept the <a>terms</a>."

### 3.5 Tests — `tests/e2e/legal.e2e.ts` (new)

Playwright: `/privacy` and `/terms` return 200 with their `h1`; footer
links resolve from `/`, `/method`, `/signin`; `data-testid=
"standing-disclosure"` is visible on a `/rec/[id]` enter page (reuse the
launch helper in `tests/e2e/join.e2e.ts`); `legal-draft` banner present
iff `legal.draft`.

Run: `npm run lint && npm run check && npm run test:e2e -- legal`.

## 4. Out of scope

Writing the policy/terms wording (business side, §7). ICO registration
(§7). Cookie consent banner (none needed, §2). Data-subject export or
erasure endpoints (T2-data-layer). Retention jobs. Art. 27 EU
representative. Any change to payload classes or what a party sees.
Email sending. Moving the layout footer into a component library.

## 5. Verification (binding)

- V1 `GET /privacy` and `GET /terms` return 200 on dev and prod, with
  the "Last updated" date and, while `legal.draft` is true, the draft
  banner; false hides it.
- V2 Every route's rendered HTML contains links to `/privacy` and
  `/terms` (spot-check `/`, `/method`, `/signin`, `/join/[token]`,
  `/rec/[id]`, `/app`).
- V3 `/rec/[id]` and `/join/[token]` enter pages show the standing R2
  line; the R11 panel behaviour (`showDisclosure`) is unchanged and
  `tests/e2e/join.e2e.ts` still passes.
- V4 Casual outcome shows "Nothing you entered was stored." with a
  working privacy link; `tests/e2e/casual-flow.e2e.ts` passes.
- V5 `document.cookie` after a full casual run is empty; after sign-in
  only `sb-*` auth cookies exist. Record the check here.
- V6 `npm run lint && npm run check` clean; `src/lib/content/legal.ts`
  is the only file containing policy prose.
- V7 DoD 7 closes only when both §7 blockers are cleared and
  `legal.draft` is false.

## 6. Open questions (HITL)

- **Q1 — ship draft or gate?** Recommendation: ship `/privacy` and
  `/terms` with the draft banner on dev; on prod, keep the banner until
  the words land rather than 404 the routes (a visible draft beats no
  policy). Operator to confirm.
- **Q2 — where do the words live?** Recommendation: authored in the
  library scope (`context/Legal -- Privacy and Terms -- <date>.md`), then
  pasted into `legal.ts`; the repo copy is derived, the scope is source.
- **Q3 — contact address for rights requests** — a `privacy@fairprice.broker`
  alias, or the WhaleyBear registered address? Needed before draft=false.
- **Q4 — retention figure** for invited reconciliations before
  anonymisation: the policy must state one; T2-data-layer has not fixed it.

## 7. Blockers

- **`legal-policy-text`** — waiting on: business-side drafting of the
  privacy policy and terms (UK GDPR, ICO-style plain English, covering
  salary data, blindness, R11 host-visible disclosure, the N≥20
  anonymised-aggregate reservation, the casual "nothing stored" line),
  plus answers to Q3–Q4. Clears when the words are pasted into
  `src/lib/content/legal.ts` and `draft` is set false.
- **`ico-registration`** — waiting on: WhaleyBear Ltd paying the ICO
  data protection fee and receiving a registration number
  (`Entity Decision -- 20 Aug 2026`). Clears when the number replaces
  `[ICO-PENDING]` in `legal.ts` and DoD 7's "ICO registration confirmed"
  is recorded in `M1-working-instrument`.
