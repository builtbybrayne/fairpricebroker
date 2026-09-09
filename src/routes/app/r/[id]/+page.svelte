<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import LivePoll from '$lib/client/recruitment/LivePoll.svelte';
	import StateBadge from '$lib/client/recruitment/StateBadge.svelte';
	import { formatDate, formatFair, OVERLAP_LABEL, symbolFor } from '$lib/client/recruitment/format';
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

	const PROGRESS: Record<string, string> = {
		'not-opened': 'Link not opened yet',
		opened: 'Opened their link',
		answered: 'Answered',
		result: 'Result ready',
		cancelled: 'Cancelled'
	};
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
				Nobody yet. Add a candidate by email to get their private link; each candidate costs one
				credit and answers on their own.
			</p>
		{:else}
			<ul class="cands">
				{#each data.candidates as c (c.sessionId)}
					<li class="cand" data-testid="candidate-row" data-session-id={c.sessionId}>
						<div class="cand__head">
							<a class="cand__email" href={resolve('/app/s/[id]', { id: c.sessionId })}>{c.email}</a
							>
							<StateBadge state={c.state} />
							<span class="cand__progress" data-testid="candidate-progress"
								>{PROGRESS[c.progress]}</span
							>
						</div>
						{#if c.progress === 'result' && c.fair && c.overlap}
							<p class="cand__result">
								<span class="cand__fair">{formatFair(c.fair, data.role.currency)}</span>
								<span class="caps cand__overlap">{OVERLAP_LABEL[c.overlap]}</span>
								<span class="cand__nonrem">
									{c.nonRemunerationInPlay
										? 'Non-salary factors need to be in play'
										: 'Closable on salary alone'}
								</span>
								<a class="cand__open" href={resolve('/app/s/[id]', { id: c.sessionId })}
									>See the result</a
								>
							</p>
						{/if}
						{#if data.inviteUrls[c.sessionId]}
							<div class="linkbox">
								<input
									class="linkbox__url inset"
									type="text"
									readonly
									value={data.inviteUrls[c.sessionId]}
									data-testid="invite-url"
									aria-label={`Invite link for ${c.email}`}
								/>
								<button
									class="pill pill--navy btn btn--sm"
									type="button"
									onclick={() => copy(c.sessionId, data.inviteUrls[c.sessionId])}
								>
									{copied === c.sessionId ? 'Copied' : 'Copy link'}
								</button>
							</div>
							<p class="linkbox__note">
								We haven't emailed it. Send it to {c.email} yourself; it works once, for that address
								only, for 14 days, and is shown only now.
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		<form
			class="add"
			method="POST"
			action="?/add"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update();
				};
			}}
		>
			<input type="hidden" name="requestKey" value={data.requestKey} />
			<div class="field add__field">
				<label class="field__label" for="email">Candidate's email</label>
				<input
					id="email"
					class="field__input"
					type="email"
					name="email"
					autocomplete="off"
					required
					placeholder="name@example.com"
					value={form?.email ?? ''}
					aria-invalid={form?.addError ? 'true' : undefined}
					disabled={!data.role.budget}
				/>
			</div>
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
					<span class="entry-note">You have no credits left; each candidate link uses one.</span>
				{:else}
					<button class="pill pill--gold btn" type="submit" disabled={busy || !data.role.budget}>
						{busy ? 'Adding…' : 'Add candidate'}
					</button>
					<span class="entry-note">
						{data.role.budget
							? `One credit (${data.balance} left). You get their private link to send yourself.`
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

	.cands {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}

	.cand {
		padding: 14px 0 16px;
		border-top: 1px solid var(--hairline);
	}

	.cand__head {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.cand__email {
		font-weight: 600;
		color: var(--navy);
		text-decoration: none;
	}

	.cand__email:hover {
		text-decoration: underline;
	}

	.cand__progress {
		color: var(--slate);
		font-size: 14px;
	}

	.cand__result {
		display: flex;
		align-items: baseline;
		gap: 14px;
		flex-wrap: wrap;
		margin: 10px 0 0;
	}

	.cand__fair {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 22px;
		color: var(--navy);
	}

	.cand__overlap {
		font-size: 12px;
		letter-spacing: 0.16em;
		color: var(--ink);
	}

	.cand__nonrem,
	.cand__open {
		font-size: 14px;
		color: var(--slate);
	}

	.cand__open {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.linkbox {
		display: flex;
		gap: 10px;
		margin-top: 12px;
	}

	.linkbox__url {
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: 12px;
		padding: 11px 14px;
		font-size: 14px;
		color: var(--ink);
	}

	.linkbox__note {
		margin: 8px 0 0;
		font-size: 14px;
		color: var(--slate);
	}

	.add {
		margin-top: 22px;
		padding-top: 18px;
		border-top: 1px solid var(--hairline);
	}

	.add__field {
		max-width: 420px;
	}

	.add__actions {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
		margin-top: 14px;
	}

	@media (max-width: 640px) {
		.linkbox {
			flex-direction: column;
		}
	}
</style>
