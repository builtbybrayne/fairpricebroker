<script lang="ts">
	/**
	 * The tactile meter: a raised neumorphic panel holding the four
	 * Van Westendorp price points as inset sliders.
	 *
	 * `mode`:
	 *  - 'sealed'  — display-only; figures blurred, thumbs at their positions.
	 *  - 'entry'   — interactive; each row is a range input + a numeric field.
	 *  - 'display' — display-only with the figures shown.
	 */
	import type { Snippet } from 'svelte';

	type Row = { key: string; label: string; help?: string };

	let {
		title,
		rows,
		values = $bindable<(string | null)[]>([null, null, null, null]),
		mode = 'sealed',
		accent = 'blue',
		sealed = mode !== 'entry',
		currency = '£',
		min = 0,
		max = 1000,
		step = 1,
		footer,
		error = null,
		labelWidth = 190
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
		footer?: Snippet;
		error?: string | null;
		/** Width of the label column in design px (scaled by --u). */
		labelWidth?: number;
	} = $props();

	const positionFor = (v: string | null, i: number) => {
		// Unset rows: the thumb sits at zero in entry mode (number-first: the
		// picture never claims a value the field does not hold); sealed demo
		// panels use illustrative positions because they show no figures.
		if (v === null || v === '' || Number.isNaN(Number(v)))
			return mode === 'entry' ? 0 : 0.18 + i * 0.2;
		return Math.max(0, Math.min(1, (Number(v) - min) / (max - min)));
	};

	const formatFigure = (v: string | null) => {
		if (v === null || v === '' || Number.isNaN(Number(v))) return '—';
		const n = Number(v);
		const dp = Math.max(2, Math.min(4, (v.split('.')[1] ?? '').length));
		return `${currency}${n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
	};
</script>

<section
	class="meter raised meter--{accent}"
	class:meter--entry={mode === 'entry'}
	aria-label={title}
	style:--label-w={`calc(${labelWidth} * var(--u, 1px))`}
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

	<ol class="meter__rows">
		{#each rows as row, i (row.key)}
			<li class="row">
				{#if mode === 'entry'}
					<label class="row__label" for={`${title}-${row.key}`}
						>{row.label}{#if row.help}<small class="row__help">{row.help}</small>{/if}</label
					>
					<div class="row__track inset">
						<input
							class="row__range"
							type="range"
							{min}
							{max}
							{step}
							value={values[i] === null || values[i] === ''
								? min + (max - min) * positionFor(null, i)
								: Number(values[i])}
							oninput={(e) => (values[i] = (e.currentTarget as HTMLInputElement).value)}
							aria-label={`${row.label}, slider`}
						/>
						<i
							class="row__thumb"
							style:left={`${positionFor(values[i], i) * 100}%`}
							aria-hidden="true"
						></i>
					</div>
					<span class="row__figure row__figure--input">
						<span class="row__currency">{currency}</span>
						<input
							id={`${title}-${row.key}`}
							class="row__number"
							type="text"
							inputmode="decimal"
							pattern="[0-9]*[.]?[0-9]*"
							placeholder="0.00"
							value={values[i] ?? ''}
							oninput={(e) => (values[i] = (e.currentTarget as HTMLInputElement).value.trim())}
						/>
					</span>
				{:else}
					<span class="row__label"
						>{row.label}{#if row.help}<small class="row__help">{row.help}</small>{/if}</span
					>
					<div class="row__track inset" aria-hidden="true">
						<i class="row__thumb" style:left={`${positionFor(values[i], i) * 100}%`}></i>
					</div>
					<span class="row__figure" class:row__figure--blurred={mode === 'sealed'}>
						{#if mode === 'sealed'}
							<span aria-hidden="true">{currency}•••••</span>
							<span class="sr-only">hidden until the reveal</span>
						{:else}
							{formatFigure(values[i])}
						{/if}
					</span>
				{/if}
			</li>
		{/each}
	</ol>

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
		--thumb-ring: rgba(61, 90, 128, 0.35);
		--groove-fill: rgba(92, 142, 200, 0.25);
		padding: calc(27 * var(--u, 1px)) calc(33 * var(--u, 1px)) calc(28 * var(--u, 1px));
		width: 100%;
	}

	.meter--terracotta {
		--thumb: var(--terracotta);
		--thumb-ring: rgba(183, 105, 82, 0.35);
		--groove-fill: rgba(198, 121, 104, 0.25);
	}

	.meter__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: calc(22 * var(--u, 1px));
	}

	.meter__title {
		font-size: calc(22 * var(--u, 1px));
		color: var(--navy);
		line-height: 1;
	}

	.meter__sealed {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: calc(13 * var(--u, 1px));
		letter-spacing: 0.16em;
		color: var(--slate);
		padding: calc(7 * var(--u, 1px)) calc(12 * var(--u, 1px));
		border-radius: var(--radius-pill);
	}

	.meter__sealed svg {
		width: 12px;
		height: 14px;
	}

	.meter__rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: calc(22 * var(--u, 1px));
	}

	.row {
		display: grid;
		grid-template-columns: var(--label-w) 1fr calc(92 * var(--u, 1px));
		align-items: center;
		gap: calc(22 * var(--u, 1px));
	}

	.row__label {
		font-size: calc(18 * var(--u, 1px));
		color: var(--ink);
		line-height: 1.2;
	}

	.row__help {
		display: block;
		font-size: 0.8em;
		color: var(--slate);
		margin-top: 2px;
	}

	.row__track {
		position: relative;
		height: calc(12 * var(--u, 1px));
		border-radius: 6px;
	}

	.row__thumb {
		position: absolute;
		top: 50%;
		width: calc(24 * var(--u, 1px));
		height: calc(24 * var(--u, 1px));
		border-radius: 50%;
		background: var(--ground);
		transform: translate(-50%, -50%);
		box-shadow:
			3px 3px 8px var(--shade-deep),
			-3px -3px 8px var(--light),
			inset 0 0 0 6px var(--thumb);
		pointer-events: none;
	}

	.row__figure {
		font-size: calc(18 * var(--u, 1px));
		font-weight: 600;
		color: var(--ink);
		text-align: right;
		white-space: nowrap;
	}

	.row__figure--blurred {
		color: var(--mist);
		letter-spacing: 0.08em;
		filter: blur(1.2px);
	}

	/* entry mode ---------------------------------------------------------- */
	.row__range {
		position: absolute;
		inset: -12px 0;
		width: 100%;
		height: 36px;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.row__range:focus-visible + .row__thumb {
		outline: 3px solid var(--gold);
		outline-offset: 3px;
	}

	.row__figure--input {
		display: inline-flex;
		align-items: baseline;
		gap: 2px;
		justify-content: flex-end;
	}

	.row__currency {
		color: var(--slate);
		font-weight: 500;
	}

	.row__number {
		width: 78px;
		border: 0;
		border-bottom: 2px solid var(--hairline);
		background: transparent;
		text-align: right;
		font-size: 18px;
		font-weight: 600;
		color: var(--ink);
		padding: 2px 0;
		font-variant-numeric: tabular-nums;
	}

	.row__number:focus {
		outline: none;
		border-bottom-color: var(--gold);
	}

	.meter__error {
		margin-top: 16px;
		color: #8d2b3a;
		font-size: 15px;
	}

	.meter__foot {
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid var(--hairline);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 640px) {
		.meter {
			padding: 20px 20px 22px;
		}
		.row {
			grid-template-columns: 1fr 84px;
			grid-template-areas:
				'label figure'
				'track track';
			row-gap: 10px;
			column-gap: 12px;
		}
		.row__label {
			grid-area: label;
			font-size: 16px;
		}
		.row__figure {
			grid-area: figure;
		}
		.row__help {
			display: block;
			font-size: 0.8em;
			color: var(--slate);
			margin-top: 2px;
		}

		.row__track {
			grid-area: track;
		}
	}
</style>
