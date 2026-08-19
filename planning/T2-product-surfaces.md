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
revealed. It fixes the shapes we already trust from the earlier prototype
design — four kinds of session (from "play instantly on the homepage" to
"company account"), the submit-and-reveal choreography, and the strict rule
that a middleman host can see the outcome but never anyone's numbers. It
applies the chosen look ("The Instrument") everywhere — and the server, not
the page, decides what each viewer may ever see, so the reveal animation
cannot leak the other side's numbers even by mistake. One decision needs
Alastair — at the bottom.

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
3. **Four session types, one spectrum of formality** (re-adopted):
   *casual* (no auth, co-present, the sole full-detail mode, lives on the
   landing page), *quick* (email-token auth, blind), *direct* (magic
   link / OAuth, blind, personal history), *org* (OAuth, blind,
   org-owned). Mode is fixed at creation and persisted; nothing downgrades
   a blind session to full-detail.
4. **The role matrix is the contract.** Per session type, the roles and
   their payload classes:
   | Role | Exists in | May do | Sees (payload class) |
   |---|---|---|---|
   | creator | all | configure, invite, cancel (per §2.2) | own-party view if also a party; else host-or-summary view per type |
   | party (A/B) | all | draft/submit/recall own tuple | party-safe: own inputs, outcome, own no-deal distance only |
   | host | host-controlled | observe, nudge | host-safe: outcome summary + the two "what Party X sees" panels; never inputs |
   | commissioner | survey | configure, invite N, close | survey results per engine contract; individual rows only as the data-layer survey boundary permits (respondent identity separated from tuple unless respondent opted to be named) |
   | respondent | survey | submit one tuple | own submission + confirmation only |
   | org admin | org | membership + org-session management | as creator/host per session; never party inputs |
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
3. **Party experience**: tactile meter entry with validation (ascending,
   in-domain per T2-engine §2.5), sealed-state feedback, draft/submit/
   recall controls, progress choreography (you → them → reveal), the
   payload-class-aware reveal, no-deal view (own distance only, "fair not
   equal" statement).
4. **Host experience**: outcome summary + the two safety panels.
5. **Survey mode surface** (build order per T1 Q2 ruling: fast-follow):
   commissioner setup (template questions, N invites, close rule),
   respondent flow (one meter, no account), results per §2.9.
6. **Org machinery**: org creation, membership, org-owned sessions, admin
   controls — architecture bound here; shipping milestone decided in the
   milestone plan (not this document).
7. **Custom template authoring**: bound architecture per §2.5; shipping
   milestone likewise deferred to the milestone plan.
8. **Dashboard**: session list per user/org, archive flag, settings
   (default currency, default labels).
9. **Developer audit panel**: renders only on API-supplied audit data.

## 4. Verification approach (binding on T3s)

- E2E flows per session type: casual round-trip; quick with two email
  tokens; direct invite/accept; org creation and membership (once its
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
here with shipping milestones deferred to the milestone plan; quick-mode
retention duration is T2-data-layer's question, governed by a business
ruling.)*
