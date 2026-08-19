---
id: T2-product-surfaces
plan_kind: thematic
tier: 2
status: draft
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
2. **Lifecycle is a transition contract, not a state list.** Canonical
   states (re-adopted, T1 Q4): `created`, `draft`, `submitted`, `locked`,
   `closed`, `cancelled`; `archived` is a per-viewer presentation flag,
   not a canonical state. Transitions (event → authorised actor → guard →
   next state):
   - create → creator → valid template/config → `created`→`draft`
   - save-position → a party → session not locked → stays `draft`
   - submit → a party → valid in-domain tuple → that party `submitted`
   - recall → the submitting party → counterparty not yet submitted →
     back to `draft`
   - second-submit → the other party → both valid → `locked`
     (automatic), which triggers server-side computation; computation
     success → `closed` (results payloads issued, notifications sent);
     computation failure → session stays `locked` with an operator-visible
     error state, never a silent close
   - cancel → creator → before both parties have submitted → `cancelled`
     (visible, non-interactive)
   - No transition out of `closed` or `cancelled`; try again with a new
     session. First-submitter-can-recall asymmetry is a feature.
   **Survey closure:** a survey session closes on commissioner action or
   configured deadline/quota, whichever first; late responses are refused;
   computation runs at close over valid responses.
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
10. **Invites are records, not links alone** (re-adopted): an invite row
    (session, role, optional email, expiry, acceptance) behind a
    `/join/{invite}` URL, deliverable by email or shareable link; the
    server resolves role and auth requirement from the record. Direct
    sessions can only invite the counterparty role.

## 3. What — components

1. **Landing page = casual mode**: hero per the ruled design; the meter
   playable with zero signup; shareable result cards carrying attribution
   ref codes (T1 §2.7) — an inbound ref survives the whole surface flow
   and is handed to the completion event without being user-editable.
2. **Session creation and configuration**: template pick, labels,
   currency (one per session, display-only to the engine), invite issue.
   Creating an invited reconciliation or a survey debits the creator's
   credit balance per the entitlement rules (T2-platform §2.3); the
   balance and top-up path are visible at the point of spend.
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

- E2E flows per shape: casual round-trip; invited end-to-end (creator
  account + credit debit, invitee via email link, both submit, reveal);
  survey commission/respond/close; org creation and membership (once its
  milestone ships it).
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
  attribution.
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
