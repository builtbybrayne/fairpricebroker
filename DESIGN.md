---
name: Fair Price Broker
description: The Instrument — a calm cool-grey shell around a tactile neumorphic meter and one living navy canvas where two ranges become one fair price.
colors:
  ground: "#eef1f6"
  ground-2: "#e7f3f7"
  ink: "#23303f"
  slate: "#5a6b80"
  mist: "#8595a8"
  hairline: "#dde3ec"
  navy: "#1d3557"
  navy-2: "#16304f"
  blue: "#3d5a80"
  blue-2: "#5c8ec8"
  terracotta: "#b76952"
  terracotta-2: "#c67968"
  gold: "#e8b34b"
  gold-2: "#edc55e"
  gold-ink: "#23303f"
  on-navy: "#f5f7f7"
  on-navy-soft: "#99bfe5"
  on-navy-mute: "#8fa3c2"
  shade: "#d3dae4"
  shade-deep: "#c8d0dc"
  light: "#ffffff"
typography:
  display:
    fontFamily: "Sora, Manrope, system-ui, sans-serif"
    fontSize: "calc(60 * var(--u))"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Sora, Manrope, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Sora, Manrope, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  lede:
    fontFamily: "Albert Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "calc(26 * var(--u))"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Albert Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  figure:
    fontFamily: "Albert Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  label:
    fontFamily: "Sora, Manrope, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.6
    letterSpacing: "0.22em"
rounded:
  pill: "999px"
  lg: "24px"
  panel: "20px"
  md: "16px"
  chip: "12px"
  sm: "10px"
spacing:
  section: "110px"
  block: "36px"
  card: "30px"
  grid: "24px"
  row: "22px"
  gutter: "14px"
components:
  button-gold:
    backgroundColor: "{colors.gold-2}"
    textColor: "{colors.gold-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "0 34px"
    height: "58px"
  button-gold-hover:
    backgroundColor: "{colors.gold}"
  button-navy:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "0 30px"
    height: "46px"
  button-navy-hover:
    backgroundColor: "{colors.navy-2}"
  button-quiet:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.navy}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  panel-raised:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "27px 33px 28px"
  panel-navy:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.on-navy}"
    rounded: "{rounded.panel}"
    padding: "36px 40px 30px"
  field-inset:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "12px 14px"
  chip-fair-price:
    backgroundColor: "{colors.gold-2}"
    textColor: "{colors.navy}"
    typography: "{typography.title}"
    rounded: "{rounded.chip}"
    padding: "13px 16px"
  tag-sealed:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.slate}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
---

# Design System: Fair Price Broker

## Overview

**Creative North Star: "The Instrument"**

Fair Price Broker looks like a well-made measuring instrument sitting on a calm desk. The shell is a Stripe-class neutral: a soft cool-grey ground, navy ink, plain warm copy, nothing shouting. Set into that shell are two kinds of object. The first is the meter, a raised neumorphic panel pressed out of the same grey as the page, holding four inset slider grooves with a ring-thumb in the party's colour; it reads as something you can touch and set. The second is the reveal, a deep-navy canvas where the product's own maths is the animation: two coloured ranges drift in from either side, a gold zone lights where they overlap, and the fair price lands on a lit gold chip. Trust lives in everything around the instrument; the fun lives inside it.

The world is carried by a strict colour grammar rather than by decoration. Blue is always "you", terracotta is always "them", gold is reserved for the fair price and for the single primary action on a screen. Depth is a single soft-light source from the top-left, so every raised surface and every inset groove agrees about where the light is; navy panels are the only things that cast a real drop shadow, because they are the only things that sit on top of the desk rather than being pressed out of it. Sora Bold carries every heading, label and figure chip; Albert Sans carries prose and figures, with tabular numerals switched on globally so prices line up.

Density is generous at the first viewport and relaxed below it. The comp was drawn at 1672px and the build scales the first viewport proportionally with one design unit (`--u`) down to 1024px, then switches to fixed pixel rules; nothing ever scales above the comp. Motion is short, eased out, and only ever describes the maths (drift, glow, land, wake); the whole system collapses to near-zero durations under `prefers-reduced-motion`.

