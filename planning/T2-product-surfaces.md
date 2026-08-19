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
applies the chosen look ("The Instrument") everywhere, including the rule
that the reveal animation must never leak the other side's numbers in a
blind session. Three decisions still need Alastair — at the bottom.

Everything below this line is the detailed version, written for the agents
doing the work.

---

> Spawned from `T1-top-level` §3 theme 2 (19 Aug 2026). Inherits T1 §2
> principles by reference; consumes `T2-engine` result contracts. Design
> authority: `docs/design-brief.md` + the ruled design language ("The
> Instrument"). Prior-art requirements re-adopted per T1 §5 Addendum 4 (Q4).

## 1. Why (theme intent)

The product's promise — blind, fair, fast — is delivered or broken in the
surfaces: who may see what, when things lock, and how the reveal feels. The
surfaces must make honesty comfortable (the practice's trust thesis), make
the free casual mode the marketing (T1 §2.6), and keep every vertical a
template on one horizontal core (T1 §2.2).

## 2. How — architectural principles

1. **Payload-safe by construction.** Surfaces render only the role-safe
   payloads constructed by T2-data-layer (per T2-engine §2.2). No surface
   ever holds a field its viewer may not see — redaction is never a UI
   concern. The developer audit panel appears only when the API returned
   audit data (no client toggle, no flag).
2. **The lifecycle is the re-adopted state machine** (T1 Q4 ruling):
   created → draft → submitted (recallable) → locked (automatic when the
   second party submits) → closed → archived; cancelled available to the
   creator until both have submitted. First-submitter-can-recall asymmetry
   is a feature. No re-opening a closed session; try again with a new one.
3. **Four session types, one spectrum of formality** (re-adopted):
   *casual* (no auth, co-present, full-detail results, lives on the
   landing page), *quick* (email-token auth, party isolation, limited
   retention), *direct* (magic link / OAuth, personal history), *org*
   (OAuth, org-owned sessions). Blindness applies to all but casual —
   casual is the sole full-detail exception (T1 §2.1).
4. **Hosts see outcomes, never inputs** (re-adopted): a host-controlled
   session gives the host the outcome summary plus explicit "what Party A
   sees / what Party B sees" panels — a safety rail against accidental
   disclosure in conversation. Hosts cannot input values.
5. **Templates are configuration, not code:** a template = the four
   question texts, party labels and directional mapping (which party is
   low-preferring vs high-preferring, consumed by T2-engine §2.3), copy
   register (including any friendlier synonym for "reconciliation" —
   canonical term stays "reconciliation"), currency default, and a
   **reveal-variant flag**. Verticals (recruiter, founder, the consumer
   toy) ship as preset templates; adding one requires no schema change.
6. **The reveal is mode-aware** (binding design ruling, 19 Aug 2026): the
   both-ranges convergence animation renders only where the payload class
   permits (casual/co-present and other explicitly non-blind templates).
   Blind sessions get the blindness-safe variant: the viewer's own range
   and the fair price landing, or an abstract convergence encoding no
   counterparty positions. "The maths is the motion" everywhere; what
   moves differs by payload class.
7. **The Instrument governs all chrome:** calm neutral shell, tactile
   neumorphic meter controls, gamified flow-progress (completion feedback
   only — never points, streaks, or leaderboards), WCAG 2.1 AA contrast
   discipline over every soft surface, mobile-responsive from the first
   screen, and nothing that delays the 60-second casual promise.
8. **Invites are records, not links alone** (re-adopted): an invite row
   (session, role, optional email, expiry, acceptance) behind a
   `/join/{invite}` URL, deliverable by email or shareable link; the
   server resolves role and auth requirement from the record. Direct
   sessions can only invite the counterparty role.

## 3. What — components

1. **Landing page = casual mode**: hero per the ruled design; the meter
   playable with zero signup; shareable result cards carrying attribution
   ref codes (T1 §2.7); conversion path play → privacy (quick) →
   persistence (direct/org).
2. **Session creation and configuration**: template pick, labels,
   currency (one per session, display-only to the engine), invite issue.
3. **Party experience**: tactile meter entry with validation (ascending,
   in-domain per T2-engine §2.5), sealed-state feedback, draft/submit/
   recall controls, progress choreography (you → them → reveal), the
   mode-aware reveal, no-deal view (own distance only, "fair not equal"
   statement).
4. **Host experience**: outcome summary + the two safety panels.
5. **Survey mode surface** (fast-follow per T1 Q2 ruling): commissioner
   setup (questions from template, N invites), respondent flow (one
   meter, no account), results table + classic curves once closed;
   respondents' individual rows visible to the commissioner only as the
   engine/data-layer contract permits.
6. **Dashboard**: session list per user/org, archive, settings (default
   currency, default labels); org admin membership management.
7. **Developer audit panel**: renders only on API-supplied audit data.

## 4. Verification approach (binding on T3s)

- E2E flows per session type: casual round-trip; quick with two email
  tokens; direct invite/accept; org creation and membership.
- Payload-safety tests: for each role and mode, assert the rendered DOM
  never contains counterparty raw values or distances (fixtures from
  T2-data-layer's payload classes).
- Reveal-variant tests: blind-mode fixtures must not render counterparty
  range geometry.
- Lifecycle property tests: recall only before counterparty submission;
  auto-lock on second submit; no interaction after close/cancel.
- Accessibility: automated AA checks plus manual contrast audit on
  neumorphic controls; mobile viewport E2E.

## 5. Open questions (HITL)

- **Q1 — org support in v1?** The prototype design made orgs v1 for the
  recruiter GTM, but the venture has since deferred the *paid layer* until
  ~10 pilots. Ship org machinery in v1 regardless (it shapes the schema),
  or defer org UI with the schema org-ready? Leaning: schema org-ready,
  org UI deferred with the paid layer.
- **Q2 — template authoring in v1?** User-definable A-vs-B setups are the
  horizontal core, but v1 could ship preset templates only (recruiter,
  founder, generic, toy) with custom authoring fast-following. Leaning:
  presets only in v1; custom authoring behind a flag.
- **Q3 — quick-mode retention.** The prototype said 30 days free. Business
  ruling needed before the paid layer exists (interacts with the
  free-tier-only launch). Leaning: adopt 30 days now, revisit at
  paid-layer build.
