// Presentation helpers for the offer surfaces. Pure, client-safe.
// Precision rule (T2-product-surfaces §2.8): entries are shown with the
// precision they were entered at (2–4 d.p.); rounding is a presentation
// transform, never applied to stored values.
import type { OverlapLevel } from '$lib/templates/salaryNegotiation';

export const CURRENCY_SYMBOL: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };

export const CURRENCIES = ['GBP', 'USD', 'EUR'] as const;

export function symbolFor(currency: string): string {
	return CURRENCY_SYMBOL[currency] ?? `${currency} `;
}

/** Decimal places carried by a decimal string, clamped to [min, max]. */
function decimalsOf(v: string, min: number, max: number): number {
	const frac = v.split('.')[1] ?? '';
	return Math.max(min, Math.min(max, frac.length));
}

/**
 * Formats a decimal string as money, keeping every entered decimal up to
 * four places (a 4-d.p. entry displays at 4 d.p.). A whole figure of a
 * thousand or more (a salary) shows no pennies; smaller ones show two.
 */
export function formatMoney(v: string | number | null | undefined, currency = 'GBP'): string {
	if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
	const s = String(v);
	const whole = !s.includes('.') && Math.abs(Number(s)) >= 1000;
	const dp = whole ? 0 : decimalsOf(s, 2, 4);
	return `${symbolFor(currency)}${Number(s).toLocaleString('en-GB', {
		minimumFractionDigits: dp,
		maximumFractionDigits: dp
	})}`;
}

/**
 * The fair figure as an outcome: whole pounds for salaries (a thousand or
 * more), two places below that. The unrounded value stays in the payload.
 */
export function formatFair(v: string | number, currency = 'GBP'): string {
	const n = Number(v);
	const dp = Math.abs(n) >= 1000 ? 0 : 2;
	return `${symbolFor(currency)}${n.toLocaleString('en-GB', {
		minimumFractionDigits: dp,
		maximumFractionDigits: dp
	})}`;
}

export const OVERLAP_LABEL: Record<OverlapLevel, string> = {
	'in-range': 'In range',
	stretch: 'A stretch',
	'no-overlap': 'No overlap'
};

export interface Axis {
	min: number;
	max: number;
	step: number;
}

/** A tidy axis around the given values, with roughly `ticks` divisions. */
export function niceAxis(values: readonly number[], ticks = 5): Axis {
	const finite = values.filter((v) => Number.isFinite(v));
	if (finite.length === 0) return { min: 0, max: 100, step: 20 };
	let lo = Math.min(...finite);
	let hi = Math.max(...finite);
	if (hi === lo) {
		lo = lo * 0.9;
		hi = hi * 1.1 || 10;
	}
	const pad = (hi - lo) * 0.12;
	lo -= pad;
	hi += pad;
	const raw = (hi - lo) / ticks;
	const mag = Math.pow(10, Math.floor(Math.log10(raw)));
	const norm = raw / mag;
	const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
	const step = nice * mag;
	return {
		min: Math.max(0, Math.floor(lo / step) * step),
		max: Math.ceil(hi / step) * step,
		step
	};
}

/**
 * Rounds a range to a tenth of the axis step: the drawn bar does not move
 * visibly, but the shared canvas's spoken label then carries an
 * approximation rather than the entered figures, which stay behind the
 * "show the numbers" toggle.
 */
export function quantiseRange(
	r: { lo: number; hi: number },
	axis: Axis
): { lo: number; hi: number } {
	const q = axis.step / 10;
	return { lo: Math.round(r.lo / q) * q, hi: Math.round(r.hi / q) * q };
}

export type Tuple = readonly [string, string, string, string];

export function tupleRange(t: Tuple): { lo: number; hi: number } {
	return { lo: Number(t[0]), hi: Number(t[3]) };
}

/** The intersection of two full ranges, or null when they do not meet. */
export function rangeOverlap(
	a: { lo: number; hi: number },
	b: { lo: number; hi: number }
): { lo: number; hi: number } | null {
	const lo = Math.max(a.lo, b.lo);
	const hi = Math.min(a.hi, b.hi);
	return lo < hi ? { lo, hi } : null;
}

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

export const STATE_LABEL: Record<string, string> = {
	open: 'Open',
	locked: 'Working it out',
	closed: 'Result ready',
	cancelled: 'Cancelled'
};
