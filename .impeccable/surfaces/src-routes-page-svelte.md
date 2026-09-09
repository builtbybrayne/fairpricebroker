---
version: 1
slug: "src-routes-page-svelte"
primary_target: "src/routes/+page.svelte"
related_targets: ["src/lib/client/casual/CasualFlow.svelte"]
---

# Surface brief — homepage (src/routes/+page.svelte)

Scope: the landing page, which IS the casual product (T1 §2.6). Visitor mode: Persuade, with the instrument itself as the proof. Audience: two people in a room who need to agree a price, on one phone; secondary: a recruiter arriving from outreach who needs to see the core concept, then the recruitment variation. Job: understand the offer in one line, set the meter, hand the phone over, see the reveal. Action: "Set your meter" (scrolls to the live meters; no navigation). Proof: the working meter and the live reveal — no testimonials, no logos, no invented numbers (operator ruling: no placeholders). Constraints: sixty-second promise, WCAG 2.1 AA over neumorphic surfaces, both-ranges animation permitted here (casual is non-blind), raw figures hidden in the outcome until "show the numbers", nothing stored, ref code captured from ?ref and passed through.

## Direction contract

THESIS: A quiet instrument you set in private, and a reveal where two ranges drift into one fair number. Refuses the category default: centred headline, screenshot hero, logo wall, feature-card grid.

OWN-WORLD: Soft cool-grey ground #eef1f6; navy #1d3557 ink and panels; blue #3d5a80 for "you", terracotta #b76952 for "them"; gold #e8b34b reserved for the fair price and the single primary action. Raised and inset neumorphic surfaces with one shadow scale (light top-left, #d3dae4 / white). Sora Bold display, Albert Sans body, tabular numerals everywhere; all four price points visible as ghost ticks on the meter, only the one being set struck forward.

STORY: "Two prices in, one fair one out, and nobody sees the other side's numbers." The visitor believes it by doing it: set, seal and hide, hand over, the other sets and seals, both look, reveal.

FIRST VIEWPORT (per approved comp C): Slim bar (wordmark + target icon, Method, For recruiters, navy Start free). A full-width deep-navy rounded canvas panel ~60% of the viewport height: left third, the headline at display scale in white, the two-line lede in slate-blue, gold "Set your meter" with "free · 60 seconds · nothing stored"; right two-thirds, the living reveal drawn large: blue YOUR RANGE bar and terracotta THEIR RANGE bar with fading wakes, the glowing gold FAIR PRICE ZONE, the lit gold £512.50 chip with a hairline pointer, tick marks and tabular axis figures 200–800 £ (GBP). Beneath on the grey ground: the three-step row (1 You set yours · 2 They set theirs · 3 The reveal), a "Try it on" row of scenario pills (a second-hand bike · dinner for two · a day's freelance work), then two raised LIVE meter panels side by side (revised 8 Sep 2026, operator): BUYING IT (blue) and SELLING IT (terracotta), each a single inset track with end dials setting the outer range and two knobs between, the four point labels beneath, the touched point's question under the track, and a gold "Seal and hide" action; a small lock caption between them: BOTH SET IN PRIVATE · FIGURES HIDDEN UNTIL REVEAL. A sealed meter becomes an opaque plate ("Sealed. Hand the phone over."). The hero's reveal shows the chosen scenario's example outcome until a real one lands. Pressing "Set your meter" scrolls to the step row.

APPROVED COMP: .impeccable/mocks/homepage/homepage-C.png (reveal-first; operator approval 8 Sep 2026). The comp's four-row sealed meters were superseded the same day by the operator's review of the build: live single-track meters (the exfu price meter's layout), example figures, side-specific point labels. The comp remains authority for the hero and the page's topology; the meter panels below it are governed by this brief and DESIGN.md.

FORM: Direction "The Instrument" (operator-pinned, raised by the nixie counter, plankton wake and cathode gauze challengers), position 1 of the grounded list; seed key 7c530c51. Comp round: A (two-column, chosen decision comp), B (instrument-first), C (reveal-first).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
