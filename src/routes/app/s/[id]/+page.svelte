<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import LivePoll from '$lib/client/recruitment/LivePoll.svelte';
	import Stages from '$lib/client/recruitment/Stages.svelte';
	import StateBadge from '$lib/client/recruitment/StateBadge.svelte';
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
	} from '$lib/client/recruitment/format';
	import { recruitmentTemplate } from '$lib/templates/recruitment';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const STAGES = ['Client budget', 'Send the link', 'Candidate answers', 'The result'] as const;
	const stage = $derived(
		data.phase === 'enter'
			? 1
			: data.phase === 'waiting'
				? data.candidateStatus === 'not-opened'
					? 2
					: 3
				: 4
	);

	const questions = recruitmentTemplate.questions['low-preferring'];
	const rows = questions.map((q) => ({ key: q.key, label: q.prompt, help: q.help }));
	const symbol = $derived(symbolFor(data.currency));

	// Entry state: seeded from a recalled draft so a recall is editable.
	let values = $state<(string | null)[]>([null, null, null, null]);
	$effect(() => {
		if (data.phase === 'enter' && data.ownTuple) values = [...data.ownTuple];
	});
	let busy = $state(false);

	// Invite link copy control.
	let copied = $state(false);
	async function copyLink() {
		if (!data.inviteUrl) return;
		try {
			await navigator.clipboard.writeText(data.inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2400);
		} catch {
			const el = document.getElementById('invite-url') as HTMLInputElement | null;
			el?.select();
		}
	}

	// Result state.
	let showNumbers = $state(false);
	const result = $derived(data.result);
	const employerRange = $derived(result ? tupleRange(result.employer) : null);
	const candidateRange = $derived(result ? tupleRange(result.candidate) : null);
	const axis = $derived(
		result
			? niceAxis([
					...result.employer.map(Number),
					...result.candidate.map(Number),
					Number(result.fair)
				])
			: { min: 0, max: 100, step: 20 }
	);
	const candidateAxis = $derived(
		result ? niceAxis([...result.candidate.map(Number), Number(result.fair)]) : axis
	);
	// Before the toggle the picture is deliberately approximate (see quantiseRange).
	const drawnEmployer = $derived(
		employerRange ? (showNumbers ? employerRange : quantiseRange(employerRange, axis)) : null
	);
	const drawnCandidate = $derived(
		candidateRange ? (showNumbers ? candidateRange : quantiseRange(candidateRange, axis)) : null
	);
	const drawnZone = $derived(
		drawnEmployer && drawnCandidate ? rangeOverlap(drawnEmployer, drawnCandidate) : null
	);
	const candidateQuestions = recruitmentTemplate.questions['high-preferring'];
</script>

<svelte:head>
	<title>Salary check · {data.candidateEmail ?? data.id.slice(0, 8)}</title>
</svelte:head>

<LivePoll active={data.phase === 'waiting' || data.phase === 'locked'} />

