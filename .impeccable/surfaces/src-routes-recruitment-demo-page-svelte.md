---
version: 1
slug: "src-routes-recruitment-demo-page-svelte"
primary_target: "src/routes/recruitment/demo/+page.svelte"
related_targets: ["src/routes/recruitment/+page.svelte"]
---

# Surface brief — recruiter walkthrough (src/routes/recruitment/demo/+page.svelte)

Scope: the public "Try it as a recruiter" walkthrough (T3-m1-recruitment-demo §1), a client-driven state machine over the seed spec's five stages; and the vertical page that leads into it (src/routes/recruitment/+page.svelte, Persuade mode: the recruitment story with the instrument doing the proving). Visitor mode here: Operate/Experience — one clear task per stage.

Audience: an agency or contingency recruiter arriving from outreach, on a phone as often as a laptop; no account, no sign-up, three minutes.

Job: play both hats — enter a made-up client budget, see the candidate link go out, switch hats and answer as the candidate (having read the disclosure and the incentive argument exactly as a candidate would), then see the two-dimensional read the recruiter gets — and answer two or three directed questions plus a comment at each stage.

Task per stage: 1 employer meter (blue) → "Send the candidate link"; 2 the link, then "Now you're the candidate"; 3 disclosure + incentive, candidate meter (terracotta) → "See what the recruiter sees"; 4 reveal (both ranges, fair salary, overlap level, non-remuneration steer) beside what the candidate sees → Continue; 5 wrap-up → Finish → done state with Start free.

States: stage 1–5, done; meter validation error (client grammar) and engine rejection surfaced on the candidate meter; busy while a stage POSTs; every answer optional; reduced motion honoured (no stage fade, no reveal drift, instant scroll).

Constraints: progressive best-effort submission (POST per stage, one silent retry, never blocks); demoId minted once on mount and exposed as data-demo-id; ?ref carried only when well-formed; seed-spec framing and directed questions verbatim; R11 disclosure and incentive rendered before any candidate input; no fabricated proof anywhere; gold only for the fair salary and the single Continue; craft floor: no eyebrows, no icon-card grids, no modals.

Composition: progress rail across the top (five stages tinted by hat, completed filled, current ringed, hat pill beside it), stage heading and framing lede, the stage's instrument or reveal, a hairline, the directed questions as raised pill choices and inset text areas, then the gold Continue with "Stage n of 5". Mobile-first from 375px; the meter's label column widened locally for the sentence-length recruitment prompts.

Unresolved: MeterPanel has no `help` rendering and a fixed 190px label column; the demo overrides the column via a scoped :global — a prop on the shared component would be cleaner.
