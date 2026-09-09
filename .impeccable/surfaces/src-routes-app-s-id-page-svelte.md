---
version: 1
slug: "src-routes-app-s-id-page-svelte"
primary_target: "src/routes/app/rec/[id]/+page.svelte"
related_targets: ["src/routes/rec/[id]/+page.svelte","src/routes/app/+page.svelte","src/routes/app/offers/+page.svelte","src/routes/app/offers/new/+page.svelte","src/routes/app/o/[id]/+page.svelte"]
---

# Surface brief — broker reconciliation page (src/routes/app/rec/[id]/+page.svelte)

Scope: the broker's one-route, state-driven reconciliation page for the salary-negotiation vertical (T3-m1-recruitment-core §3, in the T3-m2-domain-terms vocabulary; paths per that plan's §8), with its siblings the account home (`/app`), the offers list (`/app/offers`), the offer form (`/app/offers/new`: title, currency, the offerer's figures), the offer page (`/app/o/[id]`: figures, generate n one-time links, the link table with the respondent's email on arrival; 9 Sep 2026) and the responding side's page (`/rec/[id]`, reached through `/join/[token]`). Mode: Operate. Audience: a recruiter at a desk, returning to this page several times over a day or two; secondarily the same recruiter on a phone between calls. The responding side (the candidate, in this vertical) opens their page on a phone from a link.

Task: enter the hiring company's budget as the buyer's four figures; obtain and send the candidate's one-time link; wait; read the fair salary, the overlap level and the non-salary steer; see exactly what the candidate was shown.

States (server-derived `phase`): enter (blue single-track MeterPanel seeded with example salaries, submit, cancel), waiting (the link, copy control, the respondent's status, recall/cancel), locked (working it out; page polls), closed (broker-full result), cancelled. Responding side's page phases: enter (R11 disclosure + incentive above the meter), sealed (own sealed meter, recall), locked, closed (blind reveal, the side payload class), cancelled.

Constraints: the server-issued payload class is the sole disclosure authority — the responding side's page never receives the buyer's figures; the broker page keeps both sides' figures behind "Show the numbers" (default hidden). Before the toggle the drawn ranges are quantised to a tenth of the axis step so the shared canvas's spoken label carries no entered figure; the canvas is aria-hidden with an sr-only description until the toggle. 4-d.p. entries display at 4 d.p.; the fair figure at 2 d.p. with the unrounded value under the toggle. WCAG AA over neumorphic surfaces; mobile-first from 375px; the shared canvas's 94px unit gutter is overridden below 720px.

Meter (revised 8 Sep 2026): the shared single-track MeterPanel — end dials set the outer range, two knobs ride between, every figure is a typed field, the four point labels (Not credible · Good value · For a great candidate · Simply out of budget; Simply too low · Would accept for an awesome opportunity · Ideal outcome · Too unrealistic; operator wording 9 Sep 2026) sit under the points and the touched point's question under the track; the helps list beneath repeats each question with its help line. Entry meters open with example salaries, never zero.

Chosen composition: title = the candidate's email (the thing the recruiter is looking for in a list), state badge, four-stage progress row (completion feedback only); then one navy result panel with the fair salary at display scale, overlap label + non-remuneration line, and the living reveal; a ground panel for the guidance copy and the numbers toggle; and a ground panel framing a navy "What the candidate sees" replica (own range, fair figure, overlap, side copy) so the recruiter reads the candidate's view without leaving the page. Blue is the buyer (the hiring company), terracotta the seller (the candidate), gold only for the fair figure and the primary action.
