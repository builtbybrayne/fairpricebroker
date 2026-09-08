<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Your account</title>
</svelte:head>

<main>
	<h1>Your account</h1>
	<p>Signed in as <strong data-testid="email">{data.email}</strong>.</p>
	<p>Launch credits: <strong data-testid="balance">{data.balance}</strong></p>
	<form method="POST" action="/signout">
		<button type="submit">Sign out</button>
	</form>
</main>
