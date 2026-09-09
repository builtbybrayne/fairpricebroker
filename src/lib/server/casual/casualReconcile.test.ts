// T3-m1-casual-mode §8: V1, V1b, V2 (handler) and V3, V10a–d, V11 (route
// adapter, driven by constructing the handler with a spy completer and
// calling it with a Request — no dev server).
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CASUAL_TEMPLATE_ID } from '$lib/casual/casualTemplate';
import golden from '$lib/server/engine/fixtures/golden.json';
import { reconcile } from '$lib/server/engine';
import type { VWTuple } from '$lib/server/engine/types';
import { REF_CODE_REGEX, type RefCode } from '$lib/server/refCodes';
import {
	createInMemoryCasualPlayCompleter,
	type CasualPlayCompleter
} from './casualCompletionSeam';
import { buildCasualResultPayload } from './casualPayload';
import { handleCasualReconcile, type RawTuple } from './casualReconcile';
import { createCasualReconcileHandler, INVALID_REF_BODY } from './casualRoute';

const fixture = golden.fixtures.find((f) => f.id === 'comfort-zone')!;
const BUYER: RawTuple = fixture.input.lowPreferrer.map(String) as unknown as RawTuple;
const SELLER: RawTuple = fixture.input.highPreferrer.map(String) as unknown as RawTuple;
const NOT_ASCENDING: RawTuple = ['100', '90', '110', '120'];
const VALID_REF = 'abcdefg234' as RefCode;

/** A stand-in wrapped in a spy so call counts and args are observable. */
function spyCompleter() {
	const inner = createInMemoryCasualPlayCompleter();
	const completeCasualPlay = vi.fn(inner.completeCasualPlay);
	const completer: CasualPlayCompleter = { completeCasualPlay };
	return { completer, completeCasualPlay };
}

