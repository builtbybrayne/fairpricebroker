<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { enhance } from '$app/forms';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import LivePoll from '$lib/client/recruitment/LivePoll.svelte';
	import {
		formatFair,
		formatMoney,
		niceAxis,
		OVERLAP_LABEL,
		symbolFor,
		tupleRange
	} from '$lib/client/recruitment/format';
	import { recruitmentTemplate } from '$lib/templates/recruitment';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const questions = $derived(recruitmentTemplate.questions[data.role]);
	const rows = $derived(questions.map((q) => ({ key: q.key, label: q.prompt, help: q.help })));
	const symbol = $derived(symbolFor(data.currency));

	let values = $state<(string | null)[]>([null, null, null, null]);
	$effect(() => {
		if (data.phase === 'enter' && data.ownTuple) values = [...data.ownTuple];
	});
	let busy = $state(false);
	let showNumbers = $state(false);

	const result = $derived(data.result);
	const ownRange = $derived(result ? tupleRange(result.own) : null);
	const axis = $derived(
		result
			? niceAxis([...result.own.map(Number), Number(result.fair)])
			: { min: 0, max: 100, step: 20 }
	);
</script>

<svelte:head>
	<title>Your salary expectations</title>
</svelte:head>

<LivePoll active={data.phase === 'sealed' || data.phase === 'locked'} />

