<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import LivePoll from '$lib/client/recruitment/LivePoll.svelte';
	import StateBadge from '$lib/client/recruitment/StateBadge.svelte';
	import {
		formatDate,
		formatFair,
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

	const questions = recruitmentTemplate.questions['low-preferring'];
	const rows = questions.map((q) => ({ key: q.key, label: q.label, help: q.prompt }));
	const symbol = $derived(symbolFor(data.role.currency));

	let editing = $state(false);
	let values = $state<(string | null)[]>([null, null, null, null]);
	$effect(() => {
		if (data.role.budget) values = [...data.role.budget];
	});
	let busy = $state(false);
	let copied = $state<string | null>(null);
	let count = $state(1);
	let openOverlap = $state<string | null>(null);

	const anyAnswered = $derived(
		data.candidates.some((c) => c.progress === 'answered' || c.progress === 'result')
	);
	const waiting = $derived(data.candidates.some((c) => c.state === 'open' || c.state === 'locked'));

	async function copy(sessionId: string, url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = sessionId;
			setTimeout(() => (copied = null), 2200);
		} catch {
			copied = null;
		}
	}

	/** A link shown short: the start and the end, an ellipsis between. */
	function shorten(url: string): string {
		const tail = url.split('/').pop() ?? '';
		return `${url.slice(0, url.length - tail.length)}${tail.slice(0, 4)}…${tail.slice(-4)}`;
	}

	const PROGRESS: Record<string, string> = {
		'not-opened': 'Not opened yet',
		opened: 'Opened',
		answered: 'Answered',
		result: 'Result ready',
		cancelled: 'Cancelled'
	};

	/** The overlap picture for a finished check: the client's range and the zone. */
	function picture(c: (typeof data.candidates)[number]) {
		if (!c.employer || !c.candidate || !c.fair) return null;
		const employer = tupleRange(c.employer);
		const candidate = tupleRange(c.candidate);
		const axis = niceAxis([employer.lo, employer.hi, candidate.lo, candidate.hi, Number(c.fair)]);
		return {
			axis,
			yours: quantiseRange(employer, axis),
			zone: rangeOverlap(employer, candidate),
			fair: Number(c.fair)
		};
	}
</script>

<svelte:head>
	<title>{data.role.title} — roles</title>
</svelte:head>

<LivePoll active={waiting} />

