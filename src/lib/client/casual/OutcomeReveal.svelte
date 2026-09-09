<script lang="ts">
	/**
	 * The casual outcome (T3-m1-casual-mode §5, T2-product-surfaces §6 R6):
	 * the reconciliation — fair price, zone, the both-ranges animation —
	 * WITHOUT either side's raw figures until "Show the numbers".
	 */
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import ResultCard from './ResultCard.svelte';
	import { formatMoney, niceAxis } from './casualClient';
	import type { CasualResultPayload } from '$lib/server/casual/casualPayload';
	import type { CasualScenario, CasualSide } from '$lib/casual/casualTemplate';
	import { sideToDirection, type Side } from '$lib/domain/terms';

	let {
		result,
		shareRef,
		scenario,
		labels,
		currency = '£',
		onrestart
	}: {
		result: CasualResultPayload;
		shareRef: string;
		scenario: CasualScenario;
		labels: Record<Side, string>;
		currency?: string;
		onrestart: () => void;
	} = $props();

	let numbersShown = $state(false);
	// The default reveal keeps both ranges to itself: full-width bars, the
	// overlap and the fair figure. "Show the ranges" draws the real ends.
	let rangesShown = $state(false);
	const rowsFor = (side: CasualSide) =>
		side.points.map((p) => ({ key: p.key, label: p.label, help: p.prompt }));

	// The payload keeps the engine's keys; the sides index them through the
	// domain's one mapping.
	const buyer = $derived(result.input[sideToDirection.buyer].tuple);
	const seller = $derived(result.input[sideToDirection.seller].tuple);
	const yours = $derived({ lo: Number(buyer[0]), hi: Number(buyer[3]) });
	const theirs = $derived({ lo: Number(seller[0]), hi: Number(seller[3]) });
	const zone = $derived(
		result.zone === 'comfort'
			? { lo: result.overlapLow.float, hi: result.overlapHigh.float }
			: result.zone === 'deal'
				? { lo: result.dealLow.float, hi: result.dealHigh.float }
				: null
	);
	const axis = $derived(
		niceAxis(
			[...buyer.map(Number), ...seller.map(Number), result.fairPrice.float].filter(Number.isFinite)
		)
	);
	const fairText = $derived(formatMoney(result.fairPrice.decimal, currency));
	const fairExact = $derived(formatMoney(result.fairPrice.decimal, currency, true));

	const headline = $derived(
		result.zone === 'comfort'
			? 'You are comfortably in range.'
			: result.zone === 'deal'
				? 'There is a deal here. It is a stretch.'
				: 'Your ranges do not overlap.'
	);
	const explain = $derived(
		result.zone === 'comfort'
			? 'Both of you would be happy at this number. Nobody had to give much.'
			: result.zone === 'deal'
				? 'A fair number exists, but one of you, or both, is near a limit.'
				: 'No number sits inside both ranges. The fair price shown is the least-unfair middle, and the distances below show how far each of you is from it.'
	);
	const zoneLabel = $derived(
		result.zone === 'comfort' ? 'Comfort zone' : result.zone === 'deal' ? 'Deal zone' : ''
	);
</script>

