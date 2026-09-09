<script lang="ts">
	/**
	 * The living reveal: two ranges drift toward each other, the deal zone
	 * glows, the fair price lands. "The maths is the motion."
	 *
	 * Disclosure rule (docs/design-brief.md ruling; T2-product-surfaces §2.6):
	 * `variant: 'both'` renders both parties' ranges and is permitted ONLY
	 * on full-detail payloads (casual, and the broker view when the broker sees figures). `variant:
	 * 'blind'` renders the viewer's own range and the fair price landing —
	 * the counterparty's positions are never passed in, so they cannot leak.
	 */
	type Range = { lo: number; hi: number };

	let {
		axis = { min: 200, max: 800, step: 100 },
		currency = '£',
		yours,
		theirs = null,
		zone = null,
		yoursInner = null,
		theirsInner = null,
		fair = null,
		fairLabel = null,
		yourLabel = 'Your range',
		theirLabel = 'Their range',
		zoneLabel = 'Fair price zone',
		variant = 'both',
		animate = true,
		compact = false,
		yourAccent = 'blue',
		unit = 'GBP'
	}: {
		axis?: { min: number; max: number; step: number };
		currency?: string;
		yours: Range;
		theirs?: Range | null;
		zone?: Range | null;
		/** When given, the bar is the inner pair and the full range is a thin line behind it. */
		yoursInner?: Range | null;
		theirsInner?: Range | null;
		fair?: number | null;
		fairLabel?: string | null;
		yourLabel?: string;
		theirLabel?: string;
		zoneLabel?: string;
		/**
		 * both: both ranges (full-detail payloads only). blind: the viewer's
		 * own range and the fair price. outcome: the viewer's own range, the
		 * overlap zone and the fair price, with the other side's range never
		 * drawn (the sealed check before "show the numbers").
		 */
		variant?: 'both' | 'blind' | 'outcome' | 'zone';
		animate?: boolean;
		compact?: boolean;
		/** Colour of the viewer's own bar: blue (employer/A side) or terracotta (candidate/B side). */
		yourAccent?: 'blue' | 'terracotta';
		unit?: string;
	} = $props();

	const pct = (v: number) => ((v - axis.min) / (axis.max - axis.min)) * 100;
	const clampPct = (v: number) => Math.max(0, Math.min(100, pct(v)));

	const ticks = $derived.by(() => {
		const out: number[] = [];
		for (let v = axis.min; v <= axis.max + 1e-9; v += axis.step) out.push(v);
		return out;
	});

	let width = $state(0);
	const tickEvery = $derived(width > 0 && width < 420 ? 2 : 1);
	const visibleTicks = $derived(ticks.filter((_, i) => i % tickEvery === 0));
	// zone: both sides present but drawn full-width, so only the overlap and
	// the fair figure carry information (the casual default; ranges on demand).
	const showTheirs = $derived((variant === 'both' || variant === 'zone') && theirs !== null);
	const full = $derived(variant === 'zone');
	const left = (v: number) => (full ? 0 : clampPct(v));
	const span = (lo: number, hi: number) => (full ? 100 : clampPct(hi) - clampPct(lo));
	const fairText = $derived(
		fairLabel ??
			(fair === null
				? ''
				: `${currency}${fair.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
	);
</script>

<div
	class="reveal"
	class:reveal--animate={animate}
	class:reveal--compact={compact}
	class:reveal--blind={!showTheirs && variant !== 'outcome'}
	class:reveal--outcome={variant === 'outcome'}
	class:reveal--zone={full}
	role="img"
	bind:clientWidth={width}
	aria-label={showTheirs
		? `${yourLabel} and ${theirLabel} converging on a fair price of ${fairText}`
		: `${yourLabel} and a fair price of ${fairText}`}
>
	<div class="reveal__field">
		{#if fair !== null}
			<div class="chip" style:left={`${clampPct(fair)}%`}>
				<span class="chip__value">{fairText}</span>
				<span class="chip__pointer" aria-hidden="true"></span>
			</div>
		{/if}

		<div class="lane lane--yours">
			<span class="lane__label caps" class:lane__label--terracotta={yourAccent === 'terracotta'}
				>{yourLabel}</span
			>
			{#if yoursInner && !full}
				<i
					class="outer outer--{yourAccent}"
					style:left={`${clampPct(yours.lo)}%`}
					style:width={`${clampPct(yours.hi) - clampPct(yours.lo)}%`}
				></i>
			{/if}
			<div
				class="bar bar--yours bar--{yourAccent}"
				style:left={`${left(yoursInner && !full ? yoursInner.lo : yours.lo)}%`}
				style:width={`${span(yoursInner && !full ? yoursInner.lo : yours.lo, yoursInner && !full ? yoursInner.hi : yours.hi)}%`}
			>
				<i class="bar__end bar__end--lo"></i>
				<i class="bar__end bar__end--hi"></i>
			</div>
		</div>

		{#if zone}
			<div
				class="zone"
				style:left={`${clampPct(zone.lo)}%`}
				style:width={`${clampPct(zone.hi) - clampPct(zone.lo)}%`}
			></div>
			<span class="zone__label caps" style:left={`${(clampPct(zone.lo) + clampPct(zone.hi)) / 2}%`}
				>{zoneLabel}</span
			>
		{/if}

		{#if showTheirs && theirs}
			<div class="lane lane--theirs">
				{#if theirsInner && !full}
					<i
						class="outer outer--terracotta outer--theirs"
						style:left={`${clampPct(theirs.lo)}%`}
						style:width={`${clampPct(theirs.hi) - clampPct(theirs.lo)}%`}
					></i>
				{/if}
				<div
					class="bar bar--theirs"
					style:left={`${left(theirsInner && !full ? theirsInner.lo : theirs.lo)}%`}
					style:width={`${span(theirsInner && !full ? theirsInner.lo : theirs.lo, theirsInner && !full ? theirsInner.hi : theirs.hi)}%`}
				>
					<i class="bar__end bar__end--lo"></i>
					<i class="bar__end bar__end--hi"></i>
				</div>
				<span class="lane__label lane__label--right caps">{theirLabel}</span>
			</div>
		{/if}
	</div>

	<ul class="legend" aria-hidden="true">
		<li><i class="legend__swatch legend__swatch--{yourAccent}"></i>{yourLabel}</li>
		{#if showTheirs}<li><i class="legend__swatch legend__swatch--theirs"></i>{theirLabel}</li>{/if}
		{#if zone}<li><i class="legend__swatch legend__swatch--zone"></i>{zoneLabel}</li>{/if}
	</ul>

	<div class="axis" aria-hidden="true">
		<div class="axis__rule"></div>
		{#each visibleTicks as t (t)}
			<span class="axis__tick" style:left={`${pct(t)}%`}
				><i></i><b>{t.toLocaleString('en-GB')}</b></span
			>
		{/each}
		<span class="axis__unit">{currency} ({unit})</span>
	</div>
</div>

<style>
	.reveal {
		position: relative;
		width: 100%;
		height: 100%;
		container-type: inline-size;
		color: var(--on-navy);
		font-family: var(--font-body);
	}

	.reveal__field {
		position: absolute;
		inset: 0 calc(94 * var(--rs, 1px)) calc(60 * var(--rs, 1px)) calc(12 * var(--rs, 1px));
	}

	/* fair-price chip ---------------------------------------------------- */
	.chip {
		position: absolute;
		top: calc(12 * var(--rs, 1px));
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		z-index: 3;
	}

	.chip__value {
		display: inline-block;
		background: var(--gold-2);
		color: var(--navy);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: calc(25 * var(--rs, 1px));
		letter-spacing: -0.02em;
		line-height: 1;
		padding: calc(13 * var(--rs, 1px)) calc(16 * var(--rs, 1px));
		border-radius: calc(12 * var(--rs, 1px));
		border: calc(2 * var(--rs, 1px)) solid #f3d27a;
		box-shadow: 0 calc(10 * var(--rs, 1px)) calc(28 * var(--rs, 1px)) rgba(232, 179, 75, 0.45);
		white-space: nowrap;
	}

	.chip__pointer {
		width: calc(2 * var(--rs, 1px));
		height: calc(78 * var(--rs, 1px));
		background: linear-gradient(var(--gold), rgba(232, 179, 75, 0.2));
	}

	.chip__pointer::after {
		content: '';
		position: absolute;
		bottom: -7px;
		left: 50%;
		width: calc(14 * var(--rs, 1px));
		height: calc(14 * var(--rs, 1px));
		border-radius: 50%;
		background: #fbe9b3;
		box-shadow: 0 0 calc(10 * var(--rs, 1px)) rgba(232, 179, 75, 0.9);
		transform: translateX(-50%);
	}

	/* lanes and bars ----------------------------------------------------- */
	.lane {
		position: absolute;
		left: 0;
		right: 0;
	}

	.lane--yours {
		top: calc(62 * var(--rs, 1px));
		height: calc(72 * var(--rs, 1px));
	}

	.lane--theirs {
		top: calc(146 * var(--rs, 1px));
		height: calc(68 * var(--rs, 1px));
	}

	.lane__label {
		position: absolute;
		top: -8px;
		left: 0.4%;
		font-size: calc(14 * var(--rs, 1px));
		letter-spacing: 0.2em;
		color: var(--blue-2);
	}

	.lane__label--terracotta {
		color: var(--terracotta-2);
	}

	.lane__label--right {
		left: auto;
		right: calc(-56 * var(--rs, 1px));
		top: auto;
		bottom: 0;
		color: var(--terracotta-2);
	}

	.bar {
		position: absolute;
		top: calc(26 * var(--rs, 1px));
		height: calc(26 * var(--rs, 1px));
		border-radius: calc(13 * var(--rs, 1px));
		z-index: 2;
		will-change: transform;
	}

	.lane--theirs .bar {
		top: 0;
		height: calc(26 * var(--rs, 1px));
		border-radius: calc(13 * var(--rs, 1px));
	}

	.bar--yours,
	.bar--blue {
		background: #5c8ec8;
		box-shadow:
			0 0 calc(24 * var(--rs, 1px)) rgba(92, 142, 200, 0.55),
			calc(20 * var(--rs, 1px)) 0 calc(60 * var(--rs, 1px)) -10px rgba(92, 142, 200, 0.5);
	}

	.bar--theirs,
	.bar--yours.bar--terracotta {
		background: #c67968;
		box-shadow:
			0 0 calc(24 * var(--rs, 1px)) rgba(198, 121, 104, 0.55),
			-20px 0 calc(60 * var(--rs, 1px)) -10px rgba(198, 121, 104, 0.5);
	}

	/* the outer range: a thin line behind the inner bar, with end ticks */
	.outer {
		position: absolute;
		top: calc(37 * var(--rs, 1px));
		height: calc(4 * var(--rs, 1px));
		border-radius: calc(2 * var(--rs, 1px));
		background: rgba(92, 142, 200, 0.45);
		z-index: 1;
	}

	.outer::before,
	.outer::after {
		content: '';
		position: absolute;
		top: calc(-6 * var(--rs, 1px));
		width: calc(2 * var(--rs, 1px));
		height: calc(16 * var(--rs, 1px));
		background: inherit;
		border-radius: 1px;
	}

	.outer::before {
		left: 0;
	}

	.outer::after {
		right: 0;
	}

	.outer--terracotta {
		background: rgba(198, 121, 104, 0.5);
	}

	.lane--theirs .outer {
		top: calc(11 * var(--rs, 1px));
	}

	/* the wake: a soft trail behind each bar, fading as it settles */
	.bar::before {
		content: '';
		position: absolute;
		top: calc(2 * var(--rs, 1px));
		bottom: calc(2 * var(--rs, 1px));
		width: 34%;
		border-radius: inherit;
		opacity: 0.55;
		filter: blur(calc(8 * var(--rs, 1px)));
	}

	.bar--yours::before {
		right: -30%;
		background: linear-gradient(90deg, rgba(92, 142, 200, 0.7), transparent);
	}

	.bar--theirs::before {
		left: -30%;
		background: linear-gradient(270deg, rgba(198, 121, 104, 0.7), transparent);
	}

	.bar__end {
		position: absolute;
		top: 50%;
		width: calc(22 * var(--rs, 1px));
		height: calc(22 * var(--rs, 1px));
		border-radius: 50%;
		background: #fff;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 0 calc(4 * var(--rs, 1px)) rgba(255, 255, 255, 0.18);
	}

	.bar__end--lo {
		left: 0;
	}

	.bar__end--hi {
		left: 100%;
	}

	/* the zone ----------------------------------------------------------- */
	.zone {
		/* spans both lanes: from above the first bar to below the second */
		position: absolute;
		top: calc(80 * var(--rs, 1px));
		height: calc(100 * var(--rs, 1px));
		border-radius: calc(10 * var(--rs, 1px));
		background: linear-gradient(rgba(214, 200, 150, 0.55), rgba(240, 190, 120, 0.7));
		border: calc(2 * var(--rs, 1px)) solid #f5dc8c;
		box-shadow:
			0 0 0 calc(1 * var(--rs, 1px)) rgba(255, 255, 255, 0.25),
			0 0 calc(34 * var(--rs, 1px)) rgba(232, 179, 75, 0.45),
			inset 0 0 calc(18 * var(--rs, 1px)) rgba(255, 235, 170, 0.35);
		z-index: 3;
		pointer-events: none;
	}

	.zone__label {
		position: absolute;
		top: calc(192 * var(--rs, 1px));
		transform: translateX(-50%);
		font-size: calc(14 * var(--rs, 1px));
		letter-spacing: 0.2em;
		color: var(--gold-2);
		white-space: nowrap;
	}

	/* axis --------------------------------------------------------------- */
	.axis {
		position: absolute;
		left: calc(12 * var(--rs, 1px));
		right: calc(94 * var(--rs, 1px));
		bottom: 0;
		height: calc(50 * var(--rs, 1px));
		color: var(--on-navy-mute);
		font-size: round(calc(17 * var(--rs, 1px)), 1px);
	}

	.axis__rule {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(14 * var(--rs, 1px));
		height: calc(1 * var(--rs, 1px));
		background: rgba(143, 163, 194, 0.7);
	}

	.axis__tick {
		position: absolute;
		top: calc(4 * var(--rs, 1px));
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(10 * var(--rs, 1px));
	}

	.axis__tick i {
		display: block;
		width: calc(1 * var(--rs, 1px));
		height: calc(20 * var(--rs, 1px));
		background: rgba(143, 163, 194, 0.9);
	}

	.axis__tick b {
		font-weight: 400;
	}

	.axis__unit {
		position: absolute;
		right: calc(-94 * var(--rs, 1px));
		top: calc(12 * var(--rs, 1px));
		font-size: calc(15 * var(--rs, 1px));
	}

	/* motion: the ranges drift in from the outside; wakes fade as they settle */
	.reveal--animate .bar--yours {
		animation: drift-in-right var(--dur-slow) var(--ease-out) both;
	}

	.reveal--animate .bar--theirs {
		animation: drift-in-left var(--dur-slow) var(--ease-out) both;
	}

	.reveal--animate .zone,
	.reveal--animate .zone__label {
		animation: zone-in 700ms var(--ease-out) 600ms both;
	}

	.reveal--animate .chip {
		animation: land 600ms var(--ease-out) 900ms both;
	}

	.reveal--animate .bar::before {
		animation: wake-fade 1600ms ease-out 400ms both;
	}

	@keyframes drift-in-right {
		from {
			transform: translateX(-14%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes drift-in-left {
		from {
			transform: translateX(14%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes zone-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes land {
		from {
			opacity: 0;
			transform: translate(-50%, calc(10 * var(--rs, 1px))) scale(0.85);
		}
		to {
			opacity: 1;
			transform: translate(-50%, 0) scale(1);
		}
	}

	@keyframes wake-fade {
		from {
			opacity: 0.9;
		}
		to {
			opacity: 0.35;
		}
	}

	/* compact: used inside result cards */
	.reveal--compact .chip__value {
		font-size: calc(22 * var(--rs, 1px));
		padding: calc(10 * var(--rs, 1px)) calc(16 * var(--rs, 1px));
	}

	.reveal--compact .chip__pointer {
		height: calc(40 * var(--rs, 1px));
	}

	/* one range only: the pointer lands on the bar itself, and the label
	   moves under the bar so the chip can never sit on it */
	.reveal--blind .chip__pointer {
		height: calc(36 * var(--rs, 1px));
	}

	.reveal--blind.reveal--compact .chip__pointer {
		height: calc(52 * var(--rs, 1px));
	}

	.reveal--blind .lane--yours .lane__label {
		top: calc(60 * var(--rs, 1px));
	}

	/* zone: full-width bars with no ends and no wake; the overlap does the talking */
	.reveal--zone .bar__end,
	.reveal--zone .bar::before {
		display: none;
	}

	.reveal--zone .bar {
		border-radius: calc(4 * var(--rs, 1px));
		opacity: 0.55;
		box-shadow: none;
	}

	.reveal--zone .lane__label--right {
		right: calc(-56 * var(--rs, 1px));
	}

	/* outcome: one range, the zone hugging it, the label as a legend below */
	.reveal--outcome .chip__pointer {
		height: calc(36 * var(--rs, 1px));
	}

	.reveal--outcome .zone {
		top: calc(80 * var(--rs, 1px));
		height: calc(42 * var(--rs, 1px));
	}

	.reveal--outcome .zone__label {
		top: calc(132 * var(--rs, 1px));
	}

	/* compact: the chip clears the lane label; the zone spans both bars */
	.reveal--compact .lane--yours {
		top: calc(72 * var(--rs, 1px));
	}

	.reveal--compact .lane--theirs {
		top: calc(140 * var(--rs, 1px));
	}

	.reveal--compact .zone {
		top: calc(90 * var(--rs, 1px));
		height: calc(84 * var(--rs, 1px));
	}

	.reveal--compact .zone__label {
		top: calc(182 * var(--rs, 1px));
	}

	/* the legend replaces the in-canvas labels only where they cannot
	   keep clear of each other (narrow containers) */
	.legend {
		display: none;
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		gap: 4px 14px;
		flex-wrap: wrap;
		line-height: 1.6;
		font-size: 11px;
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--on-navy-mute);
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.legend__swatch {
		width: 14px;
		height: 8px;
		border-radius: 4px;
	}

	.legend__swatch--blue {
		background: #5c8ec8;
	}

	.legend__swatch--terracotta,
	.legend__swatch--theirs {
		background: #c67968;
	}

	.legend__swatch--zone {
		background: rgba(237, 197, 94, 0.55);
		border: 1px solid #f5dc8c;
	}

	/* narrow containers (a phone, a result card): keep type legible and
	   labels apart; tick density is thinned by the component (tickEvery) */
	@container (max-width: 520px) {
		.reveal {
			--rs: 0.72px;
		}
		.lane__label,
		.zone__label {
			display: none;
		}
		.legend {
			display: flex;
		}
		.axis {
			bottom: 50px;
		}
		.reveal__field {
			bottom: calc(60 * var(--rs, 1px) + 50px);
		}
		.reveal__field,
		.axis {
			right: 44px;
			left: 6px;
		}
		.axis__unit {
			right: -44px;
		}
		.lane__label,
		.zone__label {
			font-size: 11px;
			letter-spacing: 0.14em;
		}
		.lane__label--terracotta {
			color: var(--terracotta-2);
		}

		.lane__label--right {
			bottom: auto;
			top: calc(26 * var(--rs, 1px) + 30px);
		}
		.zone__label {
			top: calc(192 * var(--rs, 1px) + 34px);
		}
		.axis {
			font-size: 12px;
		}
		.axis__unit {
			font-size: 11px;
			right: -42px;
		}
		.chip__value {
			font-size: 20px;
			padding: 10px 14px;
		}
	}
</style>
