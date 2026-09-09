<script lang="ts">
	import '$lib/client/offers/offers.css';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import LivePoll from '$lib/client/offers/LivePoll.svelte';
	import Stages from '$lib/client/offers/Stages.svelte';
	import StateBadge from '$lib/client/offers/StateBadge.svelte';
	import {
		formatDate,
		formatFair,
		formatMoney,
		niceAxis,
		OVERLAP_LABEL,
		quantiseRange,
		rangeOverlap,
		symbolFor,
		tupleRange
	} from '$lib/client/offers/format';
	import { otherSide } from '$lib/domain/terms';
	import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const t = $derived(data.terms);

	const offerer = salaryNegotiationTemplate.offeredBy;
	const respondent = otherSide(offerer);
	const offererTitle = salaryNegotiationTemplate.roles[offerer].label;
	const respondentTitle = salaryNegotiationTemplate.roles[respondent].label;
	const respondentName = $derived(t[respondent]);

	const STAGES = $derived([
		offererTitle,
		'Send the link',
		`${respondentName} answers`,
		'The result'
	]);
	const stage = $derived(
		data.phase === 'enter'
			? 1
			: data.phase === 'waiting'
				? data.respondentProgress === 'not-opened'
					? 2
					: 3
				: 4
	);

	const questions = salaryNegotiationTemplate.questions[offerer];
	const respondentQuestions = salaryNegotiationTemplate.questions[respondent];
	const rows = questions.map((q) => ({ key: q.key, label: q.label, help: q.prompt }));
	const symbol = $derived(symbolFor(data.currency));

	// Entry state: seeded from a recalled draft so a recall is editable.
	let values = $state<(string | null)[]>([null, null, null, null]);
	$effect(() => {
		if (data.phase === 'enter' && data.ownTuple) values = [...data.ownTuple];
	});
	let busy = $state(false);

	let copied = $state(false);
	function shortLink(url: string): string {
		const tail = url.split('/').pop() ?? '';
		return `${url.slice(0, url.length - tail.length)}${tail.slice(0, 4)}…${tail.slice(-4)}`;
	}
	async function copyLink() {
		if (!data.offer?.link) return;
		try {
			await navigator.clipboard.writeText(data.offer.link);
			copied = true;
			setTimeout(() => (copied = false), 2200);
		} catch {
			copied = false;
		}
	}

	// Result state.
	let showNumbers = $state(false);
	const result = $derived(data.result);
	const ownRange = $derived(result ? tupleRange(result.figures[offerer]) : null);
	const theirRange = $derived(result ? tupleRange(result.figures[respondent]) : null);
	const axis = $derived(
		result
			? niceAxis([
					...result.figures[offerer].map(Number),
					...result.figures[respondent].map(Number),
					Number(result.fair)
				])
			: { min: 0, max: 100, step: 20 }
	);
	const theirAxis = $derived(
		result ? niceAxis([...result.figures[respondent].map(Number), Number(result.fair)]) : axis
	);
	// Before the toggle the picture is deliberately approximate (see quantiseRange).
	const drawnOwn = $derived(
		ownRange ? (showNumbers ? ownRange : quantiseRange(ownRange, axis)) : null
	);
	const drawnTheirs = $derived(
		theirRange ? (showNumbers ? theirRange : quantiseRange(theirRange, axis)) : null
	);
	const drawnZone = $derived(drawnOwn && drawnTheirs ? rangeOverlap(drawnOwn, drawnTheirs) : null);
</script>

<svelte:head>
	<title>Salary check · {data.respondentEmail ?? data.id.slice(0, 8)}</title>
</svelte:head>

<LivePoll active={data.phase === 'waiting' || data.phase === 'locked'} />