**Key Characteristics:**
- Calm neutral shell, tactile neumorphic meter, one living navy canvas.
- Party colours are semantic: blue = you, terracotta = them, gold = the fair price and the primary action.
- One shadow scale, one light source (top-left), raised and inset variants only.
- Sora Bold display and labels; Albert Sans body; tabular numerals everywhere.
- Proportional first viewport (`--u`) that never scales above the comp; fixed rules below 1024px.
- Motion is the maths: drift, zone glow, chip landing, fading wake; reduced-motion collapses it.

## Colors

A cool-grey ground and navy ink, with three semantic hues (blue, terracotta, gold) each carrying one meaning and one meaning only.

### Primary
- **Broker Navy** (`{colors.navy}`): the ink for every heading, the wordmark, the navy pill button, and the fill of the reveal canvas and outcome panel. Deepens to **Navy Hover** (`{colors.navy-2}`) on the navy button's hover only.
- **Fair Gold** (`{colors.gold}`) and **Lit Gold** (`{colors.gold-2}`): the fair-price chip, the fair-price zone, the completed step marker, the focus ring, text selection, and the gold primary action pill. The pill rests on Lit Gold and hovers to Fair Gold; the chip is Lit Gold with a paler `#f3d27a` hairline border and a gold glow. Gold text sits on **Gold Ink** (`{colors.gold-ink}`), never on white.

### Secondary
- **Your Blue** (`{colors.blue}`) and **Your Blue, lit** (`{colors.blue-2}`): the viewer's side. The meter thumb ring and groove tint use the deep blue; the reveal bar, its glow and the YOUR RANGE label use the lit blue on navy. Also the link colour on the grey ground.
- **Their Terracotta** (`{colors.terracotta}`) and **Their Terracotta, lit** (`{colors.terracotta-2}`): the counterparty's side, used in exactly the same places as blue on the other meter and the other bar. Terracotta at 12% tints the correction notice in the casual flow.

### Neutral
- **Ground** (`{colors.ground}`): the page, every raised panel and every inset groove. Neumorphism only works because surface and page are the same colour. **Ground, cool** (`{colors.ground-2}`) is the top-bar tint from the comp; the build keeps it as a token but the header currently sits on plain Ground.
- **Ink** (`{colors.ink}`): body text, figures, and text on gold.
- **Slate** (`{colors.slate}`): secondary prose, nav links at rest, captions, the sealed tag, help text.
- **Mist** (`{colors.mist}`): blurred sealed figures and "later" tags; the quietest text the system allows.
- **Hairline** (`{colors.hairline}`): 1px rules (footer top, meter footer), the step connector, and the number field's resting underline.
- **On Navy** (`{colors.on-navy}`), **On Navy, soft** (`{colors.on-navy-soft}`), **On Navy, mute** (`{colors.on-navy-mute}`): the three text levels on navy canvases: headline, lede and caption, axis figures and unit.
- **Shade** (`{colors.shade}`), **Shade, deep** (`{colors.shade-deep}`), **Light** (`{colors.light}`): the two ends of every neumorphic shadow. Never used as fills.

### Named Rules
**The One Meaning Rule.** Blue means the viewer's own side, terracotta means the other side, gold means the fair price or the one primary action. No hue is ever borrowed for decoration, status, or a second CTA on the same screen.

**The Same-Grey Rule.** Raised panels, inset grooves and the page share `{colors.ground}`. A panel with a different fill is not neumorphic and does not belong to the meter family; it is a navy canvas or nothing.

**The Hard-Contrast Rule.** Soft surfaces, hard text: body copy on Ground is Ink or Slate, never Mist; gold carries Ink or Navy on it, never white. WCAG 2.1 AA is ruled for the project and the palette is built to meet it.

## Typography

**Display Font:** Sora (weights 500 and 700 loaded; only 700 is used), with Manrope, system-ui fallback
**Body Font:** Albert Sans (400, 500, 600), with Helvetica Neue, system-ui fallback
**Label/Figure Font:** Sora 700 for tracked labels and the fair-price chip; Albert Sans 600 with tabular numerals for figures

