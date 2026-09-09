// T3-m1-recruitment-demo §1 / §2: client helpers for the walkthrough —
// demo identity, best-effort progressive submission, the stage-4
// reconciliation call, and the small numeric helpers the meter and the
// reveal need. Validation mirrors the engine's grammar for responsiveness
// only; the server stays the authority.
import type { DemoAnswerValue, DemoStage } from '$lib/server/demo/demoAnswers';
import type { DemoReconcileResponse } from '$lib/server/demo/demoReconcile';

export type RawTuple = readonly [string, string, string, string];

export const REF_CODE_REGEX = /^[a-z2-7]{10}$/;

/** Only a well-formed ref is carried; anything else would 400 the whole stage. */
export function usableRef(ref: string | null | undefined): string | null {
	return typeof ref === 'string' && REF_CODE_REGEX.test(ref) ? ref : null;
}

export function mintUuid(): string {
	return crypto.randomUUID();
}

const DECIMAL_GRAMMAR = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;

export interface TupleValidation {
	readonly ok: boolean;
	readonly message: string | null;
}

/** Four plain unsigned decimals, all positive, strictly ascending. */
export function validateSalaryTuple(values: readonly (string | null)[]): TupleValidation {
	if (values.length !== 4) return { ok: false, message: 'All four figures are needed.' };
	const nums: number[] = [];
	for (let i = 0; i < 4; i += 1) {
		const v = (values[i] ?? '').trim();
		if (v === '') return { ok: false, message: 'All four figures are needed.' };
		if (!DECIMAL_GRAMMAR.test(v)) {
			return { ok: false, message: 'Salaries are plain numbers, like 45000.' };
		}
		const n = Number(v);
		if (!(n > 0)) return { ok: false, message: 'Every figure must be more than zero.' };
		nums.push(n);
	}
	for (let i = 1; i < 4; i += 1) {
		if (!(nums[i] > nums[i - 1])) {
			return { ok: false, message: 'Each figure should be higher than the one above it.' };
		}
	}
	return { ok: true, message: null };
}

export function asRawTuple(values: readonly (string | null)[]): RawTuple {
	return [values[0] ?? '', values[1] ?? '', values[2] ?? '', values[3] ?? ''].map((v) =>
		v.trim()
	) as unknown as RawTuple;
}

/** A pleasant axis around a set of salaries: rounded bounds, ~6 ticks. */
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

/** A salary as an outcome: whole pounds at a thousand or more, else 2 d.p. */
export function formatSalary(n: number, currency = '£'): string {
	if (!Number.isFinite(n)) return `${currency}—`;
	const dp = Math.abs(n) >= 1000 || Number.isInteger(n) ? 0 : 2;
	return `${currency}${n.toLocaleString('en-GB', {
		minimumFractionDigits: dp,
		maximumFractionDigits: dp
	})}`;
}

export interface StageSubmission {
	readonly demoId: string;
	readonly stage: DemoStage;
	readonly answers: Readonly<Record<string, DemoAnswerValue>>;
	readonly comment: string | null;
	readonly ref: string | null;
	readonly idempotencyKey: string;
}

export interface Transport {
	fetch: typeof fetch;
}

/**
 * POST one stage's answers. Best effort: a failure is retried once,
 * silently; a second failure is reported but never blocks the walkthrough.
 */
export async function submitStage(
	body: StageSubmission,
	transport: Transport = { fetch: globalThis.fetch }
): Promise<boolean> {
	const attempt = async () => {
		const res = await transport.fetch('/api/demo/answer', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		return res.ok;
	};
	try {
		if (await attempt()) return true;
	} catch {
		/* fall through to the single retry */
	}
	try {
		return await attempt();
	} catch {
		return false;
	}
}

export type ReconcileOutcome =
	| DemoReconcileResponse
	| { readonly ok: false; readonly error: { readonly kind: 'transport'; readonly detail: string } };

export async function reconcileDemo(
	budgetTuple: RawTuple,
	candidateTuple: RawTuple,
	transport: Transport = { fetch: globalThis.fetch }
): Promise<ReconcileOutcome> {
	try {
		const res = await transport.fetch('/api/demo/reconcile', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ budgetTuple, candidateTuple })
		});
		return (await res.json()) as DemoReconcileResponse;
	} catch (e) {
		return { ok: false, error: { kind: 'transport', detail: String(e) } };
	}
}

/** Plain-language recovery for an engine rejection on the candidate's meter. */
export function engineErrorMessage(kind: string): string {
	switch (kind) {
		case 'not-ascending':
			return 'Each figure should be higher than the one above it.';
		case 'non-positive':
			return 'Every figure must be more than zero.';
		case 'malformed-decimal':
			return 'Salaries are plain numbers, like 45000.';
		case 'out-of-magnitude-domain':
			return 'Those figures are outside the range the instrument can work with.';
		case 'transport':
			return 'The instrument could not be reached. Check your connection and try again.';
		default:
			return 'The instrument could not work with those figures. Please check them and try again.';
	}
}
