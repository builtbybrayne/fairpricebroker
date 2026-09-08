---
id: T3-m1-recruitment-core
plan_kind: thematic
tier: 3
t2_parent: T2-product-surfaces
milestone: M1-working-instrument
status: active
---

# T3 — M1 recruitment core: the invited reconciliation, recruitment template

## 0. Human summary (plain language)

**The real product, for recruiters.** A recruiter signs in, starts a
reconciliation, enters the client's salary budget as four numbers, and
gets a private link to send the candidate. The candidate opens it, is
told plainly that the recruiter will see their answers and why naming a
lower figure helps them, answers four questions, and is done. When both
sides are in, the server works out the fair salary and whether there's
overlap. The recruiter sees both sets of numbers, the overlap level
(in range / stretch / no overlap) and whether non-salary factors need to
be in play. The candidate sees their own range, the fair figure, and the
overlap level — never the client's numbers.

---

> Parent: `T2-product-surfaces` (§2.1–2.10, §3.2–3.4, §7 R7–R9, §9 R11).
> Milestone: `M1-working-instrument` item 5 (invited reconciliation, one
> composition). Depends on: `T3-m1-data-core` (schema, guarded functions,
> payload constructor, orchestrator), `T3-m1-platform-naive-auth`
> (sign-in, credits, `/join`), `T3-m1-engine-port`. Design authority:
> `docs/design-brief.md` (The Instrument) and the surface briefs written
> under `.impeccable/` during the picture-first comp rounds.
>
> Drafted 8 Sep 2026 under the operator's same-session pre-acceptance;
> council-reviewed by Claude sub-agents, no Codex audit.

## 1. The recruitment composition (binding modelling decision)

T1 Addendum 7 / T2-product-surfaces §7 R7: the recruiter is the **host**
of a host-visible session and needs both parties' numbers. The buildpad
demo spec and value hypothesis: the recruiter also **enters the
employer's budget** — the hiring company is represented by the
recruiter, not invited. Modelled as:

- `sessions.composition = 'creator-as-host'`, `template_id =
  'recruitment'`, `host_visibility = 'host-visible'` (resolved
  server-side from the template map, data-core §2.5).
- The creator gets TWO `session_participants` rows in the creation
  transaction: `is_host = true` AND `direction = 'low-preferring'`
  (the employer side wants to pay less). **Extension to data-core's
  `create_invited_session`:** when `composition = 'creator-as-host'`
  and `creator_direction` is non-null, insert both rows and require
  exactly ONE invite grant (the other direction). When
  `creator_direction` is null the existing two-grant rule stands.
  `session_role_for` then resolves the recruiter's direction and
  `is_session_host` is true; `resolveInvitedViewer`'s precedence
  (host > party) issues the **host-full** class — no constructor change.
- The candidate is the `high-preferring` party via one email-bound,
  single-use invite grant.

Recorded as **Deviation D1** against T2-product-surfaces §2.10's "a
creator-as-host issues exactly TWO party grants": the recruitment
template's host also holds a direction, so it issues one. Party-to-party
disclosure stays forbidden (the candidate never sees the client
numbers); the host-full class is exactly R7's intent.

## 2. Template content — `src/lib/templates/recruitment.ts`

Templates are configuration (T2-product-surfaces §2.5). Shape:
```typescript
export const recruitmentTemplate = {
  id: 'recruitment',
  name: 'Salary alignment',
  hostVisibility: 'host-visible',
  currencyDefault: 'GBP',
  unit: 'annual salary',
  roles: {
    'low-preferring': { label: 'Employer budget', enteredBy: 'host' },
    'high-preferring': { label: 'Candidate', enteredBy: 'invitee' }
  },
  questions: {
    'low-preferring': [/* four employer-budget prompts, ascending */],
    'high-preferring': [/* four candidate prompts, ascending */]
  },
  disclosure: { /* R11 binding copy: the recruiter will see your figures */ },
  incentive: { /* load-bearing copy: why naming a lower floor helps you */ },
  guidance: (zone) => ({ overlap: 'in-range'|'stretch'|'no-overlap',
                         nonRemunerationInPlay: boolean, hostCopy, partyCopy })
} as const;
```
Guidance map (R9): `comfort` → in-range, non-remuneration not required;
`deal` → stretch, non-remuneration factors likely in play; `no-deal` →
no overlap, non-remuneration factors must be meaningfully in play or
the placement is unlikely. Candidate-facing copy for each, without the
client's numbers. Exact wording is authored during the comp round and
lives in this file, not in components.

