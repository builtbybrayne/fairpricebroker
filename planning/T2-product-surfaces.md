---
id: T2-product-surfaces
plan_kind: thematic
tier: 2
status: active
---

# T2-product-surfaces — sessions, modes, templates, UI

## 0. Human summary (plain language)

**This is the blueprint for everything people actually see and touch:** the
pages, the meter, the invitation flow, and the moment the fair price is
revealed. There are three shapes: **casual** (two people in the same room —
the free homepage demo, nothing stored), **invited** (the real product: the
creator holds an account and spends a credit; the person they invite needs
no account and pays nothing), and **survey** (one commissioner, many
respondents, paid per table). A middleman host can see the outcome but
never anyone's numbers, and the server — not the page — decides what each
viewer may ever see, so the reveal animation cannot leak the other side's
numbers even by mistake.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 2 (19 Aug 2026). Inherits T1 §2
> principles by reference; consumes `T2-engine` result contracts. Design
> authority: `docs/design-brief.md` + the ruled design language ("The
> Instrument"). Prior-art requirements re-adopted per T1 §5 Addendum 4 (Q4).
>
> Revised 19 Aug 2026 addressing Codex audit round 1 (verdict: revise;
> 1 high / 4 medium / 1 low — return at
> `.exfu/returns/t2-product-surfaces-audit-r1.json`).

>
> **Accepted 20 Aug 2026 by Alastair** (operator ceremony, in-chat), after
> two Codex audit rounds, revisions addressing all findings, and the
> operator's session-shape restructure (§6 R3).

## 1. Why (theme intent)

The product's promise — blind, fair, fast — is delivered or broken in the
surfaces: who may see what, when things lock, and how the reveal feels. The
surfaces must make honesty comfortable (the practice's trust thesis), make
the free casual mode the marketing (T1 §2.6), and keep every vertical a
template on one horizontal core (T1 §2.2).

## 2. How — architectural principles

1. **The server-issued payload class is the sole disclosure authority.**
   Surfaces render only the role-safe payloads T2-data-layer constructs
   from the persisted session mode and the viewer's authenticated role.
   Templates have NO disclosure power: a template may choose only among
   reveal presentations valid for the payload class the server issued.
   Full-detail (both-ranges) payloads exist only for **casual/co-present
   sessions** — the consumer toy gets both-range geometry only when run as
   a casual session; the same toy template in any invited mode renders the
   blind-safe variant. No surface ever holds a field its viewer may not
   see; redaction is never a UI concern. The developer audit panel appears
   only when the API returned audit data (no client toggle, no flag).
2. **Lifecycle is a transition contract, not a state list.** Two
   distinct notions, never conflated: **session state** — canonical:
   `open` (accepting positions), `locked`, `closed`, `cancelled` — and
   **per-participant submission status** — `draft`, `submitted`,
   `recalled` (re-submittable). `archived` is a per-viewer presentation
   flag, not a state. Per-shape contracts (event → authorised actor →
   guard → next state):
   *Invited reconciliation* (both compositions — creator-as-party and
   creator-as-host):
   - create → account-holding creator → valid template/config + credit
     debit per entitlement rules → session `open`
   - save-position → a party → session `open` → participant `draft`
   - submit → a party → valid in-domain tuple → participant `submitted`
   - recall → a submitted party → the other party not yet `submitted` →
     participant `recalled` (may re-submit); first-submitter-can-recall
     asymmetry is a feature
   - both-submitted → automatic → session `locked`, triggering
     server-side computation; success → `closed` (payloads issued,
     notifications sent); failure → stays `locked` with an
     operator-visible error state, never a silent close
   - cancel → creator → before both parties `submitted` → `cancelled`
     (visible, non-interactive)
   - No transition out of `closed` or `cancelled`; try again with a new
     session.
   *Survey*:
   - create/configure → account-holding commissioner → valid template +
     table-size debit per entitlement rules → `open`
   - respond → an invited respondent → session `open`, one response per
     grant, tuple valid → response recorded (invalid tuples rejected
     individually per T2-engine §3.3)
   - close → commissioner action, or configured deadline/quota
     (whichever first) → `locked`; late responses refused; computation
     over valid responses → `closed`
   - cancel → commissioner → before close → `cancelled`
   *Casual*: no lifecycle at all — a stateless computation with no
   persisted session (T2-data-layer §6 R1); the canonical states simply
   do not apply.
3. **Three session shapes** (ruled 19 Aug 2026, superseding the
   prototype's four types — see §6 R3):
   - *casual* — no auth, co-present, the sole full-detail mode, lives on
     the landing page, stateless (no price persistence).
   - *invited* — the blind two-party product. The **creator holds an
     account** (magic link / OAuth) and spends one credit per
     reconciliation from their balance (entitlement-enforced; free launch
     credits until the MoR exists — T2-platform §2.3). The **invitee
     never pays and needs no account**: a one-time email link grants
     their single role in this single session. The creator is either one
     of the two parties or the host (recruiter pattern). Personal history
     attaches to the creator's account.
   - *survey* — one account-holding commissioner pays per table × size;
     respondents are invitees (no account, no payment).
   *Org* is not a fourth shape: it is account plumbing (org-owned
   sessions, shared credit pool, membership admin) layered onto invited
   and survey shapes — architecture bound here, shipping
   milestone-scheduled.
   Mode is fixed at creation and persisted; nothing downgrades a blind
   session to full-detail.
4. **The role matrix is the contract.** Per session type, the roles and
   their payload classes:
   | Role | Exists in | May do | Sees (payload class) |
   |---|---|---|---|
   | creator (account) | invited, survey | configure, invite, cancel (per §2.2); spends the credit | own-party view if also a party; host view if hosting; never both parties' inputs |
   | party (A/B) | casual, invited | draft/submit/recall own tuple | party-safe: own inputs, outcome, own no-deal distance only (casual: full-detail, co-present) |
   | invitee grant | invited, survey | the one role the invite names, in that session only | that role's payload class; no account, no payment |
   | host | invited (host-controlled) | observe, nudge | host-safe: outcome summary + the two "what Party X sees" panels; never inputs |
   | commissioner | survey | configure, invite ≤cap, close; pays per table | survey results per engine contract; rows anonymised unless a respondent opted into attribution (§6 R1) |
   | respondent | survey | submit one tuple | own submission + confirmation only |
   | org admin | org plumbing (later) | membership, org sessions, shared credit pool | as creator/host per session; never party inputs |
   | developer | all (server-granted) | read audit payloads | internal-only class; granted by database role, never user-selectable, invisible to other users |

   _Vocabulary note, 9 Sep 2026 (`T3-m2-domain-terms`, ruled §6):_ the
   words in this table are M1's; the built vocabulary supersedes them
   without rewriting this history. Read: session → reconciliation; party
   (A/B) → side (buyer / seller); host → broker (a seat, which may act
   for a side); the "composition" (creator-as-party / creator-as-host) →
   the creator's seat plus `acts_for`; payload classes party / blind-host
   / host-full → side / broker-blind / broker-full; the standing
   container for many responses → offer. The matrix's meaning is
   unchanged.

5. **Templates are configuration, not code:** a template = the four
   question texts, party labels, the directional mapping (which party is
   low-preferring vs high-preferring, consumed by T2-engine §2.3), copy
   register (including any friendlier synonym for "reconciliation" —
   canonical term stays "reconciliation"), and currency default.
   User-definable A-vs-B templates are BOUND ARCHITECTURE (T1 §2.2 —
   custom template authoring is part of this theme's design, whatever
   milestone ships it); verticals (recruiter, founder, generic, toy) are
   preset templates; adding one requires no schema change.
6. **The reveal is payload-class-aware** (binding design ruling, 19 Aug
   2026): both-ranges convergence animation renders only on full-detail
   payloads (casual/co-present). Blind payloads get the blindness-safe
   variant: the viewer's own range and the fair price landing, or an
   abstract convergence encoding no counterparty positions. "The maths is
   the motion" everywhere; what moves is a pure function of the payload
   class.
7. **The Instrument governs all chrome:** calm neutral shell, tactile
   neumorphic meter controls, gamified flow-progress (completion feedback
   only — never points, streaks, or leaderboards), WCAG 2.1 AA contrast
   discipline over every soft surface, mobile-responsive from the first
   screen, nothing that delays the 60-second casual promise.
8. **Precision is presentation-transformed, never lost** (T2-engine §2.6):
   meter entry accepts and round-trips full decimal precision (3–4+ d.p.
   legitimate); display rounding is a reversible presentation transform
   (the underlying value remains inspectable), default 2 d.p.
9. **Survey results render the full engine contract** (T2-engine §3.3):
   the four intersection points including explicit `interval-crossing` and
   `no-crossing` states (plainly worded, never hidden), the acceptable
   range, N, and valid/invalid response counts.
10. **Invites are records, not links alone** (re-adopted, tightened per
    audit r2): an invite row (session, role, bound email where required,
    expiry, acceptance) behind a `/join/{invite}` URL; the server
    resolves role and auth requirement from the record. **Cardinalities
    and binding by shape:** a creator-as-party issues exactly ONE
    counterparty grant; a creator-as-host issues exactly TWO party
    grants; every invited-party grant is **email-bound and single-use**
    (a forwarded link cannot be redeemed by another address — blind
    parties' identities matter). Survey respondent invites may be
    email-bound OR shareable-link (respondents are many and low-stakes;
    shareable links also spare the sending domain — the ≤cap rule
    applies to emailed invites).

## 3. What — components

1. **Landing page = casual mode**: hero per the ruled design; the meter
   playable with zero signup; shareable result cards carrying attribution
   ref codes (T1 §2.7) — an inbound ref survives the whole surface flow
   and is handed to the completion event without being user-editable.
2. **Session creation and configuration**: template pick, labels,
   currency (one per session, display-only to the engine), invite issue.
   **Entitlement debits are shape-specific** (rules and phases owned by
   T2-platform §2.3): an invited reconciliation debits exactly one
   credit; a survey debits per the configured table-size schedule. The
   balance is visible at the point of spend; the top-up path appears
   only in the paid phase (in the free-launch-credit phase there is no
   checkout anywhere in the flow).
3. **Party experience**: tactile meter entry with validation (ascending,
   in-domain per T2-engine §2.5), sealed-state feedback, draft/submit/
   recall controls, progress choreography (you → them → reveal), the
   payload-class-aware reveal, no-deal view (own distance only, "fair not
   equal" statement).
4. **Host experience**: outcome summary + the two safety panels.
5. **Survey mode surface** (build order per T1 Q2 ruling: fast-follow):
   commissioner setup (template questions, N invites, close rule),
   respondent flow (one meter, no account), results per §2.9. Invite
   lists are capped per session (default 50 — the platform's
   deliverability guardrail, T2-platform §2.7); raising the cap is an
   operator-granted per-account setting, never self-serve.
6. **Org machinery**: org creation, membership, org-owned sessions, admin
   controls — architecture bound here; shipping milestone decided in the
   milestone plan (not this document).
7. **Custom template authoring**: bound architecture per §2.5; shipping
   milestone likewise deferred to the milestone plan.
8. **Dashboard**: session list per user/org, archive flag, credit
   balance and purchase history, settings (default currency, default
   labels).
9. **Developer audit panel**: renders only on API-supplied audit data.

## 4. Verification approach (binding on T3s)

- E2E flows per shape: casual round-trip; invited end-to-end in BOTH
  compositions (creator-as-party with one grant; creator-as-host with two
  grants), covering credit debit, email-bound link redemption (wrong
  address refused), both submissions, reveal; survey
  commission/respond/close including table-size debit and late-response
  refusal; entitlement-phase gates (free-launch phase shows no checkout;
  paid phase debits and refuses at zero balance); org creation and
  membership (once its milestone ships it).
- Payload-safety tests: for each role × session type × deal outcome,
  assert the rendered DOM never contains counterparty raw values or
  distances (fixtures from T2-data-layer's payload classes).
- Reveal-variant tests: blind-payload fixtures must not render
  counterparty range geometry; a toy-template session in an invited mode
  must render the blind-safe variant.
- Lifecycle transition tests: every §2.2 transition's guard, actor
  authorisation, and refusal cases; computation-failure state; survey
  close rules and late-response refusal.
- Precision round-trip: 3–4 d.p. entries survive entry → display →
  inspection unchanged.
- Survey result states: fixtures for `interval-crossing`, `no-crossing`,
  minimum-N, and invalid-response counting render per contract.
- Attribution: E2E from ref-carrying link entry through completed
  reconciliation asserting the completion event carries the ref.
- Accessibility: automated AA checks plus manual contrast audit on
  neumorphic controls; mobile viewport E2E.

## 5. Open questions (HITL)

- **Q1 — survey respondent-row visibility default.** May a commissioner
  see respondents' individual tuples attributed by name/email, or only
  anonymised rows (identity separated) unless a respondent opts into
  attribution? Leaning: anonymised by default with opt-in attribution —
  consistent with the blindness brand even where orthodox survey tools
  show all.

*(Resolved out of round 1: org and custom-template architecture are bound
here with shipping milestones deferred to the milestone plan;
retention duration is T2-data-layer's question, governed by a business
ruling.)*

## 6. Rulings (19 Aug 2026, operator, in-chat)

- **R1 (Q1 — survey respondent visibility): RULED as leaning.**
  Anonymised rows by default; a respondent may opt into named
  attribution — per-response, informed, never a participation condition
  (audit r2 flagged tension with T1 §2.4; resolved by T1 Addendum 5:
  subject-directed disclosure is the subject's own act).
- **R2 — casual is stateless and disclosure-labelled** (from the
  data-layer ruling): the casual surface persists no price data (an
  anonymous completion event only) and computes SERVER-side — never
  in-browser (the engine is trade secret and abuse-controlled; ephemeral
  ≠ client-side). Invited-session surfaces carry the standing disclosure
  line that anonymised session data is stored long-term for analysis.
- **R3 — three shapes replace the four types** (operator, 19 Aug 2026,
  "I'm sold — it's clearer"): quick and direct merge into one **invited**
  shape where the account-holding creator pays per reconciliation via
  credits and the invitee is always free and account-less; casual stays
  the free ephemeral demo; survey is commissioner-paid per table × size.
  Org is account plumbing (shared credit pool), not a shape. Launch runs
  on free launch credits until the company + merchant-of-record exist
  (entitlement config, not architecture). Subscription is NOT a launch
  feature: it is added when the venture's second-pack-rebuy trigger fires
  (>30% of pack buyers re-buying within 6 months). Supersedes the
  re-adopted four-type structure from the March design; the lifecycle,
  host, invite, and blindness machinery re-adopted under T1 Q4 are
  unchanged.
- **R4 — audit round 2 revisions applied** (19 Aug 2026): session state
  separated from per-participant status with per-shape transition
  contracts (survey open/respond/close, casual explicitly lifecycle-free);
  invite cardinalities fixed (party-creator one grant, host-creator two)
  with email-bound single-use party grants; entitlement phases carried
  into components and verification (shape-specific debits, no checkout in
  the free-launch phase).

- **R5 (20 Aug 2026, operator, post-acceptance append) — casual
  blind-handover choreography.** Casual co-present sessions gain a
  pass-the-device protocol: Party A enters while B looks away; an
  interstitial confirms-and-hides A's figures before handover; B enters;
  a "both look now" interstitial precedes the reveal. Entered figures are
  never re-displayed outside the outcome view (which remains full-detail
  per the casual payload class — a template MAY later opt to hide raw
  inputs in the outcome too, as presentation). Honest note, accepted: in
  casual mode the DEVICE transiently holds both tuples (one client) — the
  handover is UX-enforced etiquette, not cryptographic blindness; server
  and stored-data guarantees are unchanged (nothing is stored at all).
  *Revised 8 Sep 2026 (operator, in chat):* the protocol is now two live
  meters side by side; each side "seals and hides" its own, which puts
  an opaque plate over it for the handover; both sealed, then the reveal.
  The confirm-and-hide and handover interstitials are gone; the guarantee
  (a sealed side's figures are never re-displayed before the outcome)
  is unchanged. See T3-m1-casual-mode §3.
  _Vocabulary note, 9 Sep 2026:_ Party A / Party B are the buyer and
  seller sides internally (`T3-m2-domain-terms` §6 #11); on-screen titles
  come from the scenario. The wording above is left as ruled.

- **R6 (20 Aug 2026, operator, post-acceptance append) — casual outcome
  hides raw figures by default.** Refines R5: the casual outcome view
  shows the reconciliation (fair price, zones, the convergence animation)
  WITHOUT either party's raw input figures by default; an explicit "show
  the numbers" control reveals them on demand. Raw figures appear nowhere
  else. The both-range animation remains permitted in casual (it encodes
  ranges, which the pair chose to reconcile co-presently); the default
  conceals the four-point inputs themselves.

## 7. Rulings (7 Sep 2026, operator, in-chat — buildpad canvas review; see T1 Addendum 7 for context)

- **R7 — host visibility is template configuration.** The template schema
  (§2.5) gains a **host-visibility** setting: `blind` (default — today's
  behaviour, host-safe payloads only) or `host-visible` (the host's
  payload class includes both parties' raw inputs and full outcome). The
  setting is part of the persisted session mode, fixed at creation,
  resolved server-side by the payload constructor (T2-data-layer §2.2) —
  templates still have no disclosure power of their own; they select a
  configuration the server enforces. The role matrix's host row
  (§2.4) reads as the blind case; a host-visible session issues the host
  a new **host-full** payload class instead. Party payload classes are
  unchanged in both cases — parties never see each other's raw inputs in
  any invited mode. The **recruitment template configures host-visible**;
  the **founder/survey and generic templates stay blind-host**.
  Verification (§4) extends: payload-safety fixtures for both
  host-visibility settings, asserting host-full appears only when the
  persisted mode configures it.
  _Vocabulary note, 9 Sep 2026:_ as built after `T3-m2-domain-terms`, the
  host is the broker seat; `host_visibility` is the boolean
  `broker_sees_figures` on the reconciliation (disclosed to a side by
  `broker_sees_figures_for`); host-full / blind-host are the broker-full
  / broker-blind payload classes; the recruitment template is the
  `salary-negotiation` vertical, whose dictionary sets
  `brokerSeesFigures: true`. The ruling stands as written.
- **R8 — vertical demo walkthroughs are a first-class surface.** Each
  vertical template should in principle carry a **guided demo**: a
  public, no-signup walkthrough on the vertical's page in which one
  visitor plays every role in sequence (recruitment: broker enters the
  client budget → "now switch hats" → candidate answers → host-full
  outcome), with embedded directed questions and comment boxes at each
  stage and **progressive submission** so abandoned flows still yield
  events (rides the §2/T2-data-layer events machinery — no separate
  codebase, no external form tool). A demo is NOT casual mode: casual is
  the non-vertical co-present toy; a demo is vertical-specific, may
  exercise vertical-only content (R9 guidance, vertical copy), and its
  entries are demo-flagged so they never pollute real session data or
  aggregates. The **recruitment demo ships first**; its seed content is
  `reference/fair-pricebroker-canvas/documents/recruiter-demo-build-spec-and-outreach.md`
  (stage framing, directed questions). Architecture is bound here;
  shipping milestone is deferred to the milestone plans (NOT added to
  M1).
- **R9 — post-pricing guidance is template content.** A vertical template
  may define an **outcome-guidance layer**: copy mapped from the engine's
  outcome classes (deal zone / stretch / no overlap) to
  vertical-specific next-step guidance. The engine computes; the template
  interprets. Recruitment's layer: the two-dimensional read — overlap
  level, plus whether non-remuneration factors (equity, flexibility,
  culture, purpose) need to be meaningfully in play to bridge the gap.
  Recruitment's candidate-facing copy carries the **load-bearing
  incentive argument** — an explicit explanation of why naming a lower
  figure is in the candidate's interest (signals openness, increases
  match chances); it must never be left implicit (operator's buildpad
  note, canvas `notes/`).
- **R10 — founders is the second vertical.** Its substrate is survey mode
  (§3.5) with its own peculiarities and, per R8, in principle its own
  demo. Build order stays as ruled (T1 Q2: two-party first, survey
  fast-follow); this ruling assigns vertical order, not build order.

## 8. Open questions (HITL, 7 Sep 2026)

- **Q2 — host-visible disclosure to the invitee.** In a host-visible
  session (recruitment), must the party-facing surface explicitly tell
  the invitee that the host can see their raw figures? Leaning: yes —
  honesty about visibility is the trust thesis, and the candidate-side
  incentive copy (R9) only works if the candidate knows who sees what.
  Not yet ruled.

## 9. Rulings (7 Sep 2026, later, operator, in-chat)

- **R11 (Q2 — host-visible disclosure): RULED — yes.** If the host can
  see the answers, every party in a host-visible session must be told
  so, on the party-facing surface, before they enter figures. This is
  binding template copy for every host-visible vertical (recruitment
  included), not optional per template. Verification (§4) extends:
  party-flow fixtures for host-visible sessions assert the disclosure
  renders pre-entry; blind-host sessions must not render it.
