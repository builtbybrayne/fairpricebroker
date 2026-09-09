<script lang="ts">
	/**
	 * The tactile meter: one raised panel, one inset track. The outer pair
	 * are dials at the ends of the track and set the range; the inner pair
	 * are knobs that ride between them. Every figure is a field you can
	 * type into, so a dragged value is always exact when it matters.
	 *
	 * `mode`:
	 *  - 'entry'   — interactive.
	 *  - 'display' — the same picture, read-only, figures shown.
	 *  - 'sealed'  — a frosted plate: nothing of the values is rendered.
	 */
	import { onMount, type Snippet } from 'svelte';
	import {
		clamp,
		formatFigure,
		placeAnchor,
		placeKnob,
		quartiles,
		snapTo,
		toNumber,
		toRaw
	} from './meterMath';

	type Row = { key: string; label: string; help?: string };

	let {
		title,
		rows,
		values = $bindable<(string | null)[]>([null, null, null, null]),
		mode = 'sealed',
		accent = 'blue',
		sealed = mode === 'sealed',
		currency = '£',
		min = 0,
		max = 1000,
		step = 1,
		example = null,
		sealedNote = 'Hidden until the reveal',
		footer,
		error = null
	}: {
		title: string;
		rows: readonly Row[];
		values?: (string | null)[];
		mode?: 'sealed' | 'entry' | 'display';
		accent?: 'blue' | 'terracotta';
		sealed?: boolean;
		currency?: string;
		min?: number;
		max?: number;
		step?: number;
		/** Starting figures for an entry meter whose values are unset. */
		example?: readonly number[] | null;
		/** The line on the sealed plate. */
		sealedNote?: string;
		footer?: Snippet;
		error?: string | null;
	} = $props();

	const INSET = 0.12;
	const entry = $derived(mode === 'entry');
	const nums = $derived(values.map((v) => toNumber(v)));
	const complete = $derived(nums.every((n) => Number.isFinite(n)));
	const lo = $derived(nums[0]);
	const hi = $derived(nums[3]);

	// Seed an entry meter that arrives empty; a parent that seeds later wins.
	onMount(() => {
		if (entry && !complete) values = (example ?? quartiles(min, max, step)).map(toRaw);
	});

	/** 0..1 across the track; anchors at the ends, knobs inset between them. */
	const posOf = (i: number) => {
		if (!complete) return [0, 0.35, 0.65, 1][i];
		if (i === 0) return 0;
		if (i === 3) return 1;
		const local = (nums[i] - lo) / Math.max(hi - lo, Number.EPSILON);
		return INSET + clamp(local, 0, 1) * (1 - 2 * INSET);
	};
	const turnOf = (i: number) =>
		Number.isFinite(nums[i]) ? clamp((nums[i] - min) / (max - min), 0, 1) * 270 - 135 : -135;

	let touched = $state(0);
	const prompt = $derived(rows[touched]?.help ?? null);

	function commit(next: number[]) {
		values = next.map(toRaw);
	}
	function setKnob(i: 1 | 2, value: number) {
		if (!complete) return;
		commit(placeKnob(nums, i, value, step));
	}
	function setAnchor(i: 0 | 3, value: number) {
		if (!complete) return;
		commit(placeAnchor(nums, i, value, step, min, max));
	}
	function setPoint(i: number, value: number) {
		if (i === 0 || i === 3) setAnchor(i, value);
		else setKnob(i as 1 | 2, value);
	}

	// Pointer drags: knobs ride the track; dials turn with a vertical drag.
	let track = $state<HTMLElement | null>(null);
	function dragKnob(node: HTMLElement, i: 1 | 2) {
		const move = (e: PointerEvent) => {
			if (!track) return;
			const r = track.getBoundingClientRect();
			const local = ((e.clientX - r.left) / r.width - INSET) / (1 - 2 * INSET);
			setKnob(i, lo + clamp(local, 0, 1) * (hi - lo));
		};
		return bindDrag(node, move);
	}
	function dragDial(node: HTMLElement, i: 0 | 3) {
		let startY = 0;
		let startVal = 0;
		const move = (e: PointerEvent) => {
			setAnchor(i, startVal + ((startY - e.clientY) / 220) * (max - min));
		};
		return bindDrag(node, move, (e) => {
			startY = e.clientY;
			startVal = nums[i];
		});
	}
	function bindDrag(
		node: HTMLElement,
		onMove: (e: PointerEvent) => void,
		onStart?: (e: PointerEvent) => void
	) {
		const down = (e: PointerEvent) => {
			if (!entry) return;
			e.preventDefault();
			onStart?.(e);
			touched = Number(node.dataset.index);
			node.setPointerCapture(e.pointerId);
			node.classList.add('is-dragging');
			const up = () => {
				node.classList.remove('is-dragging');
				node.removeEventListener('pointermove', onMove);
				node.removeEventListener('pointerup', up);
				node.removeEventListener('pointercancel', up);
			};
			node.addEventListener('pointermove', onMove);
			node.addEventListener('pointerup', up);
			node.addEventListener('pointercancel', up);
		};
		node.addEventListener('pointerdown', down);
		return { destroy: () => node.removeEventListener('pointerdown', down) };
	}

	function nudge(i: number, e: KeyboardEvent) {
		if (!entry || !complete) return;
		const big = e.shiftKey ? 10 : 1;
		let d = 0;
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step * big;
		if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step * big;
		if (e.key === 'Home') d = -Infinity;
		if (e.key === 'End') d = Infinity;
		if (d === 0) return;
		e.preventDefault();
		setPoint(i, d === -Infinity ? min : d === Infinity ? max : nums[i] + d);
	}
	function wheel(i: number, e: WheelEvent) {
		if (!entry || !complete) return;
		e.preventDefault();
		setPoint(i, nums[i] - Math.sign(e.deltaY) * Math.max(step, snapTo((max - min) / 100, step)));
	}

	const id = `meter-${Math.random().toString(36).slice(2, 8)}`;
	const widthFor = (v: string | null) => `${Math.max(4, (v ?? '').length + 1)}ch`;
