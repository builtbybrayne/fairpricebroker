<script lang="ts">
	import '$lib/client/offers/offers.css';
	import { resolve } from '$app/paths';
	import StateBadge from '$lib/client/offers/StateBadge.svelte';
	import { formatDate } from '$lib/client/offers/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const t = $derived(data.terms);
</script>

<svelte:head>
	<title>{data.terms.offers}</title>
</svelte:head>

<main class="shell">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">{t.offers}</h1>
			<p class="shell__sub">
				<a class="link-quiet" href={resolve('/app')}>Your home</a>
				<span aria-hidden="true"> · </span>
				<span class="credits"
					><strong data-testid="balance">{data.balance}</strong>
					{data.balance === 1 ? 'credit' : 'credits'} left</span
				>
			</p>
		</div>
		<div class="shell__actions">
			<a class="pill pill--gold btn" href={resolve('/app/offers/new')}
				>New {t.offer.toLowerCase()}</a
			>
		</div>
	</header>

	{#if data.offers.length === 0}
		<section class="panel empty" aria-labelledby="empty-title">
			<h2 id="empty-title" class="panel__title">No {t.offers.toLowerCase()} yet</h2>
			<p class="panel__lede">
				An {t.offer.toLowerCase()} holds the {t.buyer.toLowerCase()}'s budget as four figures. Each
				{t.seller.toLowerCase()} you add gets a private link and answers with four of their own. Neither
				side sees the other's numbers. When a {t.seller.toLowerCase()} answers, you get the fair salary,
				whether the two ranges meet, and what they were shown.
			</p>
			<ol class="empty__steps">
				<li>Name the {t.offer.toLowerCase()} and enter the {t.buyer.toLowerCase()}'s budget.</li>
				<li>Generate a private link per {t.seller.toLowerCase()} and send it yourself.</li>
				<li>Read each result together with what the {t.seller.toLowerCase()} saw.</li>
			</ol>
			<a class="pill pill--navy btn" href={resolve('/app/offers/new')}
				>Start your first {t.offer.toLowerCase()}</a
			>
		</section>
	{:else}
		<section class="panel list" aria-label="Your {t.offers.toLowerCase()}">
			<ul class="list__rows">
				{#each data.offers as o (o.id)}
					<li>
						<a
							class="list__row"
							href={resolve('/app/o/[id]', { id: o.id })}
							data-testid="offer-row"
						>
							<span class="list__title">{o.title}</span>
							<span class="list__responses">
								{#if o.responses.length === 0}
									<span class="list__none">No {t.seller.toLowerCase()}s yet</span>
								{:else}
									{#each o.responses as r (r.reconciliationId)}
										<span class="list__response"><StateBadge state={r.state} /> {r.email}</span>
									{/each}
								{/if}
							</span>
							<time class="list__date" datetime={o.createdAt}>{formatDate(o.createdAt)}</time>
							<svg class="list__arrow" viewBox="0 0 24 24" aria-hidden="true"
								><path
									d="M5 12h13M13 6l6 6-6 6"
									fill="none"
									stroke="currentColor"
									stroke-width="2.2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/></svg
							>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	.credits {
		color: var(--slate);
	}

	.empty__steps {
		margin: 18px 0 22px;
		padding-left: 22px;
		color: var(--ink);
		display: grid;
		gap: 6px;
		font-size: 16px;
	}

	.list {
		padding: 8px 0;
	}

	.list__title {
		grid-area: title;
		font-weight: 700;
		color: var(--navy);
		font-family: var(--font-display);
		font-size: 18px;
	}

	.list__responses {
		grid-area: responses;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		flex: 1;
		min-width: 0;
	}

	.list__response {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--ink);
	}

	.list__none {
		font-size: 14px;
		color: var(--slate);
	}

	.list__rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.list__row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		grid-template-areas:
			'title date arrow'
			'responses responses arrow';
		align-items: center;
		gap: 8px 14px;
		padding: 16px 22px;
		text-decoration: none;
		color: var(--ink);
		border-bottom: 1px solid var(--hairline);
		transition: background var(--dur-fast) var(--ease-out);
	}

	.list__rows li:last-child .list__row {
		border-bottom: 0;
	}

	.list__row:hover {
		background: rgba(255, 255, 255, 0.45);
	}

	.list__date {
		grid-area: date;
		color: var(--slate);
		font-size: 14px;
	}

	.list__arrow {
		grid-area: arrow;
		width: 22px;
		height: 22px;
		color: var(--mist);
	}

	@media (min-width: 720px) {
		.list__row {
			grid-template-columns: 1fr auto 24px;
			grid-template-areas:
				'title date arrow'
				'responses responses arrow';
			padding: 18px 32px;
		}
		.list__date {
			font-size: 15px;
		}
	}
</style>
