<script lang="ts">
	import '$lib/client/offers/offers.css';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import { symbolFor } from '$lib/client/offers/format';
	import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const t = $derived(data.terms);
	let busy = $state(false);
	let currency = $state('GBP');
	$effect(() => {
		if (form?.currency) currency = form.currency;
	});
	const offerer = salaryNegotiationTemplate.offeredBy;
	const questions = salaryNegotiationTemplate.questions[offerer];
	const rows = questions.map((q) => ({ key: q.key, label: q.label, help: q.prompt }));
	const meterTitle = salaryNegotiationTemplate.roles[offerer].label;
	let values = $state<(string | null)[]>([null, null, null, null]);
</script>

<svelte:head>
	<title>New {data.terms.offer.toLowerCase()}</title>
</svelte:head>

<main class="shell shell--narrow">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">New {t.offer.toLowerCase()}</h1>
			<p class="shell__sub">
				Name the {t.offer.toLowerCase()} and enter the {t.buyer.toLowerCase()}'s budget once. Then
				add as many {t.seller.toLowerCase()}s as you like; each costs one credit. You have
				<strong data-testid="balance">{data.balance}</strong>.
			</p>
		</div>
		<a class="link-quiet" href={resolve('/app/offers')}>Back to your {t.offers.toLowerCase()}</a>
	</header>

	<form
		class="panel"
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				busy = false;
				await update({ reset: false });
			};
		}}
	>
		<h2 class="panel__title">The {t.offer.toLowerCase()}</h2>

		<div class="field">
			<label class="field__label" for="title">{t.offer} title</label>
			<input
				id="title"
				class="field__input"
				type="text"
				name="title"
				autocomplete="off"
				required
				maxlength="120"
				placeholder="e.g. Senior product designer, London"
				value={form?.title ?? ''}
				aria-invalid={form?.error ? 'true' : undefined}
			/>
			<span class="field__help">{t.seller}s never see this page; the title is for your list.</span>
		</div>

		<div class="field">
			<label class="field__label" for="currency">Currency</label>
			<select id="currency" class="field__input" name="currency" bind:value={currency}>
				{#each data.currencies as c (c)}
					<option value={c}>{c}</option>
				{/each}
			</select>
			<span class="field__help">Annual salary, before tax, in this currency.</span>
		</div>

		<h2 class="panel__title budget-title">The {t.buyer.toLowerCase()}'s budget</h2>
		<p class="panel__lede">
			Answer for the {t.buyer.toLowerCase()}. {t.seller}s never see these figures; you see both sets
			once a {t.seller.toLowerCase()} has answered.
		</p>
		<MeterPanel
			title={meterTitle}
			{rows}
			bind:values
			mode="entry"
			accent="blue"
			currency={symbolFor(currency)}
			min={0}
			max={250000}
			step={500}
			example={[40000, 48000, 58000, 65000]}
		/>
		{#each values as v, i (i)}
			<input type="hidden" name={`v${i + 1}`} value={v ?? ''} />
		{/each}

		{#if form?.error}
			<p class="form-error" role="alert">{form.error}</p>
		{/if}

		<div class="actions">
			<button class="pill pill--gold btn" type="submit" disabled={busy}>
				{busy ? 'Creating…' : `Create the ${t.offer.toLowerCase()}`}
			</button>
		</div>
	</form>
</main>

<style>
	.budget-title {
		margin-top: 28px;
	}

	.actions {
		margin-top: 26px;
	}
</style>