**Character:** Sora's geometric bold gives headings and instrument labels the stamped, engraved feel of dial markings; Albert Sans keeps prose and figures plain and readable. The pairing is deliberately unfussy so the numbers, not the type, are the spectacle.

### Hierarchy
- **Display** (Sora 700, `calc(60 * var(--u))`, line-height 0.98, tracking -0.035em): the hero headline on navy. Scales with the design unit; drops to 48px at 1024px and 38px at 640px, where it is allowed to wrap.
- **Headline** (Sora 700, 40px / 34px / 38px, line-height 1.05–1.1, tracking -0.02em): section titles ("Nobody sees the other side's numbers"), the verticals title, and the outcome title on navy. 28px on phones. Titles are `text-wrap: balance`.
- **Title** (Sora 700, 24px, line-height 1.1): card headings inside vertical cards; also the family of the interstitial stage title (30px) and the meter title (`calc(22 * var(--u))`, uppercase tracked).
- **Lede** (Albert Sans 400, `calc(26 * var(--u))`, line-height 1.3): the two-line hero lede in On Navy, soft; 22px then 18px at the breakpoints.
- **Body** (Albert Sans 400, 16px base; 17–19px in prose blocks, line-height 1.5–1.6): all running copy. Prose blocks are capped at 60–62ch.
- **Figure** (Albert Sans 600, 18px, tabular numerals): every price in a meter row and every number field. The fair-price chip is the one figure set in Sora 700 (`calc(25 * var(--rs))`, tracking -0.02em).
- **Label** (Sora 700, 12–14px, uppercase, tracking 0.22em by default; 0.16–0.2em where the label is long or on navy): instrument labels only — meter titles, YOUR RANGE / THEIR RANGE / FAIR PRICE ZONE, the SEALED tag, the lock caption, the outcome fact captions, and "Next"/"Same milestone" tags on vertical cards.
- **Nav and captions** (Albert Sans 500, 15–18px): top-nav links, the "free · 60 seconds · nothing stored" caption, hints and footer.

### Named Rules
**The Tabular Numerals Rule.** `font-variant-numeric: tabular-nums` is set on `html`. Every figure, axis tick and ref code lines up; nothing opts out.

**The Instrument-Label Rule.** Uppercase tracked Sora is a dial marking, used only where it labels a part of the instrument or a fact about it. It is not used as a kicker above a headline.

**The Balanced-Heading Rule.** `h1`–`h3` are Sora 700, Navy, `text-wrap: balance`, zero margin; spacing between heading and copy is owned by the layout, not the heading.

## Layout

The page is a single column of full-width bands on the Ground with a 14px gutter (`calc(14 * var(--u))`) at the first viewport and 10px on phones. There is no fixed max-width grid at the top: the top bar and the navy hero canvas run edge to edge inside the gutter, and the first viewport is a proportional reproduction of the 1672px comp. Everything below the instrument (the "how" columns, the verticals grid, the footer) is centred at `max-width: 1180px`.

**The design unit `--u`.** `--u: min(1px, calc(100vw / 1672))` on `:root`. Every measurement in the top bar, hero, steps row and meter row (heights, paddings, gaps, font sizes, thumb sizes) is written as `calc(N * var(--u))`, where N is the pixel value measured off the approved comp. Above 1672px the unit clamps to 1px, so the layout never inflates; between 1672px and 1024px it shrinks proportionally, so the first viewport keeps the comp's composition. At `max-width: 1024px` the unit is reset to `1px` and the layout switches to fixed rules.

**The reveal scale `--rs`.** RevealCanvas measures itself in `calc(N * var(--rs, 1px))`. The host sets `--rs`: the hero binds it to `--u` so the reveal shrinks with the viewport; it is reset to `1px` at 1024px; and the canvas's own container query drops it to `0.72px` inside containers under 520px (a phone, a result card), where the in-canvas labels hide, a legend takes over beneath, and axis ticks thin to every second value. Any new host of the reveal sets `--rs` (or accepts the 1px default) and gives it a height; the canvas fills whatever box it is given.

