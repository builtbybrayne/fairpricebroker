<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const scopeName = $derived(data.verticals.find((v) => v.id === data.scope)?.name ?? null);
	const scopeHref = $derived(data.scope === 'recruiting' ? resolve('/recruitment') : resolve('/'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#eef1f6" />
</svelte:head>

<header class="topbar">
	<div class="topbar__left">
		<a class="wordmark" href={resolve('/')} aria-label="fair price broker, home">
			<svg class="wordmark__mark" viewBox="0 0 36 36" aria-hidden="true">
				<circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="4.5" />
				<circle cx="18" cy="18" r="5" fill="#e8b34b" />
			</svg>
			<span>fair price broker</span>
		</a>
		{#if scopeName}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above -->
			<a class="scope caps" href={scopeHref} data-testid="scope">{scopeName}</a>
		{/if}
	</div>
	<nav class="topnav" aria-label="Primary">
		<a href={resolve('/method')}>Method</a>
		<a href={resolve('/recruitment')}>For recruiters</a>
		{#if data.account}
			<details class="account">
				<summary class="pill pill--navy topnav__cta account__button" data-testid="account-menu">
					Account
					<svg viewBox="0 0 12 8" aria-hidden="true"
						><path
							d="M1 1.5l5 5 5-5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/></svg
					>
				</summary>
				<div class="account__menu raised">
					<p class="account__who">{data.account.email}</p>
					<p class="account__credits">
						<strong data-testid="menu-balance">{data.balance ?? '—'}</strong>
						{data.balance === 1 ? 'credit' : 'credits'} left
						<a href={resolve('/account/billing')}>Buy more</a>
					</p>
					<a class="account__item" href={resolve('/app')}>Your home</a>
					<a class="account__item" href={resolve('/account')}>Account</a>
					<a class="account__item" href={resolve('/account/billing')}>Billing</a>
					<form method="POST" action="/signout">
						<button class="account__item account__signout" type="submit">Sign out</button>
					</form>
				</div>
			</details>
		{:else}
			<a class="pill pill--navy topnav__cta" href={resolve('/signin')}>Start free</a>
		{/if}
	</nav>
</header>

{@render children()}

<style>
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: calc(68 * var(--u));
		padding: 0 calc(127 * var(--u)) 0 calc(130 * var(--u));
	}

	.topbar__left {
		display: flex;
		align-items: center;
		gap: calc(18 * var(--u));
		min-width: 0;
	}

	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: calc(12 * var(--u));
		text-decoration: none;
		color: var(--navy);
		font-family: var(--font-display);
		font-weight: 700;
		font-size: calc(30 * var(--u));
		letter-spacing: -0.025em;
		line-height: 1;
		white-space: nowrap;
	}

	.wordmark__mark {
		width: calc(36 * var(--u));
		height: calc(36 * var(--u));
	}

	/* the scope tag: which vertical this page belongs to */
	.scope {
		display: inline-flex;
		align-items: center;
		height: calc(28 * var(--u));
		padding: 0 calc(12 * var(--u));
		border-radius: var(--radius-pill);
		box-shadow: var(--inset-sm);
		font-size: calc(11 * var(--u));
		letter-spacing: 0.16em;
		color: var(--terracotta);
		text-decoration: none;
		white-space: nowrap;
	}

	.topnav {
		display: flex;
		align-items: center;
		gap: calc(46 * var(--u));
	}

	.topnav > a:not(.pill) {
		color: var(--slate);
		text-decoration: none;
		font-weight: 500;
		font-size: calc(18 * var(--u));
	}

	.topnav > a:not(.pill):hover {
		color: var(--navy);
	}

	.topnav__cta {
		height: calc(46 * var(--u));
		padding: 0 calc(30 * var(--u));
		font-size: calc(19 * var(--u));
		text-decoration: none;
	}

	/* the account menu ---------------------------------------------------- */
	.account {
		position: relative;
	}

	.account__button {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		list-style: none;
		cursor: pointer;
	}

	.account__button::-webkit-details-marker {
		display: none;
	}

	.account__button svg {
		width: 12px;
		height: 8px;
	}

	.account__menu {
		position: absolute;
		right: 0;
		top: calc(100% + 10px);
		z-index: 20;
		min-width: 260px;
		padding: 16px 18px;
		display: grid;
		gap: 6px;
	}

	.account__who {
		font-size: 14px;
		color: var(--slate);
		margin: 0 0 4px;
		word-break: break-all;
	}

	.account__credits {
		margin: 0 0 8px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--hairline);
		font-size: 15px;
		color: var(--ink);
	}

	.account__credits a {
		margin-left: 8px;
		color: var(--navy);
		font-weight: 600;
	}

	.account__item {
		display: block;
		padding: 6px 0;
		font-size: 16px;
		color: var(--navy);
		text-decoration: none;
		background: none;
		border: 0;
		text-align: left;
		width: 100%;
		cursor: pointer;
		font-weight: 500;
	}

	.account__item:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.account__signout {
		color: var(--slate);
		border-top: 1px solid var(--hairline);
		margin-top: 4px;
		padding-top: 10px;
	}

	@media (max-width: 1024px) {
		:root {
			--u: 1px;
		}
	}

	@media (max-width: 900px) {
		.topbar {
			padding: 0 20px;
			height: 60px;
		}
		.wordmark {
			font-size: 22px;
		}
		.wordmark__mark {
			width: 26px;
			height: 26px;
		}
		.scope {
			height: 24px;
			font-size: 10px;
			padding: 0 10px;
		}
		.topnav {
			gap: 18px;
		}
		.topnav > a:not(.pill) {
			display: none;
		}
		.topnav__cta {
			height: 38px;
			padding: 0 18px;
			font-size: 15px;
		}
	}
</style>
