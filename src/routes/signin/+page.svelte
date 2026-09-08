<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<main>
	<h1>Sign in</h1>
	<p>
		This is a preview sign-in. Type an email address and you're in: there is no password and no
		email is sent.
	</p>
	<form method="POST" action={data.next ? `?next=${encodeURIComponent(data.next)}` : ''}>
		<label>
			Email
			<input
				type="email"
				name="email"
				autocomplete="email"
				required
				value={form?.email}
				aria-invalid={form?.error ? 'true' : undefined}
			/>
		</label>
		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}
		<button type="submit">Continue</button>
	</form>
</main>
