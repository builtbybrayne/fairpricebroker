<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { resolve } from '$app/paths';
	import StateBadge from '$lib/client/recruitment/StateBadge.svelte';
	import { formatDate } from '$lib/client/recruitment/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Salary checks</title>
</svelte:head>

<main class="shell">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">Salary checks</h1>
			<p class="shell__sub">
				Signed in as <strong data-testid="email">{data.email}</strong>
				<span aria-hidden="true"> · </span>
				<span class="credits"
					><strong data-testid="balance">{data.balance}</strong>
					{data.balance === 1 ? 'credit' : 'credits'} left</span
				>
			</p>
		</div>
		<div class="shell__actions">
			<a class="pill pill--gold btn" href={resolve('/app/new')}>New salary check</a>
			<form method="POST" action="/signout">
				<button class="link-quiet" type="submit">Sign out</button>
			</form>
		</div>
	</header>

	{#if data.sessions.length === 0}
		<section class="panel empty" aria-labelledby="empty-title">
			<h2 id="empty-title" class="panel__title">No checks yet</h2>
			<p class="panel__lede">
				A salary check asks you for the client's budget as four figures and the candidate for their
				expectations as four more. Neither side sees the other's numbers while they enter their own.
				When both are in, you get the fair salary, whether the two ranges meet, and what the
				candidate was shown.
			</p>
			<ol class="empty__steps">
				<li>Enter the client's budget.</li>
				<li>Send the candidate their private link.</li>
				<li>Read the result together with what they saw.</li>
			</ol>
			<a class="pill pill--navy btn" href={resolve('/app/new')}>Start your first check</a>
		</section>
	{:else}
		<section class="panel list" aria-label="Your salary checks">
			<ul class="list__rows">
				{#each data.sessions as s (s.id)}
					<li>
						<a
							class="list__row"
							href={resolve('/app/s/[id]', { id: s.id })}
							data-testid="session-row"
						>
							<StateBadge state={s.state} />
							<span class="list__email">{s.candidateEmail ?? 'No candidate'}</span>
							<time class="list__date" datetime={s.createdAt}>{formatDate(s.createdAt)}</time>
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

	.list__rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.list__row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		grid-template-areas:
			'badge date arrow'
			'email email arrow';
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

	.list__email {
		grid-area: email;
		font-weight: 600;
		font-size: 16px;
		overflow-wrap: anywhere;
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
