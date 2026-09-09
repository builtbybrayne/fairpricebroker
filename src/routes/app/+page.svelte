<script lang="ts">
	import '$lib/client/offers/offers.css';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Your home</title>
</svelte:head>

<main class="shell">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">Your home</h1>
			<p class="shell__sub">
				Signed in as <strong data-testid="email">{data.email}</strong>
				<span aria-hidden="true"> · </span>
				<span class="credits"
					><strong data-testid="balance">{data.balance}</strong>
					{data.balance === 1 ? 'credit' : 'credits'} left</span
				>
				<a class="credits__buy" href={resolve('/account/billing')}>Buy more</a>
			</p>
		</div>
	</header>

	<section class="verticals" aria-label="Your instruments">
		{#each data.verticals as v (v.id)}
			<article class="panel vertical" class:vertical--soon={!v.ready}>
				<h2 class="panel__title">{v.name}</h2>
				{#if v.id === 'salary-negotiation'}
					<p class="panel__lede">
						The salary conversation without the standoff: the {v.buyer.toLowerCase()}'s budget once,
						a private link per {v.seller.toLowerCase()}, and a fair salary with a straight read on
						the overlap.
					</p>
					<p class="vertical__glance">
						{#if data.offerCount === 0}
							No {v.offers.toLowerCase()} yet.
						{:else}
							{data.offerCount}
							{data.offerCount === 1 ? v.offer.toLowerCase() : v.offers.toLowerCase()} · {data.openCount}
							with a {v.seller.toLowerCase()} still to answer
						{/if}
					</p>
					<div class="vertical__actions">
						<a class="pill pill--navy btn" href={resolve('/app/offers')}
							>Open {v.offers.toLowerCase()}</a
						>
						<a class="pill pill--gold btn" href={resolve('/app/offers/new')} data-testid="new-offer"
							>New {v.offer.toLowerCase()}</a
						>
					</div>
				{:else}
					<p class="panel__lede">
						Ask your first {v.buyer.toLowerCase()}s the same four questions and get a price your
						market will actually pay.
					</p>
					<span class="caps vertical__tag">Coming next</span>
				{/if}
			</article>
		{/each}
	</section>
</main>

<style>
	.credits {
		color: var(--slate);
	}

	.credits__buy {
		margin-left: 10px;
		color: var(--navy);
		font-weight: 600;
	}

	.verticals {
		display: grid;
		grid-template-columns: 1.4fr 1fr;
		gap: 20px;
		align-items: start;
	}

	.verticals :global(.panel + .panel) {
		margin-top: 0;
	}

	.vertical__glance {
		margin: 14px 0 0;
		color: var(--ink);
		font-weight: 600;
	}

	.vertical__actions {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		margin-top: 18px;
	}

	.vertical--soon {
		opacity: 0.85;
	}

	.vertical__tag {
		display: inline-block;
		margin-top: 14px;
		font-size: 11px;
		letter-spacing: 0.16em;
		color: var(--slate);
	}

	@media (max-width: 900px) {
		.verticals {
			grid-template-columns: 1fr;
		}
	}
</style>
