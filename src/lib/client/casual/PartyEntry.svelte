<script lang="ts">
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import { validateTuple } from './casualClient';

	let {
		title,
		partyLabel,
		accent,
		rows,
		values = $bindable<(string | null)[]>([null, null, null, null]),
		submitLabel = 'Seal my meter',
		intro = null,
		onsubmit
	}: {
		title: string;
		partyLabel: string;
		accent: 'blue' | 'terracotta';
		rows: readonly { key: string; label: string }[];
		values?: (string | null)[];
		submitLabel?: string;
		intro?: string | null;
		onsubmit: () => void;
	} = $props();

	let attempted = $state(false);
	const validation = $derived(validateTuple(values));
	const error = $derived(attempted && !validation.ok ? validation.message : null);

	function submit(e: Event) {
		e.preventDefault();
		attempted = true;
		if (validation.ok) onsubmit();
	}

	const max = $derived.by(() => {
		const nums = values.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
		const top = nums.length ? Math.max(...nums) : 0;
		return Math.max(1000, Math.ceil((top * 1.25) / 100) * 100);
	});
</script>

<form class="entry" onsubmit={submit} data-state-screen="party-entry" data-party={partyLabel}>
	{#if intro}
		<p class="entry__intro">{intro}</p>
	{/if}
	<MeterPanel {title} {rows} bind:values mode="entry" {accent} min={0} {max} step={1} {error}>
		{#snippet footer()}
			<div class="entry__foot">
				<button class="pill pill--gold entry__submit" type="submit">
					{submitLabel}
					<svg viewBox="0 0 24 24" aria-hidden="true"
						><path
							d="M5 12h13M13 6l6 6-6 6"
							fill="none"
							stroke="currentColor"
							stroke-width="2.6"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
				</button>
				<span class="entry__hint">Only you can see these until the reveal.</span>
			</div>
		{/snippet}
	</MeterPanel>
</form>

<style>
	.entry__intro {
		margin: 0 0 18px;
		font-size: 19px;
		color: var(--slate);
		max-width: 60ch;
	}

	.entry__foot {
		display: flex;
		align-items: center;
		gap: 18px;
		flex-wrap: wrap;
	}

	.entry__submit {
		height: 54px;
		padding: 0 28px;
		font-size: 20px;
	}

	.entry__submit svg {
		width: 22px;
		height: 22px;
	}

	.entry__hint {
		font-size: 15px;
		color: var(--slate);
	}
</style>
