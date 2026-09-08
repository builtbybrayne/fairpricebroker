<script lang="ts">
	/**
	 * The shareable card (T3-m1-casual-mode §7): zone and fair price only —
	 * never a raw figure, regardless of the reveal's "show the numbers"
	 * state, because this is what leaves the device. Carries the freshly
	 * minted share ref so the loop is measurable (T1 §2.7).
	 */
	import { page } from '$app/state';
	import type { Zone } from '$lib/server/engine/types';

	let { zone, fair, shareRef }: { zone: Zone; fair: string; shareRef: string } = $props();

	const shareUrl = $derived(`${page.url.origin}/?ref=${shareRef}`);
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 2200);
		} catch {
			copied = false;
		}
	}

	const zoneText = $derived(
		zone === 'comfort'
			? 'Comfortably in range'
			: zone === 'deal'
				? 'A deal, with a stretch'
				: 'No overlap yet'
	);
</script>

<aside class="card raised" aria-label="Share this result">
	<div class="card__body">
		<p class="card__fair">{zoneText}. Fair price <strong data-card-fair>{fair}</strong></p>
		<p class="card__note">
			Two people, four prices each, one fair number. Nobody saw the other side's figures.
		</p>
	</div>
	<div class="card__share">
		<label class="card__label" for="share-url"
			>Share the instrument <code class="card__ref" data-share-ref>{shareRef}</code></label
		>
		<div class="card__row">
			<input
				id="share-url"
				class="card__url inset"
				type="text"
				readonly
				value={shareUrl}
				data-share-url
			/>
			<button class="pill pill--navy card__copy" type="button" onclick={copy}>
				{copied ? 'Copied' : 'Copy link'}
			</button>
		</div>
	</div>
</aside>

<style>
	.card {
		display: grid;
		grid-template-columns: 1.2fr 1fr;
		gap: 28px;
		padding: 26px 30px;
		align-items: center;
	}

	.card__fair {
		font-size: 22px;
		color: var(--ink);
	}

	.card__fair strong {
		font-family: var(--font-display);
		font-size: 30px;
		color: var(--navy);
		margin-left: 8px;
	}

	.card__note {
		margin-top: 8px;
		color: var(--slate);
		font-size: 15px;
	}

	.card__label {
		display: block;
		font-size: 14px;
		font-weight: 600;
		color: var(--slate);
		margin-bottom: 8px;
	}

	.card__ref {
		margin-left: 10px;
		font-family: var(--font-body);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.12em;
		color: var(--navy);
		background: var(--ground);
		box-shadow: var(--inset-sm);
		padding: 2px 8px;
		border-radius: 6px;
	}

	.card__row {
		display: flex;
		gap: 10px;
	}

	.card__url {
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: 12px;
		padding: 12px 14px;
		font-size: 14px;
		color: var(--ink);
	}

	.card__copy {
		height: 44px;
		padding: 0 18px;
		font-size: 15px;
	}

	@media (max-width: 760px) {
		.card {
			grid-template-columns: 1fr;
			padding: 20px;
		}
	}
</style>
