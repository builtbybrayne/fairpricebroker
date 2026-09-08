// Client-side helpers for the casual flow (T3-m1-casual-mode §3, §7).
// The validation here mirrors the engine's grammar for UX responsiveness
// only — the server remains the sole authority (§4).

export type RawTuple = readonly [string, string, string, string];

export type CasualState =
	| 'idle'
	| 'party-a-entry'
	| 'a-confirm-hide'
	| 'handover'
	| 'party-b-entry'
	| 'both-look-now'
	| 'transport-error'
	| 'reveal';

const DECIMAL_GRAMMAR = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

export interface TupleValidation {
	readonly ok: boolean;
	readonly message: string | null;
}

/** Four plain unsigned decimals, all positive, strictly ascending. */
export function validateTuple(values: readonly (string | null)[]): TupleValidation {
	if (values.length !== 4) return { ok: false, message: 'All four prices are needed.' };
	const nums: number[] = [];
	for (let i = 0; i < 4; i += 1) {
		const v = (values[i] ?? '').trim();
		if (v === '') return { ok: false, message: 'All four prices are needed.' };
		if (!DECIMAL_GRAMMAR.test(v)) {
			return { ok: false, message: 'Prices are plain numbers, like 420 or 420.50.' };
		}
		const n = Number(v);
		if (!(n > 0)) return { ok: false, message: 'Every price must be more than zero.' };
		nums.push(n);
	}
	for (let i = 1; i < 4; i += 1) {
		if (!(nums[i] > nums[i - 1])) {
			return { ok: false, message: 'Each price should be higher than the one above it.' };
		}
	}
	return { ok: true, message: null };
}

export function asRawTuple(values: readonly (string | null)[]): RawTuple {
	return [values[0] ?? '', values[1] ?? '', values[2] ?? '', values[3] ?? ''].map((v) =>
		v.trim()
	) as unknown as RawTuple;
}

export function mintIdempotencyKey(): string {
	return crypto.randomUUID();
}

/** A pleasant axis around a set of prices: rounded bounds, ~6 ticks. */
export function niceAxis(values: readonly number[]): { min: number; max: number; step: number } {
	const lo = Math.min(...values);
	const hi = Math.max(...values);
	const span = Math.max(hi - lo, 1);
	const pad = span * 0.15;
	const rawStep = (span + 2 * pad) / 6;
	const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? mag * 10;
	const min = Math.floor((lo - pad) / step) * step;
	const max = Math.ceil((hi + pad) / step) * step;
	return { min: Math.max(0, min), max, step };
}

/** Display rounding is a presentation transform (T2-product-surfaces §2.8):
 *  default 2 d.p.; pass `exact` to keep every entered decimal (up to 4). */
export function formatMoney(decimal: string, currency = '£', exact = false): string {
	const n = Number(decimal);
	if (!Number.isFinite(n)) return `${currency}${decimal}`;
	const frac = (decimal.split('.')[1] ?? '').length;
	const dp = exact ? Math.max(2, Math.min(4, frac)) : 2;
	return `${currency}${n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}
