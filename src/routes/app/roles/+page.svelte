<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { resolve } from '$app/paths';
	import StateBadge from '$lib/client/recruitment/StateBadge.svelte';
	import { formatDate } from '$lib/client/recruitment/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Roles</title>
</svelte:head>

<main class="shell">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">Roles</h1>
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
			<a class="pill pill--gold btn" href={resolve('/app/new')}>New role</a>
		</div>
	</header>

	{#if data.roles.length === 0}
		<section class="panel empty" aria-labelledby="empty-title">
			<h2 id="empty-title" class="panel__title">No roles yet</h2>
			<p class="panel__lede">
				A role holds the client's budget as four figures. Each candidate you add gets a private link
				and answers with four of their own. Neither side sees the other's numbers. When a candidate
				answers, you get the fair salary, whether the two ranges meet, and what they were shown.
			</p>
			<ol class="empty__steps">
				<li>Name the role and enter the client's budget.</li>
				<li>Add candidates by email and send each their private link.</li>
				<li>Read each result together with what the candidate saw.</li>
			</ol>
			<a class="pill pill--navy btn" href={resolve('/app/new')}>Start your first role</a>
		</section>
	{:else}
		<section class="panel list" aria-label="Your roles">
			<ul class="list__rows">
				{#each data.roles as r (r.id)}
					<li>
						<a
							class="list__row"
							href={resolve('/app/r/[id]', { id: r.id })}
							data-testid="session-row"
						>
							<span class="list__title">{r.title}</span>
							<span class="list__cands">
								{#if r.candidates.length === 0}
									<span class="list__none">No candidates yet</span>
								{:else}
									{#each r.candidates as c (c.sessionId)}
										<span class="list__cand"><StateBadge state={c.state} /> {c.email}</span>
									{/each}
								{/if}
							</span>
							<time class="list__date" datetime={r.createdAt}>{formatDate(r.createdAt)}</time>
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

	.list__cands {
		grid-area: cands;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
		flex: 1;
		min-width: 0;
	}

	.list__cand {
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
			'cands cands arrow';
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

	.list__row :global(.badge) {
		grid-area: badge;
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
			grid-template-columns: 150px 1fr auto 24px;
			grid-template-areas: 'badge email date arrow';
			padding: 18px 32px;
		}
		.list__date {
			font-size: 15px;
		}
	}
</style>
