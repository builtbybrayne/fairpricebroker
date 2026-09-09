<script lang="ts">
	/**
	 * One side of the casual instrument: a live meter with a "Seal and hide"
	 * action. Once sealed, the meter is replaced by its frosted plate and
	 * none of the figures reach the page until the reveal.
	 */
	import MeterPanel from '$lib/client/meter/MeterPanel.svelte';
	import type { CasualSide } from '$lib/casual/casualTemplate';
	import { validateTuple } from './casualClient';

	let {
		side,
		partyLabel,
		accent,
		values = $bindable<(string | null)[]>([null, null, null, null]),
		sealed = false,
		sealedNote = 'Sealed. Hand the phone over.',
		currency = '£',
		min = 0,
		max = 1000,
		step = 1,
		onseal
	}: {
		side: CasualSide;
		partyLabel: 'A' | 'B';
		accent: 'blue' | 'terracotta';
		values?: (string | null)[];
		sealed?: boolean;
		sealedNote?: string;
		currency?: string;
		min?: number;
		max?: number;
		step?: number;
		onseal: () => void;
	} = $props();

	const rows = $derived(side.points.map((p) => ({ key: p.key, label: p.label, help: p.prompt })));

	let attempted = $state(false);
	const validation = $derived(validateTuple(values));
	const error = $derived(attempted && !validation.ok ? validation.message : null);

	function submit(e: Event) {
		e.preventDefault();
		attempted = true;
		if (validation.ok) onseal();
	}
</script>

<form
	class="entry"
	onsubmit={submit}
	data-state-screen="party-entry"
	data-party={partyLabel}
	data-sealed={sealed ? '' : undefined}
>
	{#if sealed}
		<MeterPanel title={side.title} {rows} mode="sealed" {accent} {sealedNote} />
	{:else}
		<MeterPanel
			title={side.title}
			{rows}
			bind:values
			mode="entry"
			{accent}
			{currency}
			{min}
			{max}
			{step}
			example={side.example}
			{error}
		>
			{#snippet footer()}
				<div class="entry__foot">
					<button class="pill pill--gold entry__submit" type="submit">
						Seal and hide
						<svg viewBox="0 0 24 24" aria-hidden="true"
							><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" /><path
								d="M8 11V8a4 4 0 0 1 8 0v3"
								fill="none"
								stroke="currentColor"
								stroke-width="2.4"
							/></svg
						>
					</button>
					<span class="entry__hint">Only you can see these until the reveal.</span>
				</div>
			{/snippet}
		</MeterPanel>
	{/if}
</form>

<style>
	.entry {
		min-width: 0;
	}

	.entry__foot {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
	}

	.entry__submit {
		height: 50px;
		padding: 0 24px;
		font-size: 18px;
	}

	.entry__submit svg {
		width: 20px;
		height: 20px;
	}

	.entry__hint {
		font-size: 14px;
		color: var(--slate);
	}
</style>
