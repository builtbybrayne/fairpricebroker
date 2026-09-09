<script lang="ts">
	import '$lib/client/recruitment/recruit.css';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Account</title>
</svelte:head>

<main class="shell shell--narrow">
	<header class="shell__head">
		<div>
			<h1 class="shell__title">Account</h1>
			<p class="shell__sub">Signed in as <strong data-testid="email">{data.email}</strong></p>
		</div>
	</header>

	<section class="panel" aria-labelledby="credits-title">
		<h2 id="credits-title" class="panel__title">Credits</h2>
		<p class="panel__lede">
			You have <strong data-testid="balance">{data.balance}</strong>
			{data.balance === 1 ? 'credit' : 'credits'}. Each candidate link you generate uses one; new
			accounts start with 20.
		</p>
		<a class="pill pill--gold btn" href={resolve('/account/billing')}>Buy credits</a>
	</section>

	<section class="panel" aria-labelledby="verticals-title">
		<h2 id="verticals-title" class="panel__title">Your instruments</h2>
		<ul class="verticals">
			{#each data.verticals as v (v.id)}
				<li class="vertical">
					<span class="vertical__name">{v.name}</span>
					{#if v.ready && v.href}
						<a class="vertical__link" href={v.href}>Open</a>
					{:else}
						<span class="caps vertical__soon">Coming next</span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel" aria-labelledby="signin-title">
		<h2 id="signin-title" class="panel__title">Sign-in</h2>
		<p class="panel__lede">
			This is the preview sign-in: your email is the whole account, and nothing is sent to it.
			Passwords and email sign-in links come with billing.
		</p>
		<form method="POST" action="/signout">
			<button class="pill btn btn--quiet" type="submit">Sign out</button>
		</form>
	</section>
</main>

<style>
	.verticals {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}

	.vertical {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 0;
		border-top: 1px solid var(--hairline);
	}

	.vertical__name {
		font-weight: 600;
		color: var(--navy);
		flex: 1;
	}

	.vertical__link {
		color: var(--navy);
		font-weight: 600;
	}

	.vertical__soon {
		font-size: 11px;
		letter-spacing: 0.16em;
		color: var(--slate);
	}
</style>
