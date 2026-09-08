<script lang="ts">
	/**
	 * The pass-the-device screens of the casual choreography
	 * (T2-product-surfaces §6 R5). One raised card, one sentence of
	 * instruction, one action. Never echoes any entered figure.
	 */
	import type { Snippet } from 'svelte';

	let {
		screen,
		title,
		body,
		action = null,
		onaction = () => {},
		busy = false,
		accent = 'blue',
		children
	}: {
		screen: string;
		title: string;
		body: string;
		action?: string | null;
		onaction?: () => void;
		busy?: boolean;
		accent?: 'blue' | 'terracotta' | 'gold';
		children?: Snippet;
	} = $props();
</script>

<section class="stage raised stage--{accent}" data-state-screen={screen} aria-live="polite">
	<div class="stage__mark" aria-hidden="true">
		{#if screen === 'a-confirm-hide'}
			<svg viewBox="0 0 48 48"
				><rect x="10" y="22" width="28" height="20" rx="4" fill="currentColor" /><path
					d="M16 22v-6a8 8 0 0 1 16 0v6"
					fill="none"
					stroke="currentColor"
					stroke-width="4"
				/></svg
			>
		{:else if screen === 'handover'}
			<svg viewBox="0 0 48 48"
				><rect
					x="14"
					y="4"
					width="20"
					height="40"
					rx="4"
					fill="none"
					stroke="currentColor"
					stroke-width="3.5"
				/><path
					d="M4 24h6m28 0h6M8 20l-4 4 4 4m32-8 4 4-4 4"
					fill="none"
					stroke="currentColor"
					stroke-width="3.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		{:else if screen === 'both-look-now'}
			<svg viewBox="0 0 48 48"
				><path
					d="M4 24c5-9 12-14 20-14s15 5 20 14c-5 9-12 14-20 14S9 33 4 24Z"
					fill="none"
					stroke="currentColor"
					stroke-width="3.5"
				/><circle cx="24" cy="24" r="6" fill="currentColor" /></svg
			>
		{:else}
			<svg viewBox="0 0 48 48"
				><circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="3.5" /><path
					d="M24 14v12m0 6v2"
					stroke="currentColor"
					stroke-width="4"
					stroke-linecap="round"
				/></svg
			>
		{/if}
	</div>
	<h2 class="stage__title">{title}</h2>
	<p class="stage__body">{body}</p>
	{#if children}
		<div class="stage__extra">{@render children()}</div>
	{/if}
	{#if action}
		<button class="pill pill--navy stage__action" type="button" onclick={onaction} disabled={busy}>
			{#if busy}
				<span class="stage__spinner" aria-hidden="true"></span>
			{/if}
			{action}
		</button>
	{/if}
</section>

<style>
	.stage {
		--stage-accent: var(--blue);
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 14px;
		padding: 44px 32px 40px;
		max-width: 620px;
		margin: 0 auto;
	}

	.stage--terracotta {
		--stage-accent: var(--terracotta);
	}

	.stage--gold {
		--stage-accent: var(--gold);
	}

	.stage__mark {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: var(--stage-accent);
		box-shadow: var(--inset-sm);
		margin-bottom: 6px;
	}

	.stage__mark svg {
		width: 40px;
		height: 40px;
	}

	.stage__title {
		font-size: 30px;
		line-height: 1.1;
	}

	.stage__body {
		font-size: 18px;
		line-height: 1.5;
		color: var(--slate);
		max-width: 44ch;
	}

	.stage__extra {
		width: 100%;
	}

	.stage__action {
		margin-top: 10px;
		height: 54px;
		padding: 0 30px;
		font-size: 19px;
	}

	.stage__action:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.stage__spinner {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 3px solid rgba(255, 255, 255, 0.35);
		border-top-color: #fff;
		animation: spin 800ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 640px) {
		.stage {
			padding: 32px 20px 30px;
		}
		.stage__title {
			font-size: 24px;
		}
		.stage__body {
			font-size: 16px;
		}
	}
</style>