<main class="shell">
	<header class="shell__head">
		<div>
			{#if data.offer}
				<a class="link-quiet" href={resolve('/app/o/[id]', { id: data.offer.id })}
					>{data.offer.title}</a
				>
			{:else}
				<a class="link-quiet" href={resolve('/app/offers')}>All {t.offers.toLowerCase()}</a>
			{/if}
			<h1 class="shell__title check-title">
				{data.respondentEmail ?? 'Salary check'}
			</h1>
			<p class="shell__sub">
				<StateBadge state={data.state} />
				<span class="sub-meta">
					Started {formatDate(data.createdAt)} · {data.currency}
				</span>
			</p>
			{#if data.offer?.link}
				<p class="shell__sub linkline">
					<span class="sub-meta">Link</span>
					<code class="linkline__short" title={data.offer.link}>{shortLink(data.offer.link)}</code>
					{#if data.offer.copyable}
						<button class="pill btn btn--sm btn--quiet" type="button" onclick={copyLink}
							>{copied ? 'Copied' : 'Copy'}</button
						>
					{:else}
						<span class="sub-meta">used</span>
					{/if}
				</p>
			{/if}
		</div>
	</header>

	{#if data.phase !== 'cancelled'}
		<Stages current={stage} labels={STAGES} />
	{/if}

	{#if form?.error}
		<p class="form-error form-error--top" role="alert">{form.error}</p>
	{/if}

	{#if data.phase === 'enter'}
		<form
			method="POST"
			action="?/submit"
			class="meter-wrap"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update({ reset: false });
				};
			}}
		>
			<p class="entry-intro">
				Answer for the {t.buyer.toLowerCase()}. The {respondentName.toLowerCase()} never sees these figures;
				you see both sets once they have answered.
			</p>
			<MeterPanel
				title={offererTitle}
				{rows}
				bind:values
				mode="entry"
				accent="blue"
				currency={symbol}
				min={0}
				max={250000}
				step={500}
				example={[40000, 48000, 58000, 65000]}
				error={null}
			>
				{#snippet footer()}
					<ol class="helps" aria-label="About each figure">
						{#each questions as q (q.key)}
							<li><strong>{q.label}.</strong> {q.prompt} <span>{q.help}</span></li>
						{/each}
					</ol>
					<div class="entry-actions">
						<button class="pill pill--gold btn" type="submit" disabled={busy}>
							{busy ? 'Submitting…' : 'Submit the budget'}
						</button>
						<span class="entry-note"
							>You can change the budget until the {respondentName.toLowerCase()} answers.</span
						>
					</div>
				{/snippet}
			</MeterPanel>
			{#each values as v, i (i)}
				<input type="hidden" name={`v${i + 1}`} value={v ?? ''} />
			{/each}
		</form>
	{:else if data.phase === 'waiting'}
		<section class="panel" aria-labelledby="link-title">
			<h2 id="link-title" class="panel__title">
				Send the {respondentName.toLowerCase()} their link
			</h2>
			{#if data.offer?.link && data.offer.copyable}
				<p class="panel__lede">
					We haven't emailed it. Copy the link above and send it yourself. It works once, for 14
					days, and tells you who used it when they open it.
				</p>
			{:else if data.respondentProgress === 'not-opened'}
				<p class="panel__lede">
					The link is no longer available here. If it was not sent, generate a new link on the
					{t.offer.toLowerCase()} page.
				</p>
				{#if data.offer}
					<a
						class="pill pill--navy btn btn--sm newcheck"
						href={resolve('/app/o/[id]', { id: data.offer.id })}
						>Back to the {t.offer.toLowerCase()}</a
					>
				{:else}
					<a class="pill pill--navy btn btn--sm newcheck" href={resolve('/app/offers/new')}
						>Start a new {t.offer.toLowerCase()}</a
					>
				{/if}
			{:else}
				<p class="panel__lede">The {respondentName.toLowerCase()} has opened their link.</p>
			{/if}
		</section>

		<section class="panel" aria-labelledby="wait-title">
			<h2 id="wait-title" class="panel__title">Waiting on the {respondentName.toLowerCase()}</h2>
			<dl class="status">
				<div class="status__row">
					<dt>Your budget</dt>
					<dd data-testid="own-status">Submitted</dd>
				</div>
				<div class="status__row">
					<dt>Link opened</dt>
					<dd data-testid="respondent-opened">
						{data.respondentProgress === 'not-opened' ? 'Not yet' : 'Yes'}
					</dd>
				</div>
				<div class="status__row">
					<dt>{respondentName}'s figures</dt>
					<dd data-testid="respondent-submitted">
						{data.respondentProgress === 'submitted' ? 'Submitted' : 'Not yet'}
					</dd>
				</div>
			</dl>
			<p class="panel__lede">
				This page updates itself when the {respondentName.toLowerCase()} submits.
			</p>
			<div class="wait-actions">
				{#if data.respondentProgress !== 'submitted' && !data.offer}
					<form method="POST" action="?/recall" use:enhance>
						<button class="pill btn btn--sm btn--quiet" type="submit"
							>Recall and edit the budget</button
						>
					</form>
				{/if}
			</div>
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
				No result was produced and the {respondentName.toLowerCase()}'s link no longer works.
				Generate a new link to try again with {data.respondentEmail ??
					`the ${respondentName.toLowerCase()}`}.
			</p>
			{#if data.offer}
				<a
					class="pill pill--navy btn btn--sm newcheck"
					href={resolve('/app/o/[id]', { id: data.offer.id })}
					>Back to the {t.offer.toLowerCase()}</a
				>
			{/if}
		</section>
	{:else if data.phase === 'closed' && result && drawnOwn && drawnTheirs && theirRange}
		<section class="result panel panel--navy" aria-labelledby="result-title">
			<div class="result__head">
				<h2 id="result-title" class="panel__title">Fair salary</h2>
				<p class="result__fair" data-testid="fair-salary">
					{formatFair(result.fair, data.currency)}
				</p>
				<p class="result__overlap">
					<span class="caps result__overlap-label" data-testid="overlap-label"
						>{OVERLAP_LABEL[result.guidance.overlap]}</span
					>
					<span class="result__nonrem">
						{result.guidance.nonRemunerationInPlay
							? 'Non-salary factors need to be in play'
							: 'Closable on salary alone'}
					</span>
				</p>
			</div>
			<div class="result__reveal" aria-hidden={!showNumbers}>
				<RevealCanvas
					{axis}
					currency={symbol}
					yours={drawnOwn}
					theirs={drawnTheirs}
					yoursInner={showNumbers
						? {
								lo: Number(result.figures[offerer][1]),
								hi: Number(result.figures[offerer][2])
							}
						: null}
					theirsInner={showNumbers
						? {
								lo: Number(result.figures[respondent][1]),
								hi: Number(result.figures[respondent][2])
							}
						: null}
					zone={drawnZone}
					fair={Number(result.fair)}
					fairLabel={formatFair(result.fair, data.currency)}
					yourLabel={offererTitle}
					theirLabel={respondentTitle}
					zoneLabel="Overlap"
					variant={showNumbers ? 'both' : 'outcome'}
					animate
				/>
			</div>
			{#if !showNumbers}
				<p class="sr-only">
					The {t.buyer.toLowerCase()}'s budget is drawn on the salary scale with the overlap and the
					fair salary marked. The {respondentName.toLowerCase()}'s range is drawn only after "Show
					the numbers".
				</p>
			{/if}
		</section>

		<section class="panel" aria-labelledby="guidance-title">
			<h2 id="guidance-title" class="panel__title">What this means</h2>
			<p class="guidance">{result.guidance.brokerCopy}</p>

			<div class="toggle-row">
				<button
					class="pill btn btn--sm btn--quiet"
					type="button"
					aria-expanded={showNumbers}
					aria-controls="numbers"
					onclick={() => (showNumbers = !showNumbers)}
					data-testid="show-numbers"
				>
					{showNumbers ? 'Hide the numbers' : 'Show the numbers'}
				</button>
				<span class="toggle-note">Both sets of figures, exactly as entered.</span>
			</div>

			{#if showNumbers}
				<div id="numbers" class="numbers" data-testid="numbers">
					<dl class="numbers__side">
						<span class="caps numbers__title numbers__title--blue">{offererTitle}</span>
						{#each questions as q, i (q.key)}
							<div class="numbers__row">
								<dt>{q.prompt}</dt>
								<dd data-testid="offerer-figure">
									{formatMoney(result.figures[offerer][i], data.currency)}
								</dd>
							</div>
						{/each}
					</dl>
					<dl class="numbers__side">
						<span class="caps numbers__title numbers__title--terracotta">{respondentTitle}</span>
						{#each respondentQuestions as q, i (q.key)}
							<div class="numbers__row">
								<dt>{q.prompt}</dt>
								<dd data-testid="respondent-figure">
									{formatMoney(result.figures[respondent][i], data.currency)}
								</dd>
							</div>
						{/each}
					</dl>
					<span class="sr-only" data-testid="fair-exact">{symbol}{result.fair}</span>
				</div>
			{/if}
		</section>

		<section class="panel respondent-view" aria-labelledby="rv-title">
			<h2 id="rv-title" class="panel__title">What the {respondentName.toLowerCase()} sees</h2>
			<p class="panel__lede">
				Their own range, the fair salary and the overlap level. They never see the
				{t.buyer.toLowerCase()}'s budget.
			</p>
			<div class="rv-frame panel--navy" data-testid="respondent-view">
				<p class="rv-frame__fair">{formatFair(result.fair, data.currency)}</p>
				<p class="rv-frame__overlap caps">{OVERLAP_LABEL[result.guidance.overlap]}</p>
				<div class="rv-frame__reveal" aria-hidden="true">
					<RevealCanvas
						axis={theirAxis}
						currency={symbol}
						yours={quantiseRange(theirRange, theirAxis)}
						fair={Number(result.fair)}
						fairLabel={formatFair(result.fair, data.currency)}
						yourLabel="Your range"
						variant="blind"
						yourAccent="terracotta"
						animate={false}
						compact
					/>
				</div>
				<p class="rv-frame__copy">{result.guidance.sideCopy}</p>
			</div>
		</section>
	{/if}
</main>

<style>
	.check-title {
		margin-top: 6px;
		overflow-wrap: anywhere;
	}

	.sub-meta {
		margin-left: 10px;
		color: var(--slate);
		font-size: 15px;
	}

	.form-error--top {
		margin: 0 0 16px;
	}

	.entry-intro {
		margin: 0 0 14px;
		color: var(--slate);
		font-size: 16px;
		max-width: 62ch;
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

	.newcheck {
		margin-top: 18px;
	}

	.status {
		margin: 18px 0 14px;
		display: grid;
		gap: 0;
	}

	.status__row {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 0;
		border-bottom: 1px solid var(--hairline);
		font-size: 16px;
	}

	.status__row dt {
		color: var(--slate);
	}

	.status__row dd {
		margin: 0;
		font-weight: 600;
	}

	.wait-actions {
		margin-top: 20px;
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	/* result -------------------------------------------------------------- */
	.result {
		padding-bottom: 18px;
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
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px 14px;
		margin-top: 8px;
	}

	.result__overlap-label {
		font-size: 13px;
		letter-spacing: 0.18em;
		color: var(--on-navy);
	}

	.result__nonrem {
		color: var(--on-navy-soft);
		font-size: 15px;
	}

	.result__reveal {
		position: relative;
		height: 280px;
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
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
	}

	.toggle-note {
		color: var(--slate);
		font-size: 14px;
	}

	.rv-frame {
		margin-top: 18px;
		border-radius: var(--radius-md);
		padding: 20px 18px 18px;
	}

	.rv-frame__fair {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 30px;
		letter-spacing: -0.03em;
		color: var(--gold-2);
		line-height: 1;
	}

	.rv-frame__overlap {
		margin-top: 8px;
		font-size: 12px;
		letter-spacing: 0.18em;
		color: var(--on-navy);
	}

	.rv-frame__reveal {
		position: relative;
		height: 230px;
		margin-top: 12px;
	}

	.rv-frame__copy {
		margin-top: 16px;
		color: var(--on-navy-soft);
		font-size: 15px;
		line-height: 1.5;
		max-width: 60ch;
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
			font-size: 64px;
		}
		.result__reveal {
			height: 320px;
		}
		.rv-frame {
			padding: 24px 28px 22px;
		}
	}

	.linkline {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
	}

	.linkline__short {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--navy);
		background: var(--ground);
		box-shadow: var(--inset-sm);
		padding: 4px 8px;
		border-radius: 6px;
	}
</style>
