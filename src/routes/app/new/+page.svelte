<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let busy = $state(false);
	const noCredit = $derived(data.balance < 1);
</script>

<svelte:head>
	<title>New salary check</title>
</svelte:head>

<main class="shell shell--narrow">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">New salary check</h1>
			<p class="shell__sub">
				One credit per check. You have <strong data-testid="balance">{data.balance}</strong>.
			</p>
		</div>
		<a class="link-quiet" href={resolve('/app')}>Back to your checks</a>
	</header>

	<form
		class="panel"
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update();
			};
		}}
	>
		<h2 class="panel__title">Who is the candidate?</h2>
		<p class="panel__lede">
			The link you send is bound to this address and works once. Nothing is emailed by us; you send
			the link yourself in the next step.
		</p>

		<input type="hidden" name="requestKey" value={data.requestKey} />

		<div class="field">
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
				aria-invalid={form?.error ? 'true' : undefined}
			/>
		</div>

		<div class="field">
			<label class="field__label" for="currency">Currency</label>
			<select id="currency" class="field__input" name="currency">
				{#each data.currencies as c (c)}
					<option value={c} selected={(form?.currency ?? 'GBP') === c}>{c}</option>
				{/each}
			</select>
			<span class="field__help">Annual salary, before tax, in this currency.</span>
		</div>

		{#if form?.error}
			<p class="form-error" role="alert">{form.error}</p>
		{/if}
		{#if noCredit}
			<p class="form-error" role="status">
				You have no credits left. New checks need one credit each.
			</p>
		{/if}

		<div class="actions">
			<button class="pill pill--gold btn" type="submit" disabled={busy || noCredit}>
				{busy ? 'Starting…' : 'Start the check'}
			</button>
		</div>
	</form>
</main>

<style>
	.actions {
		margin-top: 26px;
	}
</style>