**Bands and rhythm.** Hero canvas (`calc(450 * var(--u))` tall, two columns `690u | 1fr`), then the three-step row 30u below, then the instrument 22u below that (two meters around a 166u lock column), then sections at 110px intervals (80px for "how" at tablet, 64px on phones). Inner grids use 24px gaps; card padding is 30px; meter rows are 22u apart. Section and block spacing is fixed pixels, not `--u`, because only the first viewport reproduces the comp.

**Breakpoints.** 1024px (hero to one column, `--u` and `--rs` fixed to 1px, grids collapse, nav links remain), 900px (top bar compacts, text nav links hide leaving wordmark and Start free, outcome meters stack), 640px (phone type sizes, meter rows go two-line with the track beneath, steps tighten), 760px (result card stacks). The reveal's own 520px container query is independent of viewport width.

## Elevation & Depth

Hybrid. The grey world is neumorphic: depth is conveyed by paired soft shadows on a surface that shares the page colour, with the light coming from the top-left in every case. Raised surfaces get a dark shadow bottom-right and a white shadow top-left; inset surfaces get the same pair inverted and inset. There is one scale, three raise sizes and two inset sizes, and every panel, groove, thumb and tag picks from it. Navy canvases are the exception: they sit above the desk and cast a real, tinted drop shadow. Gold elements glow rather than cast.

### Shadow Vocabulary
- **Raise, small** (`box-shadow: 4px 4px 10px var(--shade), -4px -4px 10px var(--light)`): small controls that rest on the ground: the quiet "show the numbers" toggle.
- **Raise, medium** (`box-shadow: 9px 9px 22px var(--shade), -9px -9px 22px var(--light)`): the default `.raised` panel: meters, result card, interstitial stage, the featured vertical card.
- **Raise, large** (`box-shadow: 14px 14px 34px var(--shade), -14px -14px 34px var(--light)`): defined for a hero-scale raised object; not yet used on the homepage.
- **Inset, small** (`box-shadow: inset 2px 2px 5px var(--shade), inset -2px -2px 5px var(--light)`): the default `.inset`: slider grooves, the sealed tag, URL boxes, ref-code chips, the interstitial's round mark, and the "coming later" vertical cards.
- **Inset, medium** (`box-shadow: inset 3px 3px 8px var(--shade-deep), inset -3px -3px 8px var(--light)`): a deeper groove; defined in the scale for wells that need to read as recessed below a small inset.
- **Thumb** (`3px 3px 8px var(--shade-deep), -3px -3px 8px var(--light), inset 0 0 0 6px var(--thumb)`): the meter thumb: a raised ground-coloured disc with a 6px ring of the party colour inside it.
- **Lift, navy** (`0 18px 40px rgba(29,53,87,0.3)`): the navy hero canvas and outcome panel. The navy pill uses a lighter `0 4px 12px rgba(29,53,87,0.25)`.
- **Lift, gold** (`0 8px 22px rgba(232,179,75,0.45)`): the gold pill's glow; the fair-price chip uses `0 10px 28px` of the same colour, the zone `0 0 34px`.
- **Party glow** (`0 0 24px rgba(92,142,200,0.55)` / `rgba(198,121,104,0.55)` plus an offset 60px trailing glow): the reveal bars, each glowing in its own colour with the wake extending in its direction of travel.

### Named Rules
**The One Light Rule.** Light comes from the top-left everywhere. Raised is dark bottom-right and white top-left; inset is the inverse. Nothing in the grey world uses a centred, offset-only or hard shadow.

**The Navy Sits Above Rule.** Only navy canvases cast a tinted drop shadow (`--lift-navy`). Grey surfaces are pressed out of the page and never "float".

**The Gold Glows Rule.** Gold elements (pill, chip, zone, chip pointer dot) use a gold-tinted diffuse glow, never a grey shadow; the glow is how the fair price reads as lit.

## Shapes