</script>

<section
	class="meter raised meter--{accent}"
	class:meter--entry={entry}
	class:meter--sealed={sealed}
	aria-label={title}
>
	<header class="meter__head">
		<h2 class="meter__title caps">{title}</h2>
		{#if sealed}
			<span class="meter__sealed inset caps">
				<svg viewBox="0 0 12 14" aria-hidden="true"
					><rect x="1" y="6" width="10" height="7" rx="1.6" fill="currentColor" /><path
						d="M3 6V4a3 3 0 0 1 6 0v2"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
					/></svg
				>
				Sealed
			</span>
		{/if}
	</header>

	{#if sealed}
		<!-- the plate: nothing of the figures reaches the page -->
		<div class="plate inset" data-meter-sealed>
			<svg class="plate__lock" viewBox="0 0 34 40" aria-hidden="true"
				><rect x="3" y="17" width="28" height="20" rx="4" fill="currentColor" /><path
					d="M9 17v-5a8 8 0 0 1 16 0v5"
					fill="none"
					stroke="currentColor"
					stroke-width="4"
				/></svg
			>
			<span class="plate__note">{sealedNote}</span>
		</div>
	{:else}
		<div class="stage" style:--inset={INSET}>
			<div class="track inset" bind:this={track}>
				{#if complete}
					<i
						class="track__band"
						style:left={`${posOf(1) * 100}%`}
						style:width={`${(posOf(2) - posOf(1)) * 100}%`}
					></i>
				{/if}
			</div>

			{#each rows as row, i (row.key)}
				{@const anchor = i === 0 || i === 3}
				<div
					class="pt"
					class:pt--anchor={anchor}
					class:pt--second={i === 2}
					class:pt--touched={entry && touched === i}
					style:--p={posOf(i)}
				>
					<span class="pt__figure">
						{#if entry}
							<span class="pt__currency" aria-hidden="true">{currency}</span>
							<input
								id={`${id}-${row.key}`}
								class="pt__input"
								type="text"
								inputmode="decimal"
								autocomplete="off"
								aria-label={`${row.label}, figure`}
								value={values[i] ?? ''}
								style:width={widthFor(values[i])}
								onfocus={() => (touched = i)}
								oninput={(e) => {
									const next = values.slice();
									next[i] = (e.currentTarget as HTMLInputElement).value.trim();
									values = next;
								}}
							/>
						{:else}
							<span class="pt__value">{formatFigure(values[i], currency)}</span>
						{/if}
					</span>

					{#if anchor}
						{#if entry}
							<button
								class="dial"
								type="button"
								role="slider"
								data-index={i}
								aria-label={row.label}
								aria-valuemin={i === 0 ? min : Number.isFinite(lo) ? lo : min}
								aria-valuemax={i === 3 ? max : Number.isFinite(hi) ? hi : max}
								aria-valuenow={Number.isFinite(nums[i]) ? nums[i] : undefined}
								aria-valuetext={formatFigure(values[i], currency)}
								style:--turn={`${turnOf(i)}deg`}
								use:dragDial={i as 0 | 3}
								onkeydown={(e) => nudge(i, e)}
								onwheel={(e) => wheel(i, e)}
								onfocus={() => (touched = i)}
							></button>
						{:else}
							<span class="dial dial--static" style:--turn={`${turnOf(i)}deg`} aria-hidden="true"
							></span>
						{/if}
					{:else if entry}
						<button
							class="knob"
							type="button"
							role="slider"
							data-index={i}
							aria-label={row.label}
							aria-valuemin={Number.isFinite(nums[i - 1]) ? nums[i - 1] : min}
							aria-valuemax={Number.isFinite(nums[i + 1]) ? nums[i + 1] : max}
							aria-valuenow={Number.isFinite(nums[i]) ? nums[i] : undefined}
							aria-valuetext={formatFigure(values[i], currency)}
							use:dragKnob={i as 1 | 2}
							onkeydown={(e) => nudge(i, e)}
							onwheel={(e) => wheel(i, e)}
							onfocus={() => (touched = i)}
						></button>
					{:else}
						<span class="knob knob--static" aria-hidden="true"></span>
					{/if}

					<span class="pt__label caps">{row.label}</span>
				</div>
			{/each}
		</div>

		{#if entry && prompt}
			<p class="meter__prompt" aria-live="polite">
				<strong>{rows[touched].label}.</strong>
				{prompt}
			</p>
		{:else if entry}
			<p class="meter__prompt">Drag the knobs, turn the dials, or tap a figure to type it.</p>
		{/if}
	{/if}

	{#if error}
		<p class="meter__error" role="alert">{error}</p>
	{/if}

	{#if footer}
		<footer class="meter__foot">{@render footer()}</footer>
	{/if}
</section>

<style>
	.meter {
		--thumb: var(--blue);
		--thumb-soft: rgba(92, 142, 200, 0.28);
		--pad: 44px;
		padding: calc(24 * var(--u, 1px)) calc(28 * var(--u, 1px)) calc(24 * var(--u, 1px));
		width: 100%;
		min-width: 0;
	}

	.meter--terracotta {
		--thumb: var(--terracotta);
		--thumb-soft: rgba(198, 121, 104, 0.3);
	}

	.meter__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: calc(18 * var(--u, 1px));
	}

	.meter__title {
		font-size: calc(20 * var(--u, 1px));
		color: var(--navy);
		line-height: 1;
	}

	.meter__sealed {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		letter-spacing: 0.16em;
		color: var(--slate);
		padding: 7px 12px;
		border-radius: var(--radius-pill);
	}

	.meter__sealed svg {
		width: 12px;
		height: 14px;
	}

	/* the sealed plate ---------------------------------------------------- */
	.plate {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 10px;
		min-height: 150px;
		border-radius: 16px;
		color: var(--slate);
		text-align: center;
		padding: 20px;
	}

	.plate__lock {
		width: 30px;
		height: 36px;
		color: var(--mist);
	}

	.plate__note {
		font-size: 15px;
		max-width: 28ch;
	}

	/* the stage ----------------------------------------------------------- */
	.stage {
		position: relative;
		height: 150px;
		margin: 6px 0 0;
	}

	.track {
		position: absolute;
		left: var(--pad);
		right: var(--pad);
		top: 64px;
		height: 12px;
		border-radius: 6px;
	}

	.track__band {
		position: absolute;
		top: 2px;
		bottom: 2px;
		border-radius: 4px;
		background: var(--thumb-soft);
	}

	.pt {
		position: absolute;
		top: 0;
		left: calc(var(--pad) + var(--p) * (100% - 2 * var(--pad)));
		transform: translateX(-50%);
		display: grid;
		justify-items: center;
		width: 0;
	}

	.pt__figure {
		position: absolute;
		top: 8px;
		display: inline-flex;
		align-items: baseline;
		gap: 1px;
		white-space: nowrap;
		font-weight: 600;
		font-size: 17px;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.pt__currency {
		color: var(--slate);
		font-weight: 500;
	}

	.pt__input {
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		text-align: center;
		font: inherit;
		color: inherit;
		padding: 0 0 1px;
		min-width: 4ch;
		border-radius: 0;
	}

	.pt--touched .pt__input {
		border-bottom-color: var(--hairline);
	}

	.pt__input:focus {
		outline: none;
		border-bottom-color: var(--gold);
	}

	.pt__label {
		position: absolute;
		top: 92px;
		font-size: 11px;
		letter-spacing: 0.14em;
		color: var(--slate);
		text-align: center;
		width: 88px;
		line-height: 1.25;
	}

	.pt--anchor .pt__label {
		top: 100px;
	}

	.pt--touched .pt__label {
		color: var(--navy);
	}

	/* handles ------------------------------------------------------------- */
	.knob,
	.dial {
		position: absolute;
		border: 0;
		padding: 0;
		background: var(--ground);
		border-radius: 50%;
		cursor: grab;
		touch-action: none;
	}

	.knob {
		top: 58px;
		width: 24px;
		height: 24px;
		box-shadow:
			3px 3px 8px var(--shade-deep),
			-3px -3px 8px var(--light),
			inset 0 0 0 6px var(--thumb);
	}

	.knob::after {
		/* a generous hit area for thumbs */
		content: '';
		position: absolute;
		inset: -12px;
	}

	.dial {
		top: 49px;
		width: 42px;
		height: 42px;
		cursor: ns-resize;
		box-shadow: var(--raise-sm);
	}

	.dial::before {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: 50%;
		background: repeating-conic-gradient(var(--mist) 0deg 2deg, transparent 2deg 12deg);
		-webkit-mask: radial-gradient(circle, transparent 60%, #000 62%);
		mask: radial-gradient(circle, transparent 60%, #000 62%);
		opacity: 0.8;
	}

	.dial::after {
		content: '';
		position: absolute;
		top: 6px;
		left: calc(50% - 1.5px);
		width: 3px;
		height: calc(50% - 6px);
		border-radius: 2px;
		background: var(--thumb);
		transform: rotate(var(--turn, -135deg));
		transform-origin: 50% 100%;
	}

	.knob:focus-visible,
	.dial:focus-visible {
		outline: 3px solid var(--gold);
		outline-offset: 3px;
	}

	.knob:global(.is-dragging),
	.dial:global(.is-dragging) {
		cursor: grabbing;
	}

	.knob--static,
	.dial--static {
		cursor: default;
	}

	.meter__prompt {
		margin: 14px 0 0;
		min-height: 2.6em;
		font-size: 15px;
		line-height: 1.35;
		color: var(--slate);
	}

	.meter__prompt strong {
		color: var(--navy);
		font-weight: 600;
	}

	.meter__error {
		margin-top: 12px;
		color: #8d2b3a;
		font-size: 15px;
	}

	.meter__foot {
		margin-top: 20px;
		padding-top: 18px;
		border-top: 1px solid var(--hairline);
	}

	@media (max-width: 640px) {
		.meter {
			--pad: 34px;
			padding: 20px 18px 20px;
		}
		.pt__figure {
			font-size: 15px;
		}
		.pt__label {
			width: 72px;
			font-size: 10px;
		}
		/* the two knobs can sit close: the second point's figure lifts and
		   its label drops, so neither runs into the first's */
		.pt--second .pt__label {
			top: 114px;
		}
		.pt--second .pt__figure {
			top: -16px;
		}
		.stage {
			height: 164px;
			margin-top: 22px;
		}
		.dial {
			width: 36px;
			height: 36px;
			top: 52px;
		}
	}
</style>
