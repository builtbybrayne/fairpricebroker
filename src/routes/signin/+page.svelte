<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in — Fair Price Broker</title>
</svelte:head>

<main class="shell shell--narrow">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">Sign in</h1>
			<p class="shell__sub">Type your email and you are in. No password, nothing sent.</p>
		</div>
	</header>

	<form
		class="panel"
		method="POST"
		action={data.next ? `?next=${encodeURIComponent(data.next)}` : ''}
	>
		<div class="field">
			<label class="field__label" for="email">Email</label>
			<input
				id="email"
				class="field__input"
				type="email"
				name="email"
				autocomplete="email"
				required
				placeholder="name@example.com"
				value={form?.email}
				aria-invalid={form?.error ? 'true' : undefined}
			/>
			<span class="field__help"
				>New accounts start with 8 free credits; each candidate link uses one. This is a preview
				sign-in while we build: your address is only used to find your roles.</span
			>
		</div>
		{#if form?.error}
			<p class="form-error" role="alert">{form.error}</p>
		{/if}
		<div class="actions">
			<button class="pill pill--gold btn" type="submit">Continue</button>
		</div>
	</form>
</main>

<style>
	.actions {
		margin-top: 22px;
	}
</style>