function post(body: unknown): Request {
	return new Request('http://localhost/api/casual/reconcile', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

describe('handleCasualReconcile', () => {
	it('V1: golden pair -> ok, allowlisted payload, seam called once with template/ref/key', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const idempotencyKey = randomUUID();
		const res = await handleCasualReconcile(
			{ buyerTuple: BUYER, sellerTuple: SELLER, ref: VALID_REF, idempotencyKey },
			{ completer }
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const expected = reconcile(
			{ tuple: BUYER as unknown as VWTuple, direction: 'low-preferring' },
			{ tuple: SELLER as unknown as VWTuple, direction: 'high-preferring' }
		);
		if (!expected.ok) throw new Error('fixture must reconcile');
		expect(res.result).toEqual(buildCasualResultPayload(expected.result));
		expect('layers' in res.result).toBe(false);
		expect(res.shareRef).toMatch(REF_CODE_REGEX);
		expect(completeCasualPlay).toHaveBeenCalledTimes(1);
		expect(completeCasualPlay).toHaveBeenCalledWith({
			ref: VALID_REF,
			templateId: CASUAL_TEMPLATE_ID,
			idempotencyKey
		});
	});

	it('V1b: replaying the same idempotencyKey returns the identical shareRef', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const req = { buyerTuple: BUYER, sellerTuple: SELLER, ref: null, idempotencyKey: randomUUID() };
		const first = await handleCasualReconcile(req, { completer });
		const second = await handleCasualReconcile(req, { completer });
		expect(first.ok && second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(second.shareRef).toBe(first.shareRef);
		expect(completeCasualPlay).toHaveBeenCalledTimes(2);
	});

	it('V2: engine rejection -> ok:false with the engine kind; seam never called', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const res = await handleCasualReconcile(
			{ buyerTuple: NOT_ASCENDING, sellerTuple: SELLER, ref: null, idempotencyKey: randomUUID() },
			{ completer }
		);
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(res.error.kind).toBe('not-ascending');
		expect(completeCasualPlay).not.toHaveBeenCalled();
	});
});

describe('POST /api/casual/reconcile (adapter)', () => {
	it('V3: engine-level rejection is HTTP 200 with { ok:false, error }', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const POST = createCasualReconcileHandler({ completer });
		const res = await POST({
			request: post({
				buyerTuple: NOT_ASCENDING,
				sellerTuple: SELLER,
				idempotencyKey: randomUUID()
			})
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.ok).toBe(false);
		expect(body.error.kind).toBe('not-ascending');
		expect(completeCasualPlay).not.toHaveBeenCalled();
	});

	it('V10a: malformed ref string -> 400 { error:"invalid-ref" }, zero seam calls', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const POST = createCasualReconcileHandler({ completer });
		const res = await POST({
			request: post({
				buyerTuple: BUYER,
				sellerTuple: SELLER,
				ref: 'abc123',
				idempotencyKey: randomUUID()
			})
		});
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual(INVALID_REF_BODY);
		expect(completeCasualPlay).not.toHaveBeenCalled();
	});

	it('V10b: ref smuggling tuple-shaped data -> 400 { error:"invalid-ref" }, zero seam calls', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const POST = createCasualReconcileHandler({ completer });
		for (const ref of [['80', '95', '110', '125'], { tuple: BUYER }]) {
			const res = await POST({
				request: post({ buyerTuple: BUYER, sellerTuple: SELLER, ref, idempotencyKey: randomUUID() })
			});
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual(INVALID_REF_BODY);
		}
		expect(completeCasualPlay).not.toHaveBeenCalled();
	});

	it('V10c: omitted or explicit-null ref proceeds; seam called once with ref:null', async () => {
		for (const body of [
			{ buyerTuple: BUYER, sellerTuple: SELLER, idempotencyKey: randomUUID() },
			{ buyerTuple: BUYER, sellerTuple: SELLER, ref: null, idempotencyKey: randomUUID() }
		]) {
			const { completer, completeCasualPlay } = spyCompleter();
			const POST = createCasualReconcileHandler({ completer });
			const res = await POST({ request: post(body) });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.ok).toBe(true);
			expect(json.shareRef).toMatch(REF_CODE_REGEX);
			expect(completeCasualPlay).toHaveBeenCalledTimes(1);
			expect(completeCasualPlay.mock.calls[0][0].ref).toBeNull();
		}
	});

	it('V10d: valid ref + wrong-length tuple -> 400 ordinary EngineError body, not invalid-ref', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const POST = createCasualReconcileHandler({ completer });
		const res = await POST({
			request: post({
				buyerTuple: ['80', '95', '110'],
				sellerTuple: SELLER,
				ref: VALID_REF,
				idempotencyKey: randomUUID()
			})
		});
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).not.toEqual(INVALID_REF_BODY);
		expect(body.ok).toBe(false);
		expect(body.error.kind).toBe('malformed-decimal');
		expect(typeof body.error.detail).toBe('string');
		expect(completeCasualPlay).not.toHaveBeenCalled();
	});

	it('V11: malformed JSON, wrong-length tuple, non-string element, bad key -> 400 EngineError-shaped', async () => {
		const { completer, completeCasualPlay } = spyCompleter();
		const POST = createCasualReconcileHandler({ completer });
		const cases: unknown[] = [
			'{not json',
			{
				buyerTuple: BUYER,
				sellerTuple: ['70', '90', '105', '120', '130'],
				idempotencyKey: randomUUID()
			},
			{ buyerTuple: BUYER, sellerTuple: ['70', 90, '105', '120'], idempotencyKey: randomUUID() },
			{ buyerTuple: BUYER, sellerTuple: SELLER, idempotencyKey: 'not-a-uuid' },
			{ buyerTuple: BUYER, sellerTuple: SELLER }
		];
		for (const c of cases) {
			const res = await POST({ request: post(c) });
			expect(res.status, JSON.stringify(c)).toBe(400);
			const body = await res.json();
			expect(body.ok).toBe(false);
			expect(body.error.kind).toBe('malformed-decimal');
			expect(typeof body.error.detail).toBe('string');
		}
		expect(completeCasualPlay).not.toHaveBeenCalled();
	});
});