<main class="shell">
	<header class="shell__head">
		<div>
			<a class="link-quiet" href={resolve('/app/roles')}>All roles</a>
			<h1 class="shell__title" data-testid="role-title">{data.role.title}</h1>
			<p class="shell__sub">
				<span class="sub-meta"
					>Started {formatDate(data.role.createdAt)} · {data.role.currency}</span
				>
			</p>
		</div>
	</header>

	<!-- the budget --------------------------------------------------------- -->
	{#if editing || !data.role.budget}
		<form
			method="POST"
			action="?/budget"
			class="meter-wrap"
			use:enhance={() => {
				busy = true;
				return async ({ update, result }) => {
					busy = false;
					if (result.type === 'success') editing = false;
					await update({ reset: false });
				};
			}}
		>
			<p class="entry-intro">
				Answer for the hiring company. Candidates never see these figures; you see both sets once a
				candidate has answered.
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
				example={[40000, 48000, 58000, 65000]}
				error={form?.budgetError ?? null}
			>
				{#snippet footer()}
					<div class="entry-actions">
						<button class="pill pill--gold btn" type="submit" disabled={busy}>
							{busy ? 'Saving…' : 'Save the budget'}
						</button>
						{#if data.role.budget}
							<button class="pill btn btn--quiet" type="button" onclick={() => (editing = false)}
								>Keep the current budget</button
							>
						{/if}
						<span class="entry-note">Applies to every candidate who has not answered yet.</span>
					</div>
				{/snippet}
			</MeterPanel>
			{#each values as v, i (i)}
				<input type="hidden" name={`v${i + 1}`} value={v ?? ''} />
			{/each}
		</form>
	{:else}
		<section class="meter-wrap" aria-label="Client budget">
			<MeterPanel
				title="Client budget"
				{rows}
				values={[...data.role.budget]}
				mode="display"
				accent="blue"
				currency={symbol}
				min={0}
				max={250000}
			>
				{#snippet footer()}
					<div class="entry-actions">
						<button
							class="pill btn btn--sm btn--quiet"
							type="button"
							onclick={() => (editing = true)}
							data-testid="edit-budget">Edit the budget</button
						>
						<span class="entry-note">
							{anyAnswered
								? 'Candidates who have already answered keep the budget they answered against.'
								: 'You can change the budget until a candidate answers.'}
						</span>
					</div>
				{/snippet}
			</MeterPanel>
		</section>
	{/if}

	<!-- the candidates ---------------------------------------------------- -->
	<section class="panel" aria-labelledby="cands-title">
		<h2 id="cands-title" class="panel__title">Candidates</h2>
		{#if data.candidates.length === 0}
			<p class="panel__lede">
				No links yet. Generate a private link for each candidate and send it yourself; each link
				works once, costs one credit, and tells you who used it when they open it.
			</p>
		{:else}
			<p class="panel__lede">
				One private link per candidate, sent by you. Each works once; the candidate's email appears
				when they open it.
			</p>
			<div class="table-wrap">
				<table class="cands">
					<thead>
						<tr>
							<th scope="col">Link</th>
							<th scope="col">Candidate</th>
							<th scope="col">Fair salary</th>
							<th scope="col">Overlap</th>
							<th scope="col">Reconciled</th>
							<th scope="col"><span class="sr-only">Open</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.candidates as c, i (c.sessionId)}
							<tr data-testid="candidate-row" data-session-id={c.sessionId}>
								<td class="cands__link">
									{#if c.link}
										<span class="linkcell">
											<input
												class="sr-only"
												type="text"
												readonly
												value={c.link}
												data-testid="invite-url"
												aria-label={`Link ${i + 1}`}
											/>
											<code class="linkcell__short" title={c.link}>{shorten(c.link)}</code>
											<button
												class="pill btn btn--sm btn--quiet linkcell__copy"
												type="button"
												onclick={() => copy(c.sessionId, c.link ?? '')}
												>{copied === c.sessionId ? 'Copied' : 'Copy'}</button
											>
										</span>
									{:else}
										<span class="cands__used">Used</span>
									{/if}
								</td>
								<td class="cands__who">
									{#if c.email}
										<a href={resolve('/app/s/[id]', { id: c.sessionId })}>{c.email}</a>
										<span class="cands__progress" data-testid="candidate-progress"
											>{PROGRESS[c.progress]}</span
										>
									{:else}
										<span class="cands__muted" data-testid="candidate-progress"
											>{PROGRESS[c.progress]}</span
										>
									{/if}
								</td>
								<td class="cands__fair">
									{#if c.fair}{formatFair(c.fair, data.role.currency)}{:else}<span
											class="cands__muted">—</span
										>{/if}
								</td>
								<td class="cands__overlap">
									{#if c.overlap}
										<button
											class="pill btn btn--sm btn--quiet"
											type="button"
											aria-expanded={openOverlap === c.sessionId}
											onclick={() =>
												(openOverlap = openOverlap === c.sessionId ? null : c.sessionId)}
											>{OVERLAP_LABEL[c.overlap]}</button
										>
									{:else}
										<StateBadge state={c.state} />
									{/if}
								</td>
								<td class="cands__date">
									{#if c.computedAt}<time datetime={c.computedAt}>{formatDate(c.computedAt)}</time
										>{:else}<span class="cands__muted">—</span>{/if}
								</td>
								<td class="cands__open">
									<a href={resolve('/app/s/[id]', { id: c.sessionId })}>Open</a>
								</td>
							</tr>
							{#if openOverlap === c.sessionId}
								{@const pic = picture(c)}
								{#if pic}
									<tr class="cands__detail">
										<td colspan="6">
											<div class="overlap">
												<RevealCanvas
													axis={pic.axis}
													currency={symbol}
													yours={pic.yours}
													zone={pic.zone}
													fair={pic.fair}
													fairLabel={formatFair(pic.fair, data.role.currency)}
													yourLabel="Client budget"
													zoneLabel="Overlap"
													variant="outcome"
													animate={false}
													compact
												/>
											</div>
											<p class="overlap__note">
												{c.nonRemunerationInPlay
													? 'Non-salary factors need to be in play.'
													: 'Closable on salary alone.'}
												<a href={resolve('/app/s/[id]', { id: c.sessionId })}
													>Full result and both sets of figures</a
												>
											</p>
										</td>
									</tr>
								{/if}
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<form
			class="add"
			method="POST"
			action="?/generate"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update();
				};
			}}
		>
			<input type="hidden" name="requestKey" value={data.requestKey} />
			{#if form?.addError}
				<p class="form-error" role="alert">{form.addError}</p>
			{/if}
			<div class="add__actions">
				{#if data.balance < 1}
					<a
						class="pill pill--gold btn"
						href={resolve('/account/billing')}
						data-testid="buy-credits">Buy credits</a
					>
					<span class="entry-note">You have no credits left; each link uses one.</span>
				{:else}
					<button
						class="pill pill--gold btn"
						type="submit"
						disabled={busy || !data.role.budget}
						data-testid="generate-link"
					>
						{busy ? 'Generating…' : count === 1 ? 'Generate a link' : `Generate ${count} links`}
					</button>
					<label class="add__count">
						<span class="sr-only">How many links</span>
						<select name="count" class="field__input add__select" bind:value={count}>
							{#each [1, 2, 3, 5, 10] as n (n)}
								<option value={n}>{n}</option>
							{/each}
						</select>
					</label>
					<span class="entry-note">
						{data.role.budget
							? `One credit each (${data.balance} left). Each link works once.`
							: 'Save the budget first.'}
					</span>
				{/if}
			</div>
		</form>
	</section>
</main>

<style>
	.entry-intro {
		margin: 0 0 14px;
		color: var(--slate);
		font-size: 16px;
		max-width: 62ch;
	}

	.entry-actions {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}

	.entry-note {
		font-size: 14px;
		color: var(--slate);
	}

	.table-wrap {
		overflow-x: auto;
		margin-top: 14px;
	}

	.cands {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}

	.cands th {
		text-align: left;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 11px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--slate);
		padding: 8px 12px 10px 0;
		border-bottom: 1px solid var(--hairline);
	}

	.cands td {
		padding: 12px 12px 12px 0;
		border-bottom: 1px solid var(--hairline);
		vertical-align: middle;
	}

	.cands__detail td {
		padding: 6px 0 18px;
	}

	.linkcell {
		display: inline-flex;
		align-items: center;
		gap: 10px;
	}

	.linkcell__short {
		font-family: var(--font-body);
		font-variant-numeric: tabular-nums;
		font-size: 14px;
		color: var(--navy);
		background: var(--ground);
		box-shadow: var(--inset-sm);
		padding: 6px 10px;
		border-radius: 8px;
		white-space: nowrap;
	}

	.cands__used,
	.cands__muted {
		color: var(--slate);
	}

	.cands__who a {
		color: var(--navy);
		font-weight: 600;
	}

	.cands__progress {
		display: block;
		font-size: 13px;
		color: var(--slate);
	}

	.cands__fair {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--navy);
		white-space: nowrap;
	}

	.cands__date {
		white-space: nowrap;
		color: var(--ink);
	}

	.cands__open a {
		color: var(--slate);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.overlap {
		position: relative;
		height: 300px;
		padding: 28px 24px 30px 28px;
		background: var(--navy);
		border-radius: 16px;
		box-shadow: var(--lift-navy);
	}

	.overlap__note {
		margin: 10px 0 0;
		font-size: 14px;
		color: var(--slate);
	}

	.overlap__note a {
		margin-left: 8px;
		color: var(--navy);
	}

	.add {
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--hairline);
	}

	.add__actions {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
	}

	.add__select {
		width: 72px;
		padding: 8px 10px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.cands th:nth-child(5),
		.cands td:nth-child(5) {
			display: none;
		}
	}
</style>
