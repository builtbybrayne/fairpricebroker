<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Billing</title>
</svelte:head>

<main class="shell shell--narrow">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">Billing</h1>
			<p class="shell__sub">
				You have <strong data-testid="balance">{data.balance}</strong>
				{data.balance === 1 ? 'credit' : 'credits'}. Each candidate link uses one.
			</p>
		</div>
		<a class="link-quiet" href={resolve('/account')}>Account</a>
	</header>

	<section class="panel" aria-labelledby="buy-title">
		<h2 id="buy-title" class="panel__title">Buy credits</h2>
		<p class="panel__lede">
			Paid credits are not switched on yet. While we finish billing, every new account starts with 8
			free credits, and you can ask us for more at any time.
		</p>
		<div class="buy">
			<button class="pill pill--gold btn" type="button" disabled data-testid="buy-credits"
				>Buy credits (soon)</button
			>
			<a class="link-quiet" href="mailto:hello@fairprice.broker?subject=More%20credits"
				>Ask for more credits</a
			>
		</div>
	</section>
</main>

<style>
	.buy {
		display: flex;
		align-items: center;
		gap: 18px;
		flex-wrap: wrap;
	}
</style>