<main class="shell">
	<header class="shell__head">
		<div>
			<a class="link-quiet" href={resolve('/app')}>All checks</a>
			<h1 class="shell__title check-title">
				{data.candidateEmail ?? 'Salary check'}
			</h1>
			<p class="shell__sub">
				<StateBadge state={data.state} />
				<span class="sub-meta">
					Started {formatDate(data.createdAt)} · {data.currency}
				</span>
			</p>
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
				Answer for the hiring company. The candidate never sees these figures; you see both sets
				once they have answered.
			</p>
			<MeterPanel
				title="Client budget"
				{rows}
				bind:values
				mode="entry"
				accent="blue"
				currency={symbol}
				min={0}
				max={250000}
				step={500}
				error={null}
			>
				{#snippet footer()}
					<ol class="helps" aria-label="About each figure">
						{#each questions as q (q.key)}
							<li>{q.help}</li>
						{/each}
					</ol>
					<div class="entry-actions">
						<button class="pill pill--gold btn" type="submit" disabled={busy}>
							{busy ? 'Submitting…' : 'Submit the budget'}
						</button>
						<span class="entry-note"
							>Figures lock once submitted; you can recall them until the candidate answers.</span
						>
					</div>
				{/snippet}
			</MeterPanel>
			{#each values as v, i (i)}
				<input type="hidden" name={`v${i + 1}`} value={v ?? ''} />
			{/each}
		</form>

		<section class="panel panel--cancel">
			<form method="POST" action="?/cancel" use:enhance>
				<button class="btn btn--sm btn--danger pill" type="submit">Cancel this check</button>
				<span class="cancel-note">The credit is not returned.</span>
			</form>
		</section>
	{:else if data.phase === 'waiting'}
		<section class="panel" aria-labelledby="link-title">
			<h2 id="link-title" class="panel__title">Send the candidate their link</h2>
			{#if data.inviteUrl}
				<p class="panel__lede">
					We haven't emailed it. Copy the link and send it to
					<strong>{data.candidateEmail}</strong> yourself. It works once, for that address only, for 14
					days.
				</p>
				<div class="linkbox">
					<input
						id="invite-url"
						class="linkbox__url inset"
						type="text"
						readonly
						value={data.inviteUrl}
						data-testid="invite-url"
						aria-label="Invite link"
					/>
					<button class="pill pill--navy btn btn--sm" type="button" onclick={copyLink}>
						{copied ? 'Copied' : 'Copy link'}
					</button>
				</div>
				<p class="linkbox__note">
					This is the only time the link is shown. If you lose it, start a new check.
				</p>
			{:else if data.candidateStatus === 'not-opened'}
				<p class="panel__lede">
					The link for <strong>{data.candidateEmail}</strong> is no longer available here: it is shown
					once, when the check is created. If it was not sent, cancel this check and start a new one.
				</p>
				<a class="pill pill--navy btn btn--sm newcheck" href={resolve('/app/new')}
					>Start a new check</a
				>
			{:else}
				<p class="panel__lede">The candidate has opened their link.</p>
			{/if}
		</section>

		<section class="panel" aria-labelledby="wait-title">
			<h2 id="wait-title" class="panel__title">Waiting on the candidate</h2>
			<dl class="status">
				<div class="status__row">
					<dt>Your budget</dt>
					<dd data-testid="own-status">Submitted</dd>
				</div>
				<div class="status__row">
					<dt>Link opened</dt>
					<dd data-testid="candidate-opened">
						{data.candidateStatus === 'not-opened' ? 'Not yet' : 'Yes'}
					</dd>
				</div>
				<div class="status__row">
					<dt>Candidate's figures</dt>
					<dd data-testid="candidate-submitted">
						{data.candidateStatus === 'submitted' ? 'Submitted' : 'Not yet'}
					</dd>
				</div>
			</dl>
			<p class="panel__lede">This page updates itself when the candidate submits.</p>
			<div class="wait-actions">
				{#if data.candidateStatus !== 'submitted'}
					<form method="POST" action="?/recall" use:enhance>
						<button class="pill btn btn--sm btn--quiet" type="submit"
							>Recall and edit the budget</button
						>
					</form>
					<form method="POST" action="?/cancel" use:enhance>
						<button class="pill btn btn--sm btn--danger" type="submit">Cancel this check</button>
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
				No result was produced and the candidate's link no longer works. Start a new check to try
				again with {data.candidateEmail ?? 'the candidate'}.
			</p>
			<a class="pill pill--navy btn btn--sm newcheck" href={resolve('/app/new')}
				>Start a new check</a
			>
		</section>
	{:else if data.phase === 'closed' && result && drawnEmployer && drawnCandidate && candidateRange}
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
					yours={drawnEmployer}
					theirs={drawnCandidate}
					zone={drawnZone}
					fair={Number(result.fair)}
					fairLabel={formatFair(result.fair, data.currency)}
					yourLabel="Client budget"
					theirLabel="Candidate"
					zoneLabel="Where they meet"
					variant="both"
					animate
				/>
			</div>
			{#if !showNumbers}
				<p class="sr-only">
					The client's budget and the candidate's expectations are drawn as two ranges on the salary
					scale with the fair salary marked. Use "Show the numbers" to read the figures.
				</p>
			{/if}
		</section>

		<section class="panel" aria-labelledby="guidance-title">
			<h2 id="guidance-title" class="panel__title">What this means</h2>
			<p class="guidance">{result.guidance.hostCopy}</p>

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
						<span class="caps numbers__title numbers__title--blue">Client budget</span>
						{#each questions as q, i (q.key)}
							<div class="numbers__row">
								<dt>{q.prompt}</dt>
								<dd data-testid="employer-figure">
									{formatMoney(result.employer[i], data.currency)}
								</dd>
							</div>
						{/each}
					</dl>
					<dl class="numbers__side">
						<span class="caps numbers__title numbers__title--terracotta">Candidate</span>
						{#each candidateQuestions as q, i (q.key)}
							<div class="numbers__row">
								<dt>{q.prompt}</dt>
								<dd data-testid="candidate-figure">
									{formatMoney(result.candidate[i], data.currency)}
								</dd>
							</div>
						{/each}
					</dl>
					<p class="numbers__exact">
						Fair salary, unrounded: <span data-testid="fair-exact">{symbol}{result.fair}</span>
					</p>
				</div>
			{/if}
		</section>

		<section class="panel candidate-view" aria-labelledby="cv-title">
			<h2 id="cv-title" class="panel__title">What the candidate sees</h2>
			<p class="panel__lede">
				Their own range, the fair salary and the overlap level. The client's budget is never sent to
				their page.
			</p>
			<div class="cv-frame panel--navy" data-testid="candidate-view">
				<p class="cv-frame__fair">{formatFair(result.fair, data.currency)}</p>
				<p class="cv-frame__overlap caps">{OVERLAP_LABEL[result.guidance.overlap]}</p>
				<div class="cv-frame__reveal" aria-hidden="true">
					<RevealCanvas
						axis={candidateAxis}
						currency={symbol}
						yours={quantiseRange(candidateRange, candidateAxis)}
						fair={Number(result.fair)}
						fairLabel={formatFair(result.fair, data.currency)}
						yourLabel="Your range"
						variant="blind"
						animate={false}
						compact
					/>
				</div>
				<p class="cv-frame__copy">{result.guidance.partyCopy}</p>
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

	.panel--cancel {
		margin-top: 22px;
		box-shadow: none;
		padding: 0 6px;
		display: flex;
	}

	.panel--cancel form {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.cancel-note {
		color: var(--slate);
		font-size: 14px;
	}

	.linkbox {
		margin-top: 18px;
		display: grid;
		gap: 12px;
	}

	.linkbox__url {
		height: 48px;
		border: 0;
		border-radius: var(--radius-md);
		padding: 0 16px;
		font-size: 15px;
		color: var(--ink);
		width: 100%;
		text-overflow: ellipsis;
	}

	.linkbox__note {
		margin-top: 12px;
		color: var(--slate);
		font-size: 14px;
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

	.numbers__exact {
		grid-column: 1 / -1;
		color: var(--slate);
		font-size: 14px;
	}

	.cv-frame {
		margin-top: 18px;
		border-radius: var(--radius-md);
		padding: 20px 18px 18px;
	}

	.cv-frame__fair {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 30px;
		letter-spacing: -0.03em;
		color: var(--gold-2);
		line-height: 1;
	}

	.cv-frame__overlap {
		margin-top: 8px;
		font-size: 12px;
		letter-spacing: 0.18em;
		color: var(--on-navy);
	}

	.cv-frame__reveal {
		position: relative;
		height: 230px;
		margin-top: 12px;
	}

	.cv-frame__copy {
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
		.linkbox {
			grid-template-columns: 1fr auto;
			align-items: center;
		}
		.result__fair {
			font-size: 64px;
		}
		.result__reveal {
			height: 320px;
		}
		.cv-frame {
			padding: 24px 28px 22px;
		}
	}
</style>
