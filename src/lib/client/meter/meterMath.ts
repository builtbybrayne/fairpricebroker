// Pure helpers for the single-track meter: ordering, snapping, seeding and
// figure formatting. No DOM, so they are unit-tested directly.

export const DECIMAL_GRAMMAR = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

/** A finite number for a raw figure, or NaN when the field is unset/unparseable. */
export function toNumber(v: string | null | undefined): number {
	if (v === null || v === undefined) return NaN;
	const t = v.trim();
	if (!DECIMAL_GRAMMAR.test(t)) return NaN;
	return Number(t);
}

export function snapTo(n: number, step: number): number {
	if (!(step > 0)) return n;
	const snapped = Math.round(n / step) * step;
	// keep the decimals of the step (avoids 0.30000000000000004)
	const dp = (String(step).split('.')[1] ?? '').length;
	return Number(snapped.toFixed(dp));
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Four evenly spread starting points across the visible range. */
export function quartiles(
	min: number,
	max: number,
	step: number
): [number, number, number, number] {
	const span = max - min;
	return [0.2, 0.4, 0.6, 0.8].map((f) => snapTo(min + span * f, step)) as [
		number,
		number,
		number,
		number
	];
}

/**
 * An inner knob (index 1 or 2) dragged to `value`: it stays strictly between
 * its neighbours, one step clear of each. Neighbours never move.
 */
export function placeKnob(
	nums: readonly number[],
	i: 1 | 2,
	value: number,
	step: number
): number[] {
	const next = nums.slice();
	const lo = nums[i - 1] + step;
	const hi = nums[i + 1] - step;
	next[i] = hi < lo ? nums[i] : clamp(snapTo(value, step), lo, hi);
	return next;
}

/**
 * An anchor (index 0 or 3) moved to `value`: it stays inside [min, max] and
 * the knobs keep their values unless the anchor comes inside them, in which
 * case they give way one step at a time (the exfu ruling of 2026-09-07).
 */
export function placeAnchor(
	nums: readonly number[],
	i: 0 | 3,
	value: number,
	step: number,
	min: number,
	max: number
): number[] {
	const v = clamp(snapTo(value, step), min, max);
	if (i === 0) {
		const lo = Math.min(v, max - 3 * step);
		const k1 = Math.max(nums[1], lo + step);
		const k2 = Math.max(nums[2], k1 + step);
		const hi = Math.max(nums[3], k2 + step);
		return [lo, k1, k2, hi];
	}
	const hi = Math.max(v, min + 3 * step);
	const k2 = Math.min(nums[2], hi - step);
	const k1 = Math.min(nums[1], k2 - step);
	const lo = Math.min(nums[0], k1 - step);
	return [lo, k1, k2, hi];
}

/** Strictly ascending, all finite and positive. */
export function isOrdered(nums: readonly number[]): boolean {
	return (
		nums.length === 4 &&
		nums.every((n) => Number.isFinite(n) && n > 0) &&
		nums.every((n, i) => i === 0 || n > nums[i - 1])
	);
}

/**
 * 2 d.p. by default, up to 4 when the raw figure carries them; whole
 * figures of a thousand or more (salaries, rates) drop the pennies.
 */
export function formatFigure(v: string | null, currency = '£'): string {
	const n = toNumber(v);
	if (!Number.isFinite(n)) return '—';
	const frac = ((v ?? '').split('.')[1] ?? '').length;
	const dp = frac === 0 && n >= 1000 ? 0 : Math.max(2, Math.min(4, frac));
	return `${currency}${n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

/** The figure a number becomes when the meter writes it back as a string. */
export function toRaw(n: number): string {
	return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}
