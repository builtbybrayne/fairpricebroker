# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Homepage visitor (casual mode):** two people in the same room who need to agree a price on something, playing the free demo on one phone. No account, no signup, under sixty seconds. Confirmed by the operator, 8 Sep 2026.
- **Primary paying user (invited mode, recruitment vertical):** an agency or contingency recruiter who knows the hiring company's salary budget and sends a candidate a private link. Earns commission only on placement, so every mismatched candidate is a direct cost. Uses the tool at the early screen, before or instead of the "what are you looking for?" standoff.
- **Candidate (invitee):** a one-off visitor who opens a link from a recruiter and must trust it in about thirty seconds. Coached never to name a number first; needs to be told plainly who sees what and why naming a lower figure is in their interest.
- **Second vertical (later):** founders running a pricing survey (survey mode substrate). Not in the current build.

## Product Purpose

Fair Price Broker is the software implementation of the Van Westendorp Price Sensitivity Meter, applied to two-party reconciliation. Each party privately enters four price points (too cheap, bargain, expensive, too expensive); the server-side engine finds the fair price and whether a deal zone exists, without either side ever seeing the other's raw numbers. It breaks the "who names a number first" standoff.

Success for the venture is measured in completed two-party reconciliations (the activation metric). The current milestone is "the working instrument": casual mode on the homepage, invited blind reconciliation end to end, the recruitment vertical with its guided demo.

## Positioning

The engine is the product; verticals are templates on it. The homepage speaks the core concept first (two-party blind price reconciliation), then offers verticals as variations, with recruitment as the first variation. The mechanism a neighbouring product cannot truthfully copy: a neutral, mutual "are we in the same ballpark" signal where both sides gain by avoiding wasted time, blindness enforced in the data model and server, not the client. No incumbent sells a two-sided overlap signal (Payscale, Pequity, Levels.fyi and ATS tools are employer-side comp data).

## Operating Context

- **Casual:** co-present pass-the-device choreography. A enters and confirms, figures are hidden, device handed over, B enters, "both look now", reveal. Raw figures hidden in the outcome by default; "show the numbers" reveals on demand. Nothing entered is ever stored.
- **Invited (recruitment):** recruiter creates a session, enters the client budget as one party, issues an email-bound single-use invite link to the candidate; the candidate answers the four questions; both submissions lock the session and the server computes. The recruiter is the host and, in the recruitment template, host-visible: they see both sets of numbers plus the outcome. Parties never see each other's numbers. Every party in a host-visible session is told before entry that the host can see their figures.
- **Recruitment guided demo:** a public, no-signup walkthrough where one visitor plays every role in sequence (recruiter enters budget, "switch hats", candidate answers, recruiter sees the outcome), with directed questions and comment boxes at each stage. Answers are saved progressively as demo-flagged events so abandoned flows still yield validation data. Demo data never pollutes real stats.
- **Outcome for recruitment:** two-dimensional. Overlap level (in range / stretch / no overlap) plus whether non-remuneration factors (equity, flexibility, culture, purpose) need to be meaningfully in play. This guidance layer is vertical template content, never engine.

## Capabilities and Constraints

- Stack ruled: SvelteKit + TypeScript, Postgres via Supabase, Vercel. Engine is pure TypeScript, server-only, never shipped to the browser.
- Blindness is enforced in the data model and API authorisation, never the client. The server-issued payload class is the sole disclosure authority.
- Precision is never lost: 3–4 decimal places are legitimate; display rounding is a reversible presentation transform (default 2 d.p.).
- Every shared result carries a ref code for attribution; completion events are idempotent.
- This build run uses naive auth (type an email, you're in) and on-screen copy-the-link invites; real magic-link email and Google sign-in are deferred, as is email sending.
- Free launch credits only; no checkout anywhere in the flow.
- Terminology: "reconciliation" is the canonical term (templates may use friendlier synonyms). "Fair price", "deal zone", "party A / party B", "host" (the recruiter in the recruitment vertical), "invite", "session".
- AI agents are first-class users: every human capability ships MCP/HTTP access in the same milestone (parity law). Not built in this run but the server contracts must not preclude it.
- Undecided: casual template copy, labels and currency default beyond a generic placeholder; the consumer toy template and viral campaign (later milestone).

## Brand Commitments

- Name: **Fair Price Broker**. Domain fairprice.broker.
- Design language ruled by the operator (19 Aug 2026): **"The Instrument"**. Stripe-class calm neutral shell; the meter as a tactile, neumorphic instrument; gamified flow feedback that rewards completion only (never points, streaks, leaderboards, or winning); one living centrepiece where the convergence animates ("the maths is the motion"). Fonts Sora (display) + Albert Sans (body). Reference sites for the shell: stripe.com, smallpdf.com, trello.com, DocuSign.
- Binding blindness constraint on motion: the both-ranges convergence animation is permitted only in non-blind modes (casual, co-present, host-visible host view). Blind viewers get a blindness-safe reveal: their own range plus the fair price landing, or an abstract convergence encoding no counterparty positions.
- Neutral-broker trust posture: honest about who sees what; never manipulative urgency; no fake reviews (UK DMCC Act).
- Voice: plain, warm, no hype. The candidate-facing copy must explicitly explain why naming a lower figure is in the candidate's interest.

## Evidence on Hand

- No customer proof exists: no testimonials, logos, pilots, or usage numbers. The operator has ruled (8 Sep 2026) that the site carries no placeholders for proof; do not fabricate and do not leave "logo wall coming soon" gaps. Prove the mechanism by demonstration instead.
- Real content available: the engine and its golden fixtures (`src/lib/server/engine/`), the recruitment demo stage copy and directed questions (`reference/fair-pricebroker-canvas/documents/recruiter-demo-build-spec-and-outreach.md`), the design brief (`docs/design-brief.md`), the design-directions canvas (Claude artifact "Fair Price Broker Design Directions", Direction E).
- Market evidence usable as narrative, not as product claims: 29–38% of declined offers cite compensation mismatch (canvas research blob, sources cited in-file).

## Product Principles

1. The landing page is the product: play first, privacy explained second, persistence third.
2. Make honesty comfortable: the interface's job is to make naming a true number feel safe and advantageous.
3. Trust lives in everything around the instrument; fun lives in the instrument and the reveal.
4. One engine, many skins: nothing vertical-specific leaks into the core.
5. Nothing may delay the sixty-second casual promise.

## Accessibility & Inclusion

WCAG 2.1 AA is ruled. Neumorphic soft surfaces must still carry hard text contrast (4.5:1 body). Mobile-responsive from the first screen; the casual flow is designed for one phone passed between two people.
