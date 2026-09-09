<script lang="ts">
	import '$lib/client/offers/offers.css';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{data.needEmail ? 'Your private link' : "This link isn't live"}</title>
</svelte:head>

{#if data.needEmail}
	<main class="shell shell--narrow">
		<header class="shell__head">
			<div>
				<h1 class="shell__title">Your private link</h1>
				<p class="shell__sub">
					A recruiter has asked you four quick questions about salary. Your email is only used so
					the recruiter knows who answered; nothing is sent to it.
				</p>
			</div>
		</header>
		<form class="panel" method="POST">
			<div class="field">
				<label class="field__label" for="email">Your email</label>
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
				<span class="field__help">This link works once, for you.</span>
			</div>
			{#if form?.error}
				<p class="form-error" role="alert">{form.error}</p>
			{/if}
			<div class="actions">
				<button class="pill pill--gold btn" type="submit">Continue</button>
			</div>
		</form>
	</main>
{:else}
	<main class="shell shell--narrow">
		<header class="shell__head">
			<div>
				<h1 class="shell__title">This link isn't live</h1>
				<p class="shell__sub">
					The link you opened is no longer valid. It may have expired, been withdrawn, or already
					been used.
				</p>
			</div>
		</header>
		<p class="dead">
			If you were expecting to take part, ask the person who sent it for a new link.
		</p>
	</main>
{/if}

<style>
	.actions {
		margin-top: 22px;
	}

	.dead {
		color: var(--slate);
		font-size: 16px;
	}
</style>
