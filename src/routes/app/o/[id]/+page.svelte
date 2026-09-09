<script lang="ts">
	import '$lib/client/offers/offers.css';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import RevealCanvas from '$lib/client/reveal/RevealCanvas.svelte';
	import LivePoll from '$lib/client/offers/LivePoll.svelte';
	import StateBadge from '$lib/client/offers/StateBadge.svelte';
	import {
		formatDate,
		formatFair,
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

	const offerer = $derived(data.offer.offeredBy);
	const respondent = $derived(otherSide(data.offer.offeredBy));
	const questions = $derived(salaryNegotiationTemplate.questions[offerer]);
	const rows = $derived(questions.map((q) => ({ key: q.key, label: q.label, help: q.prompt })));
	const meterTitle = $derived(salaryNegotiationTemplate.roles[offerer].label);
	const respondentName = $derived(t[respondent]);
	const symbol = $derived(symbolFor(data.offer.currency));

	let editing = $state(false);
	let values = $state<(string | null)[]>([null, null, null, null]);
	$effect(() => {
		if (data.offer.figures) values = [...data.offer.figures];
	});
	let busy = $state(false);
	let copied = $state<string | null>(null);
	let count = $state(1);
	let openOverlap = $state<string | null>(null);

	const anyAnswered = $derived(
		data.responses.some((r) => r.progress === 'answered' || r.progress === 'result')
	);
	const waiting = $derived(data.responses.some((r) => r.state === 'open' || r.state === 'locked'));

	async function copy(reconciliationId: string, url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = reconciliationId;
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

	/** The overlap picture for a finished reconciliation: the offerer's range and the zone. */
	function picture(r: (typeof data.responses)[number]) {
		if (!r.figures || !r.fair) return null;
		const own = tupleRange(r.figures[offerer]);
		const theirs = tupleRange(r.figures[respondent]);
		const axis = niceAxis([own.lo, own.hi, theirs.lo, theirs.hi, Number(r.fair)]);
		return {
			axis,
			yours: quantiseRange(own, axis),
			zone: rangeOverlap(own, theirs),
			fair: Number(r.fair)
		};
	}
</script>

<svelte:head>
	<title>{data.offer.title} — {data.terms.offers.toLowerCase()}</title>
</svelte:head>

<LivePoll active={waiting} />

<main class="shell">
	<header class="shell__head">
		<div>
			<a class="link-quiet" href={resolve('/app/offers')}>All {t.offers.toLowerCase()}</a>
			<h1 class="shell__title" data-testid="offer-title">{data.offer.title}</h1>
			<p class="shell__sub">
				<span class="sub-meta"
					>Started {formatDate(data.offer.createdAt)} · {data.offer.currency}</span
				>
			</p>
		</div>
	</header>

	<!-- the offerer's figures --------------------------------------------- -->
	{#if editing || !data.offer.figures}
		<form
			method="POST"
			action="?/figures"
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
				Answer for the {t.buyer.toLowerCase()}. {respondentName}s never see these figures; you see
				both sets once a {respondentName.toLowerCase()} has answered.
			</p>
			<MeterPanel
				title={meterTitle}
				{rows}
				bind:values
				mode="entry"
				accent="blue"
				currency={symbol}
				min={0}
				max={250000}
				step={500}
				example={[40000, 48000, 58000, 65000]}
				error={form?.figuresError ?? null}
			>
				{#snippet footer()}
					<div class="entry-actions">
						<button class="pill pill--gold btn" type="submit" disabled={busy}>
							{busy ? 'Saving…' : 'Save the budget'}
						</button>
						{#if data.offer.figures}
							<button class="pill btn btn--quiet" type="button" onclick={() => (editing = false)}
								>Keep the current budget</button
							>
						{/if}
						<span class="entry-note"
							>Applies to every {respondentName.toLowerCase()} who has not answered yet.</span
						>
					</div>
				{/snippet}
			</MeterPanel>
			{#each values as v, i (i)}
				<input type="hidden" name={`v${i + 1}`} value={v ?? ''} />
			{/each}
		</form>
	{:else}
		<section class="meter-wrap" aria-label={meterTitle}>
			<MeterPanel
				title={meterTitle}
				{rows}
				values={[...data.offer.figures]}
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
							data-testid="edit-figures">Edit the budget</button
						>
						<span class="entry-note">
							{anyAnswered
								? `${respondentName}s who have already answered keep the budget they answered against.`
								: `You can change the budget until a ${respondentName.toLowerCase()} answers.`}
						</span>
					</div>
				{/snippet}
			</MeterPanel>
		</section>
	{/if}

	<!-- the responses ------------------------------------------------------ -->
	<section class="panel" aria-labelledby="responses-title">
		<h2 id="responses-title" class="panel__title">{respondentName}s</h2>
		{#if data.responses.length === 0}
			<p class="panel__lede">
				No links yet. Generate a private link for each {respondentName.toLowerCase()} and send it yourself;
				each link works once, costs one credit, and tells you who used it when they open it.
			</p>
		{:else}
			<p class="panel__lede">
				One private link per {respondentName.toLowerCase()}, sent by you. Each works once; the
				{respondentName.toLowerCase()}'s email appears when they open it.
			</p>
			<div class="table-wrap">
				<table class="responses">
					<thead>
						<tr>
							<th scope="col">Link</th>
							<th scope="col">{respondentName}</th>
							<th scope="col">Fair salary</th>
							<th scope="col">Overlap</th>
							<th scope="col">Reconciled</th>
							<th scope="col"><span class="sr-only">Details</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.responses as r, i (r.reconciliationId)}
							<tr data-testid="response-row" data-reconciliation-id={r.reconciliationId}>
								<td class="responses__link">
									{#if r.link}
										<span class="linkcell">
											<code class="linkcell__short" title={r.link}>{shorten(r.link)}</code>
											{#if r.copyable}
												<input
													class="sr-only"
													type="text"
													readonly
													value={r.link}
													data-testid="invite-url"
													aria-label={`Link ${i + 1}`}
												/>
												<button
													class="pill btn btn--sm btn--quiet linkcell__copy"
													type="button"
													onclick={() => copy(r.reconciliationId, r.link ?? '')}
													>{copied === r.reconciliationId ? 'Copied' : 'Copy'}</button
												>
											{/if}
										</span>
									{:else}
										<span class="responses__used">used</span>
									{/if}
								</td>
								<td class="responses__who">
									{#if r.email}
										<a href={resolve('/app/rec/[id]', { id: r.reconciliationId })}>{r.email}</a>
										<span class="responses__progress" data-testid="response-progress"
											>{PROGRESS[r.progress]}</span
										>
									{:else}
										<span class="responses__muted" data-testid="response-progress"
											>{PROGRESS[r.progress]}</span
										>
									{/if}
								</td>
								<td class="responses__fair">
									{#if r.fair}{formatFair(r.fair, data.offer.currency)}{:else}<span
											class="responses__muted">—</span
										>{/if}
								</td>
								<td class="responses__overlap">
									{#if r.overlap}
										<button
											class="pill btn btn--sm btn--quiet"
											type="button"
											aria-expanded={openOverlap === r.reconciliationId}
											onclick={() =>
												(openOverlap =
													openOverlap === r.reconciliationId ? null : r.reconciliationId)}
											>{OVERLAP_LABEL[r.overlap]}</button
										>
									{:else}
										<StateBadge state={r.state} />
									{/if}
								</td>
								<td class="responses__date">
									{#if r.computedAt}<time datetime={r.computedAt}>{formatDate(r.computedAt)}</time
										>{:else}<span class="responses__muted">—</span>{/if}
								</td>
								<td class="responses__open">
									<a href={resolve('/app/rec/[id]', { id: r.reconciliationId })}>Details</a>
								</td>
							</tr>
							<tr class="responses__tags" data-testid="response-tags">
								<td colspan="6">
									<div class="tags">
										{#each r.tags as tag (tag.id)}
											<form method="POST" action="?/untag" use:enhance class="tag">
												<input type="hidden" name="reconciliationId" value={r.reconciliationId} />
												<input type="hidden" name="tagId" value={tag.id} />
												<span class="tag__name">{tag.name}</span>
												<button
													class="tag__remove"
													type="submit"
													aria-label={`Remove tag ${tag.name}`}>×</button
												>
											</form>
										{/each}
										<form method="POST" action="?/tag" use:enhance class="tag-add">
											<input type="hidden" name="reconciliationId" value={r.reconciliationId} />
											<input
												class="tag-add__input inset"
												type="text"
												name="name"
												maxlength="40"
												placeholder="Add a tag"
												list="known-tags"
												aria-label={`Add a tag to link ${i + 1}`}
												data-testid="tag-input"
											/>
											<button class="tag-add__go" type="submit" aria-label="Add the tag">+</button>
										</form>
									</div>
								</td>
							</tr>
							{#if openOverlap === r.reconciliationId}
								{@const pic = picture(r)}
								{#if pic}
									<tr class="responses__detail">
										<td colspan="6">
											<div class="overlap">
												<RevealCanvas
													axis={pic.axis}
													currency={symbol}
													yours={pic.yours}
													zone={pic.zone}
													fair={pic.fair}
													fairLabel={formatFair(pic.fair, data.offer.currency)}
													yourLabel={meterTitle}
													zoneLabel="Overlap"
													variant="outcome"
													animate={false}
													compact
												/>
											</div>
											<p class="overlap__note">
												{r.nonRemunerationInPlay
													? 'Non-salary factors need to be in play.'
													: 'Closable on salary alone.'}
												<a href={resolve('/app/rec/[id]', { id: r.reconciliationId })}
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
			<datalist id="known-tags">
				{#each data.tags as tag (tag.id)}
					<option value={tag.name}></option>
				{/each}
			</datalist>
			{#if form?.tagError}
				<p class="form-error" role="alert">{form.tagError}</p>
			{/if}
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
						disabled={busy || !data.offer.figures}
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
						{data.offer.figures
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

	.responses {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
	}

	.responses th {
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

	.responses td {
		padding: 12px 12px 12px 0;
		border-bottom: 1px solid var(--hairline);
		vertical-align: middle;
	}

	.responses__detail td {
		padding: 6px 0 18px;
	}

	.responses__tags td {
		padding: 4px 0 12px;
		border-bottom: 1px solid var(--hairline);
	}

	.responses tbody tr:not(.responses__tags) td {
		border-bottom: 0;
	}

	.tags {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 6px 0 12px;
		border-radius: var(--radius-pill);
		box-shadow: var(--inset-sm);
		font-size: 13px;
		color: var(--navy);
		font-weight: 600;
	}

	.tag__remove {
		width: 18px;
		height: 18px;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--slate);
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
	}

	.tag__remove:hover {
		color: var(--terracotta);
	}

	.tag-add {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.tag-add__input {
		height: 28px;
		width: 130px;
		border: 0;
		border-radius: var(--radius-pill);
		padding: 0 12px;
		font: inherit;
		font-size: 13px;
		color: var(--ink);
	}

	.tag-add__input:focus {
		outline: 2px solid var(--gold);
		outline-offset: 1px;
	}

	.tag-add__go {
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: 50%;
		background: var(--ground);
		box-shadow: var(--raise-sm);
		color: var(--navy);
		font-size: 16px;
		line-height: 1;
		cursor: pointer;
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

	.responses__used,
	.responses__muted {
		color: var(--slate);
	}

	.responses__who a {
		color: var(--navy);
		font-weight: 600;
	}

	.responses__progress {
		display: block;
		font-size: 13px;
		color: var(--slate);
	}

	.responses__fair {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--navy);
		white-space: nowrap;
	}

	.responses__date {
		white-space: nowrap;
		color: var(--ink);
	}

	.responses__open a {
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
		.responses th:nth-child(5),
		.responses td:nth-child(5) {
			display: none;
		}
	}
</style>
