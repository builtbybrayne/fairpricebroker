<script lang="ts">
	/**
	 * The living reveal: two ranges drift toward each other, the deal zone
	 * glows, the fair price lands. "The maths is the motion."
	 *
	 * Disclosure rule (docs/design-brief.md ruling; T2-product-surfaces §2.6):
	 * `variant: 'both'` renders both parties' ranges and is permitted ONLY
	 * on full-detail payloads (casual, host-visible host view). `variant:
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
		fair = null,
		fairLabel = null,
		yourLabel = 'Your range',
		theirLabel = 'Their range',
		zoneLabel = 'Fair price zone',
		variant = 'both',
		animate = true,
		compact = false
	}: {
		axis?: { min: number; max: number; step: number };
		currency?: string;
		yours: Range;
		theirs?: Range | null;
		zone?: Range | null;
		fair?: number | null;
		fairLabel?: string | null;
		yourLabel?: string;
		theirLabel?: string;
		zoneLabel?: string;
		variant?: 'both' | 'blind';
		animate?: boolean;
		compact?: boolean;
	} = $props();

	const pct = (v: number) => ((v - axis.min) / (axis.max - axis.min)) * 100;
	const clampPct = (v: number) => Math.max(0, Math.min(100, pct(v)));

	const ticks = $derived.by(() => {
		const out: number[] = [];
		for (let v = axis.min; v <= axis.max + 1e-9; v += axis.step) out.push(v);
		return out;
	});

	const showTheirs = $derived(variant === 'both' && theirs !== null);
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
	role="img"
	aria-label={showTheirs
		? `${yourLabel} ${currency}${yours.lo} to ${currency}${yours.hi}; ${theirLabel} ${currency}${theirs?.lo} to ${currency}${theirs?.hi}; fair price ${fairText}`
		: `${yourLabel} ${currency}${yours.lo} to ${currency}${yours.hi}; fair price ${fairText}`}
>
	<div class="reveal__field">
		{#if fair !== null}
			<div class="chip" style:left={`${clampPct(fair)}%`}>
				<span class="chip__value">{fairText}</span>
				<span class="chip__pointer" aria-hidden="true"></span>
			</div>
		{/if}

		<div class="lane lane--yours">
			<span class="lane__label caps">{yourLabel}</span>
			<div
				class="bar bar--yours"
				style:left={`${clampPct(yours.lo)}%`}
				style:width={`${clampPct(yours.hi) - clampPct(yours.lo)}%`}
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
				<div
					class="bar bar--theirs"
					style:left={`${clampPct(theirs.lo)}%`}
					style:width={`${clampPct(theirs.hi) - clampPct(theirs.lo)}%`}
				>
					<i class="bar__end bar__end--lo"></i>
					<i class="bar__end bar__end--hi"></i>
				</div>
				<span class="lane__label lane__label--right caps">{theirLabel}</span>
			</div>
		{/if}
	</div>

	<div class="axis" aria-hidden="true">
		<div class="axis__rule"></div>
		{#each ticks as t (t)}
			<span class="axis__tick" style:left={`${pct(t)}%`}><i></i><b>{t}</b></span>
		{/each}
		<span class="axis__unit">{currency} (GBP)</span>
	</div>
</div>

<style>
	.reveal {
		position: relative;
		width: 100%;
		height: 100%;
		color: var(--on-navy);
		font-family: var(--font-body);
	}

	.reveal__field {
		position: absolute;
		inset: 0 94px 60px 12px;
	}

	/* fair-price chip ---------------------------------------------------- */
	.chip {
		position: absolute;
		top: 12px;
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
		font-size: 25px;
		letter-spacing: -0.02em;
		line-height: 1;
		padding: 13px 16px;
		border-radius: 12px;
		border: 2px solid #f3d27a;
		box-shadow: 0 10px 28px rgba(232, 179, 75, 0.45);
		white-space: nowrap;
	}

	.chip__pointer {
		width: 2px;
		height: 78px;
		background: linear-gradient(var(--gold), rgba(232, 179, 75, 0.2));
	}

	.chip__pointer::after {
		content: '';
		position: absolute;
		bottom: -7px;
		left: 50%;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #fbe9b3;
		box-shadow: 0 0 10px rgba(232, 179, 75, 0.9);
		transform: translateX(-50%);
	}

	/* lanes and bars ----------------------------------------------------- */
	.lane {
		position: absolute;
		left: 0;
		right: 0;
	}

	.lane--yours {
		top: 62px;
		height: 72px;
	}

	.lane--theirs {
		top: 146px;
		height: 68px;
	}

	.lane__label {
		position: absolute;
		top: -8px;
		left: 0.4%;
		font-size: 14px;
		letter-spacing: 0.2em;
		color: var(--blue-2);
	}

	.lane__label--right {
		left: auto;
		right: 1%;
		top: auto;
		bottom: 0;
		color: var(--terracotta-2);
	}

	.bar {
		position: absolute;
		top: 26px;
		height: 26px;
		border-radius: 13px;
		z-index: 2;
		will-change: transform;
	}

	.lane--theirs .bar {
		top: 0;
		height: 26px;
		border-radius: 13px;
	}

	.bar--yours {
		background: #5c8ec8;
		box-shadow:
			0 0 24px rgba(92, 142, 200, 0.55),
			20px 0 60px -10px rgba(92, 142, 200, 0.5);
	}

	.bar--theirs {
		background: #c67968;
		box-shadow:
			0 0 24px rgba(198, 121, 104, 0.55),
			-20px 0 60px -10px rgba(198, 121, 104, 0.5);
	}

	/* the wake: a soft trail behind each bar, fading as it settles */
	.bar::before {
		content: '';
		position: absolute;
		top: 2px;
		bottom: 2px;
		width: 34%;
		border-radius: inherit;
		opacity: 0.55;
		filter: blur(8px);
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
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #fff;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.18);
	}

	.bar__end--lo {
		left: 0;
	}

	.bar__end--hi {
		left: 100%;
	}

	/* the zone ----------------------------------------------------------- */
	.zone {
		position: absolute;
		top: 112px;
		height: 66px;
		border-radius: 10px;
		background: linear-gradient(rgba(214, 200, 150, 0.55), rgba(240, 190, 120, 0.7));
		border: 2px solid #f5dc8c;
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.25),
			0 0 34px rgba(232, 179, 75, 0.45),
			inset 0 0 18px rgba(255, 235, 170, 0.35);
		z-index: 3;
		pointer-events: none;
	}

	.zone__label {
		position: absolute;
		top: 192px;
		transform: translateX(-50%);
		font-size: 14px;
		letter-spacing: 0.2em;
		color: var(--gold-2);
		white-space: nowrap;
	}

	/* axis --------------------------------------------------------------- */
	.axis {
		position: absolute;
		left: 12px;
		right: 94px;
		bottom: 0;
		height: 50px;
		color: var(--on-navy-mute);
		font-size: 17px;
	}

	.axis__rule {
		position: absolute;
		left: 0;
		right: 0;
		top: 14px;
		height: 1px;
		background: rgba(143, 163, 194, 0.7);
	}

	.axis__tick {
		position: absolute;
		top: 4px;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.axis__tick i {
		display: block;
		width: 1px;
		height: 20px;
		background: rgba(143, 163, 194, 0.9);
	}

	.axis__tick b {
		font-weight: 400;
	}

	.axis__unit {
		position: absolute;
		right: -50px;
		top: 12px;
		font-size: 15px;
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
			transform: translate(-50%, 10px) scale(0.85);
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
		font-size: 22px;
		padding: 10px 16px;
	}

	.reveal--compact .chip__pointer {
		height: 40px;
	}

	.reveal--compact .lane--yours {
		top: 40px;
	}

	.reveal--compact .lane--theirs {
		top: 108px;
	}

	.reveal--compact .zone {
		top: 84px;
		height: 56px;
	}

	.reveal--compact .zone__label {
		top: 150px;
	}
</style>