<main class="shell shell--narrow party">
	{#if data.phase === 'enter'}
		<header class="shell__head">
			<div>
				<h1 class="shell__title">Your salary expectations</h1>
				<p class="shell__sub">Four figures. Nothing else is asked of you.</p>
			</div>
		</header>

		{#if data.showDisclosure}
			<section class="panel disclosure" aria-labelledby="disclosure-title" data-testid="disclosure">
				<h2 id="disclosure-title" class="panel__title">{recruitmentTemplate.disclosure.heading}</h2>
				<p class="disclosure__body">{recruitmentTemplate.disclosure.body}</p>
				<h2 class="panel__title disclosure__incentive-title">
					{recruitmentTemplate.incentive.heading}
				</h2>
				<p class="disclosure__body" data-testid="incentive">{recruitmentTemplate.incentive.body}</p>
			</section>
		{/if}

		{#if form?.error}
			<p class="form-error" role="alert">{form.error}</p>
		{/if}

		<form
			method="POST"
			action="?/submit"
			class="meter-wrap"
			data-testid="entry-form"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update({ reset: false });
				};
			}}
		>
			<MeterPanel
				title="Your meter"
				{rows}
				bind:values
				mode="entry"
				accent="terracotta"
				currency={symbol}
				min={0}
				max={250000}
				step={500}
			>
				{#snippet footer()}
					<ol class="helps" aria-label="About each figure">
						{#each questions as q (q.key)}
							<li>{q.help}</li>
						{/each}
					</ol>
					<div class="entry-actions">
						<button class="pill pill--gold btn" type="submit" disabled={busy}>
							{busy ? 'Submitting…' : 'Submit my figures'}
						</button>
						<span class="entry-note">You can recall them until the other side has answered.</span>
					</div>
				{/snippet}
			</MeterPanel>
			{#each values as v, i (i)}
				<input type="hidden" name={`v${i + 1}`} value={v ?? ''} />
			{/each}
		</form>
	{:else if data.phase === 'sealed'}
		<header class="shell__head">
			<div>
				<h1 class="shell__title">Your figures are in</h1>
				<p class="shell__sub">Sealed until both sides have answered.</p>
			</div>
		</header>
		{#if data.ownTuple}
			<MeterPanel
				title="Your meter"
				{rows}
				values={[...data.ownTuple]}
				mode="sealed"
				accent="terracotta"
				currency={symbol}
				min={0}
				max={250000}
			/>
		{/if}
		<section class="panel next" aria-labelledby="next-title">
			<h2 id="next-title" class="panel__title">What happens next</h2>
			<p class="panel__lede">
				When the recruiter's budget is also in, the fair salary is worked out on the server. You
				will see your own range, the fair figure and whether the two ranges meet. This page updates
				itself.
			</p>
			{#if form?.error}
				<p class="form-error" role="alert">{form.error}</p>
			{/if}
			<form method="POST" action="?/recall" use:enhance class="next__actions">
				<button class="pill btn btn--sm btn--quiet" type="submit" data-testid="recall"
					>Recall and change my figures</button
				>
			</form>
		</section>
	{:else if data.phase === 'locked'}
		<section class="panel panel--navy" aria-live="polite">
			<h2 class="panel__title">Both sides are in</h2>
			<p class="panel__lede">Working out the fair salary. This takes a moment.</p>
		</section>
	{:else if data.phase === 'cancelled'}
		<section class="panel" aria-labelledby="cancel-title">
			<h2 id="cancel-title" class="panel__title">This check was cancelled</h2>
			<p class="panel__lede">
				The recruiter withdrew it before a result was produced. Nothing you entered has been shared.
			</p>
		</section>
	{:else if data.phase === 'closed' && result && ownRange}
		<section class="result panel panel--navy" aria-labelledby="result-title">
			<div class="result__head">
				<h1 id="result-title" class="panel__title">Fair salary</h1>
				<p class="result__fair" data-testid="fair-salary">
					{formatFair(result.fair, data.currency)}
				</p>
				<p class="result__overlap caps" data-testid="overlap-label">
					{OVERLAP_LABEL[result.guidance.overlap]}
				</p>
			</div>
			<div class="result__reveal" aria-hidden={!showNumbers}>
				<RevealCanvas
					{axis}
					currency={symbol}
					yours={ownRange}
					fair={Number(result.fair)}
					fairLabel={formatFair(result.fair, data.currency)}
					yourLabel="Your range"
					variant="blind"
					yourAccent="terracotta"
					animate
				/>
			</div>
			{#if !showNumbers}
				<p class="sr-only">
					Your range is drawn on the salary scale with the fair salary marked. Use "Show my numbers"
					to read your figures.
				</p>
			{/if}
		</section>

		<section class="panel" aria-labelledby="guidance-title">
			<h2 id="guidance-title" class="panel__title">What this means for you</h2>
			<p class="guidance" data-testid="party-copy">{result.guidance.partyCopy}</p>
			<div class="toggle-row">
				<button
					class="pill btn btn--sm btn--quiet"
					type="button"
					aria-expanded={showNumbers}
					aria-controls="numbers"
					onclick={() => (showNumbers = !showNumbers)}
					data-testid="show-numbers"
				>
					{showNumbers ? 'Hide my numbers' : 'Show my numbers'}
				</button>
			</div>
			{#if showNumbers}
				<dl id="numbers" class="numbers__side own-numbers" data-testid="numbers">
					<span class="caps numbers__title numbers__title--terracotta">Your figures</span>
					{#each questions as q, i (q.key)}
						<div class="numbers__row">
							<dt>{q.prompt}</dt>
							<dd data-testid="own-figure">{formatMoney(result.own[i], data.currency)}</dd>
						</div>
					{/each}
				</dl>
			{/if}
		</section>
	{/if}
</main>

<style>
	.disclosure {
		margin-bottom: 22px;
	}

	.disclosure__body {
		margin-top: 10px;
		font-size: 16px;
		line-height: 1.55;
		max-width: 62ch;
	}

	.disclosure__incentive-title {
		margin-top: 22px;
	}

	.helps {
		margin: 0;
		padding-left: 20px;
		display: grid;
		gap: 6px;
		color: var(--slate);
		font-size: 14px;
	}

	.entry-actions {
		margin-top: 20px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 18px;
	}

	.entry-note {
		color: var(--slate);
		font-size: 14px;
		max-width: 38ch;
	}

	.next {
		margin-top: 22px;
	}

	.next__actions {
		margin-top: 18px;
	}

	.result__head {
		display: grid;
		gap: 6px;
	}

	.result__fair {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 44px;
		letter-spacing: -0.035em;
		line-height: 1;
		color: var(--gold-2);
	}

	.result__overlap {
		margin-top: 8px;
		font-size: 13px;
		letter-spacing: 0.18em;
		color: var(--on-navy);
	}

	.result__reveal {
		position: relative;
		height: 250px;
		margin-top: 18px;
	}

	.guidance {
		margin-top: 12px;
		font-size: 17px;
		line-height: 1.55;
		max-width: 62ch;
	}

	.toggle-row {
		margin-top: 22px;
	}

	.own-numbers {
		margin-top: 18px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (min-width: 720px) {
		.result__fair {
			font-size: 60px;
		}
	}
</style>