Everything is rounded; nothing is square. Buttons and tags are full pills (`999px`). Raised neumorphic panels use 24px corners; navy canvases and vertical cards use 20px; small fields and the correction notice use 12px; the fair-price chip and the zone use 12px and 10px scaled by `--rs`; the focus ring rounds to 10px. Slider grooves are 12u tall with 6px corners; bars in the reveal are 26u tall with fully round ends; thumbs, bar end-handles, step numbers, the interstitial mark and the wordmark target are perfect circles. Borders are rare: a 2px navy ring on step numbers, a 2px pale-gold hairline on the chip and zone, 1px hairlines for rules and the number field's underline. Nothing is clipped except the hero canvas (`overflow: hidden`) so the reveal's wakes stay inside the navy.

## Components

### Buttons
Pills, Sora Bold, no border, one primary per screen.
- **Shape:** full pill (`999px`), inline-flex with a 0.5em gap for an inline SVG arrow (24u in the hero, 22px in forms).
- **Gold (primary):** Lit Gold fill, Ink text, gold glow; 58px tall, `0 34px` padding, 22–23px type at hero scale; 52–54px / 19–20px in forms and on phones. Hover shifts the fill to Fair Gold; active presses `translateY(1px) scale(0.99)`. Used for "Set your meter", "Seal my meter" style submits and the demo's Start free.
- **Navy (secondary):** Broker Navy fill, On Navy text, light navy shadow; 46px / `0 30px` / 19px in the top bar, 48px / `0 22–24px` / 17px in cards. Hover to Navy Hover. Used for "Start free", "Start again", "Copy link", "Try it as a recruiter".
- **Quiet:** ground fill, Navy text, Raise-small shadow, 48px; the "show the numbers" toggle. Reads as a raised control, not a coloured action.
- **Focus:** the global ring, 3px Fair Gold at 3px offset, 10px radius. Disabled: 60% opacity with a `progress` cursor and an 18px white ring spinner inside the pill.

### Cards / Containers
- **Raised panel (`.raised`):** Ground fill, 24px corners, Raise-medium. The meter, the result card, the interstitial stage and the featured vertical card. Padding 27u/33u for the meter, 26–30px elsewhere.
- **Navy canvas:** Broker Navy fill, 20px corners, Lift-navy, On Navy text, `overflow: hidden`. The hero (450u tall, 690u | 1fr) and the outcome panel (36px 40px 30px). The live hero adds a 3px gold ring at 55%.
- **Inset well (`.inset`):** Ground fill, Inset-small. Grooves, URL boxes, ref chips, the sealed tag, and "later" vertical cards, which are inset to read as not-yet-raised.
- **Border:** none on any container; hairlines only inside (meter footer, footer top).

### Inputs / Fields
- **Meter number field:** borderless, transparent, right-aligned Albert Sans 600 18px tabular figures, 78px wide, with a 2px Hairline underline that turns Fair Gold on focus and the currency symbol in Slate beside it.
- **Range slider:** the native input is stretched invisibly over the inset groove (36px tall hit area); the visible thumb is the neumorphic ring-disc, and keyboard focus draws the gold ring around the thumb.
- **URL / read-only box:** inset well, 12px corners, 12px 14px padding, 14px Ink text.
- **Error:** a 15px line in a deep red (`#8d2b3a`) beneath the meter; the flow's correction notice is a 12% terracotta tint with dark terracotta text in a 12px-radius box.

### Navigation
- **Top bar:** 68u tall on the ground (no fill, no shadow), wordmark left (target-circle SVG with a gold centre, Sora 700 30u, -0.025em), links right in Albert Sans 500 18u Slate that darken to Navy on hover, then the navy "Start free" pill. Below 900px the bar is 60px, the wordmark 22px, and the text links hide, leaving wordmark and pill.
- **Steps row:** three circular 38u step numbers (2px navy ring; current = navy fill, white number; done = gold fill, navy number) joined by 60u hairlines that turn gold when done, with Albert Sans 500 20u labels.
- **Footer:** hairline top, Sora Bold wordmark, Slate links, note pushed right; wraps and stacks on phones.

