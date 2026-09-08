<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#eef1f6" />
</svelte:head>

<header class="topbar">
	<a class="wordmark" href={resolve('/')} aria-label="fair price broker, home">
		<svg class="wordmark__mark" viewBox="0 0 36 36" aria-hidden="true">
			<circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" stroke-width="4.5" />
			<circle cx="18" cy="18" r="5" fill="#e8b34b" />
		</svg>
		<span>fair price broker</span>
	</a>
	<nav class="topnav" aria-label="Primary">
		<a href={resolve('/method')}>Method</a>
		<a href={resolve('/recruitment')}>For recruiters</a>
		<a class="pill pill--navy topnav__cta" href={resolve('/signin')}>Start free</a>
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
	}

	.wordmark__mark {
		width: calc(36 * var(--u));
		height: calc(36 * var(--u));
	}

	.topnav {
		display: flex;
		align-items: center;
		gap: calc(46 * var(--u));
	}

	.topnav a:not(.pill) {
		color: var(--slate);
		text-decoration: none;
		font-weight: 500;
		font-size: calc(18 * var(--u));
	}

	.topnav a:not(.pill):hover {
		color: var(--navy);
	}

	.topnav__cta {
		height: calc(46 * var(--u));
		padding: 0 calc(30 * var(--u));
		font-size: calc(19 * var(--u));
		text-decoration: none;
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
		.topnav {
			gap: 18px;
		}
		.topnav a:not(.pill) {
			display: none;
		}
		.topnav__cta {
			height: 38px;
			padding: 0 18px;
			font-size: 15px;
		}
	}
</style>
