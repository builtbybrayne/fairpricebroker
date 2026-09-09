---
version: 1
slug: "src-routes-app-s-id-page-svelte"
primary_target: "src/routes/app/s/[id]/+page.svelte"
related_targets: ["src/routes/s/[id]/party/+page.svelte","src/routes/app/+page.svelte","src/routes/app/new/+page.svelte"]
---

# Surface brief — recruiter session page (src/routes/app/s/[id]/+page.svelte)

Scope: the recruiter's one-route, state-driven session page for the recruitment composition (T3-m1-recruitment-core §3), with its siblings the dashboard (`/app`, roles with their candidates), the role form (`/app/new`: title, currency, budget), the role page (`/app/r/[id]`: budget, add candidates, progress, fresh links shown once; 9 Sep 2026) and the candidate surface (`/s/[id]/party`). Mode: Operate. Audience: a recruiter at a desk, returning to this page several times over a day or two; secondarily the same recruiter on a phone between calls. The candidate surface is opened on a phone from a link.

Task: enter the client's budget as four figures; obtain and send the candidate's private link; wait; read the fair salary, the overlap level and the non-salary steer; see exactly what the candidate was shown.

States (server-derived `phase`): enter (blue single-track MeterPanel seeded with example salaries, submit, cancel), waiting (link block shown once from a path-scoped cookie, copy control, candidate status list, recall/cancel), locked (working it out; page polls), closed (host-full result), cancelled. Candidate page phases: enter (R11 disclosure + incentive above the meter), sealed (own sealed meter, recall), locked, closed (blind reveal), cancelled.

Constraints: the server-issued payload class is the sole disclosure authority — the candidate page never receives the employer tuple; the recruiter page keeps both tuples behind "Show the numbers" (default hidden). Before the toggle the drawn ranges are quantised to a tenth of the axis step so the shared canvas's spoken label carries no entered figure; the canvas is aria-hidden with an sr-only description until the toggle. 4-d.p. entries display at 4 d.p.; the fair figure at 2 d.p. with the unrounded value under the toggle. WCAG AA over neumorphic surfaces; mobile-first from 375px; the shared canvas's 94px unit gutter is overridden below 720px.

Meter (revised 8 Sep 2026): the shared single-track MeterPanel — end dials set the outer range, two knobs ride between, every figure is a typed field, the four point labels (Not credible · Good value · For a great candidate · Simply out of budget; Simply too low · Would accept for an awesome opportunity · Ideal outcome · Too unrealistic; operator wording 9 Sep 2026) sit under the points and the touched point's question under the track; the helps list beneath repeats each question with its help line. Entry meters open with example salaries, never zero.

Chosen composition: title = the candidate's email (the thing the recruiter is looking for in a list), state badge, four-stage progress row (completion feedback only); then one navy result panel with the fair salary at display scale, overlap label + non-remuneration line, and the living reveal; a ground panel for the guidance copy and the numbers toggle; and a ground panel framing a navy "What the candidate sees" replica (own range, fair figure, overlap, party copy) so the recruiter reads the candidate's view without leaving the page. Blue is the client side, terracotta the candidate, gold only for the fair figure and the primary action.