### The Meter (signature)
A raised panel whose head carries an uppercase Sora title in Navy and an inset SEALED tag (Slate, 0.16em, lock glyph). Beneath, four rows on a `label | groove | figure` grid (label column 190u, figure column 92u, 22u gaps): the Van Westendorp question in 18u Ink with optional Slate help text, the inset groove with the party-coloured ring thumb, and the figure. In sealed mode the figures are Mist, tracked 0.08em and blurred 1.2px, with an sr-only "hidden until the reveal". In entry mode each row is a live range input plus the number field. The panel's accent (`--thumb`, `--thumb-ring`, `--groove-fill`) is blue for "you" and terracotta for "them". On phones the row becomes two lines with the track underneath.

### The Reveal (signature)
A navy canvas (`role="img"`, with a full aria-label) holding, top to bottom: the gold fair-price chip on a 2u hairline pointer with a glowing dot; the blue "yours" lane with its tracked label; the gold zone rectangle (translucent gold gradient, pale-gold hairline, gold glow, inner glow); the terracotta "theirs" lane; the FAIR PRICE ZONE label centred under the zone; and an axis of 1px ticks and On-Navy-mute tabular figures with the unit at the right. Bars are 26u pills with 22u white end handles and a blurred 34% wake trailing behind. `variant="blind"` omits the counterparty lane entirely; `compact` tightens the lanes for result cards. Motion, when `animate` is on: bars drift in 14% from their own side over 900ms (`--dur-slow`, `--ease-out`), the zone and its label fade in over 700ms from 600ms, the chip lands (fade, rise 10u, scale 0.85 to 1) over 600ms from 900ms, and the wakes fade from 0.9 to 0.35 over 1600ms from 400ms.

### Interstitial stage
A centred raised panel (max 620px, 44px 32px 40px) with a 72px inset circular mark holding a 40px icon in the stage's accent (blue, terracotta or gold), a 30px Sora title, 18px Slate body capped at 44ch, and a navy pill action.

## Do's and Don'ts

### Do:
- **Do** build every first-viewport measurement as `calc(N * var(--u))` from the comp's pixel value, and reset `--u` to 1px at the 1024px breakpoint.
- **Do** give any host of RevealCanvas a height and a `--rs`; bind it to `--u` when the canvas lives in the first viewport.
- **Do** keep raised panels, inset wells and the page on the same Ground colour and pick shadows only from the five-step scale (`--raise-sm/md/lg`, `--inset-sm/md`).
- **Do** colour the viewer's side blue and the counterparty terracotta in every meter, bar, thumb, label and legend, and switch the pair with the `accent` / `yourAccent` prop rather than new CSS.
- **Do** reserve gold for the fair price, the deal zone, completed progress, focus and the one primary action; hover it darker (`--gold-2` to `--gold`), never lighter.
- **Do** set figures in Albert Sans 600 with tabular numerals and the chip in Sora 700; let the global `tabular-nums` do the alignment.
- **Do** write motion as short eased-out transforms and opacity (`--ease-out`, 180ms for state, 600–900ms for the reveal) and rely on the global reduced-motion collapse rather than per-component overrides.
- **Do** use `variant="blind"` for any viewer who must not see the other side; the counterparty range is not passed in at all.
- **Do** keep prose to 44–62ch and use `text-wrap: balance` on headings.

### Don't:
- **Don't** put a second gold action, a gold status badge or gold decoration on a screen that already has its primary action.
- **Don't** fill a neumorphic panel with white, a tint or a border; a different-coloured container is a navy canvas or it is not a container.
- **Don't** cast a grey drop shadow under gold, or a hard offset shadow anywhere; the only drop shadows are the navy lifts.
- **Don't** render both parties' ranges (`variant="both"`) on a blind payload, and don't reintroduce the other side's numbers through a legend, tooltip or axis annotation.
- **Don't** use the uppercase tracked label style as a kicker or eyebrow above a headline; it marks parts of the instrument only.
- **Don't** add points, streaks, scores or "winner" states to the steps row or the reveal; progress marks completion (gold fill) and nothing else.
- **Don't** show testimonials, logos, counters or "coming soon" proof placeholders; the working meter and reveal are the proof.
- **Don't** scale the first viewport above the comp (`--u` is clamped at 1px) or let `--u` leak into the sections below the instrument, which use fixed spacing.