## 3. Routes and surfaces

- `src/routes/app/+page.svelte` — dashboard: balance, session list
  (state badge, candidate email, created date), "New salary check".
- `src/routes/app/new/+page.server.ts` — action: candidate email +
  currency (default GBP) + optional role title → request key (UUID) →
  `reserveAndDebitLaunchCredit` → `create_invited_session('recruitment',
  currency, 'creator-as-host', visitId, 'low-preferring',
  [{ role: 'high-preferring', email }])` → on failure `release` → redirect
  `/app/s/{id}`.
- `src/routes/app/s/[id]/+page.svelte` — the recruiter's session page,
  one route, state-driven:
  1. **Enter the budget**: four-point meter entry (shared `Meter`
     component family from the casual brief, `PartyEntry`), save-position
     and submit (`submit_position`).
  2. **Send the link**: the plaintext `/join/{token}` URL shown once with
     a copy control, plus the candidate email; "we haven't emailed it —
     send it yourself". The token is returned by `create_invited_session`
     and held in the recruiter's page state; it is not re-displayable
     after navigation (the hash is all we store) — the page says so and
     offers "issue a new link" only if the invite is unredeemed
     (revokes + reissues, one transaction, out of scope if time-boxed:
     fall back to "start a new check").
  3. **Waiting**: candidate status (invite opened / submitted), recall
     control while the candidate hasn't submitted.
  4. **Result** (`closed`): host-full payload via `constructInvitedPayload`
     → both ranges convergence animation (permitted: host-visible),
     fair salary, overlap level, non-remuneration steer, both tuples
     behind a "show the numbers" toggle (default hidden, mirroring R6),
     the two safety panels "what the candidate sees".
- `src/routes/s/[id]/party/+page.svelte` — the candidate's surface,
  reached only via `/join`: **pre-entry disclosure** (R11; from
  `getVisibilityDisclosure`) + incentive copy → four-question entry →
  submit → "sealed" confirmation → on `closed`, the party payload:
  own range + fair figure + overlap level + candidate guidance copy,
  blindness-safe reveal variant (own range and the fair price landing).
- Lock → compute: the submit action inspects `submit_position`'s return;
  on `'locked'` calls `claimAndOrchestrate(sessionId)` before returning.

## 4. Verification

- **V1 (e2e, two browser contexts)** — recruiter signs in, creates a
  check (balance 20→19), enters budget, copies link; candidate context
  opens link, sees the disclosure and incentive copy BEFORE any input,
  enters four values, submits; recruiter page reaches result with both
  tuples (after toggle), fair salary, overlap label; candidate page shows
  own range + fair figure + overlap label.
- **V2 (payload safety)** — the candidate DOM never contains any of the
  four employer figures at any state; the recruiter DOM does not contain
  the candidate figures until the toggle.
- **V3** — recall: candidate submits, recruiter has not; candidate
  recalls and re-submits; only then lock. Recruiter cancel before both
  submitted → `cancelled` page for both.
- **V4** — a blind template session (fixture, `generic`) issues host-safe,
  never host-full, and renders no pre-entry disclosure (R11 negative).
- **V5** — precision: 4-d.p. salary entry survives to both result views.
- PASS: unit + e2e green with V1–V5 named; capture per §6.

## 5. Out of scope

Survey mode, org plumbing, custom templates, checkout, the agent
doorway adapters (the route handlers are written as thin adapters over
server functions so the doorway can wrap them), real email, the
recruitment guided demo (`T3-m1-recruitment-demo`), Umami.

## 6. Capture and commit

`feat(recruitment): invited salary reconciliation with host-full result and candidate disclosure`