<section class="outcome" data-state-screen="reveal" aria-labelledby="outcome-title">
	<div class="outcome__panel">
		<h2 id="outcome-title" class="outcome__title">{headline}</h2>
		<p class="outcome__explain">{explain}</p>

		<div class="outcome__canvas">
			<RevealCanvas
				{axis}
				{currency}
				{yours}
				{theirs}
				{zone}
				fair={result.fairPrice.float}
				fairLabel={fairText}
				yourLabel={labels.buyer}
				theirLabel={labels.seller}
				{zoneLabel}
				variant={rangesShown ? 'both' : 'zone'}
				animate
				compact
			/>
		</div>

		<dl class="outcome__facts">
			<div>
				<dt>Fair price</dt>
				<dd data-fair-price title={fairExact}>
					{fairText}{#if fairExact !== fairText}<small class="outcome__exact"
							>exactly {fairExact}</small
						>{/if}
				</dd>
			</div>
			{#if result.zone === 'no-deal'}
				<div>
					<dt>{labels.buyer} is</dt>
					<dd>{formatMoney(result.distances[sideToDirection.buyer].decimal, currency)} away</dd>
				</div>
				<div>
					<dt>{labels.seller} is</dt>
					<dd>{formatMoney(result.distances[sideToDirection.seller].decimal, currency)} away</dd>
				</div>
			{/if}
		</dl>
	</div>

	<div class="outcome__numbers">
		<div class="outcome__toggles">
			<button
				class="pill outcome__toggle"
				type="button"
				aria-pressed={rangesShown}
				onclick={() => (rangesShown = !rangesShown)}
				data-testid="show-ranges"
			>
				{rangesShown ? 'Hide the ranges' : 'Show the ranges'}
			</button>
			<button
				class="pill outcome__toggle"
				type="button"
				aria-expanded={numbersShown}
				aria-controls="the-numbers"
				onclick={() => (numbersShown = !numbersShown)}
			>
				{numbersShown ? 'Hide the numbers' : 'Show the numbers'}
			</button>
		</div>
		{#if numbersShown}
			<div id="the-numbers" class="outcome__meters" data-numbers-shown>
				<MeterPanel
					title={labels.buyer}
					rows={rowsFor(scenario.buyer)}
					values={[...buyer]}
					mode="display"
					accent="blue"
					{currency}
					min={scenario.min}
					max={scenario.max}
				/>
				<MeterPanel
					title={labels.seller}
					rows={rowsFor(scenario.seller)}
					values={[...seller]}
					mode="display"
					accent="terracotta"
					{currency}
					min={scenario.min}
					max={scenario.max}
				/>
			</div>
		{/if}
	</div>

	<ResultCard zone={result.zone} fair={fairText} {shareRef} />

	<div class="outcome__again">
		<button class="pill pill--navy" type="button" onclick={onrestart}>Start again</button>
		<span>Nothing you entered was stored.</span>
	</div>
</section>

<style>
	.outcome {
		display: grid;
		gap: 28px;
	}

	.outcome__panel {
		background: var(--navy);
		color: var(--on-navy);
		border-radius: 20px;
		padding: 36px 40px 30px;
		box-shadow: var(--lift-navy);
	}

	.outcome__title {
		color: var(--on-navy);
		font-size: 38px;
		line-height: 1.05;
		letter-spacing: -0.02em;
	}

	.outcome__explain {
		margin-top: 12px;
		font-size: 19px;
		color: var(--on-navy-soft);
		max-width: 62ch;
	}

	.outcome__canvas {
		position: relative;
		height: 270px;
		margin: 26px 0 8px;
	}

	.outcome__facts {
		display: flex;
		gap: 40px;
		margin: 26px 0 0;
		flex-wrap: wrap;
	}

	.outcome__facts dt {
		font-size: 13px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--on-navy-mute);
		font-family: var(--font-display);
		font-weight: 700;
	}

	.outcome__facts dd {
		margin: 4px 0 0;
		font-size: 22px;
		font-weight: 600;
	}

	.outcome__exact {
		display: block;
		margin-top: 2px;
		font-family: var(--font-body);
		font-size: 14px;
		font-weight: 500;
		color: var(--on-navy-mute);
	}

	.outcome__numbers {
		display: grid;
		gap: 18px;
		justify-items: start;
	}

	.outcome__toggles {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}

	.outcome__toggle {
		height: 48px;
		padding: 0 24px;
		font-size: 17px;
		color: var(--navy);
		box-shadow: var(--raise-sm);
		background: var(--ground);
	}

	.outcome__meters {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		width: 100%;
	}

	.outcome__again {
		display: flex;
		align-items: center;
		gap: 18px;
		color: var(--slate);
		font-size: 15px;
	}

	.outcome__again .pill {
		height: 48px;
		padding: 0 24px;
		font-size: 17px;
	}

	@media (max-width: 900px) {
		.outcome__meters {
			grid-template-columns: 1fr;
		}
		.outcome__panel {
			padding: 26px 22px 24px;
		}
		.outcome__title {
			font-size: 28px;
		}
		.outcome__canvas {
			height: 300px;
		}
	}
</style>
