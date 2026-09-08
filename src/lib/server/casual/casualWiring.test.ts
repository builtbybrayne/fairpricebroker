// T3-m1-casual-mode §6 Stage 2 — V16 / V16b against the REAL
// completeCasualPlay (data-core's advisory-locked transaction), through
// the actual route handler (V16) and the shared capability (V16b).
// Requires the local Supabase stack and a populated .env (loaded by
// tests/helpers/db), exactly like src/lib/server/data/attribution.test.ts.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import golden from '$lib/server/engine/fixtures/golden.json';
import { closeAllDb } from '$lib/server/data/db';
import { mintRefCode } from '$lib/server/data/events';
import { REF_CODE_REGEX } from '$lib/server/refCodes';
import { POST } from '../../../routes/api/casual/reconcile/+server';
import { admin, closeAdmin } from '../../../../tests/helpers/db';
import { dbCasualPlayCompleter } from './casualCompletionSeam';
import { handleCasualReconcile, type RawTuple } from './casualReconcile';

const fixture = golden.fixtures.find((f) => f.id === 'comfort-zone')!;
const A: RawTuple = fixture.input.lowPreferrer.map(String) as unknown as RawTuple;
const B: RawTuple = fixture.input.highPreferrer.map(String) as unknown as RawTuple;

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

async function persisted(key: string) {
	const [r] = await admin()<
		{ events: number; refs: number; share_ref: string | null; ref_code: string | null }[]
	>`
		select
			(select count(*)::int from events where idempotency_key = ${key}::uuid) as events,
			(select count(*)::int from share_refs where ref_code = (
				select payload ->> 'share_ref' from events where idempotency_key = ${key}::uuid limit 1)) as refs,
			(select payload ->> 'share_ref' from events where idempotency_key = ${key}::uuid limit 1) as share_ref,
			(select payload ->> 'ref_code' from events where idempotency_key = ${key}::uuid limit 1) as ref_code
	`;
	return r;
}

function post(body: unknown): { request: Request } {
	return {
		request: new Request('http://localhost/api/casual/reconcile', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

describe('Stage-2 wiring: route -> real completeCasualPlay', () => {
	it('V16: response lost after commit; retry with the same key returns the identical shareRef, 1 event + 1 share_refs row', async () => {
		const inbound = mintRefCode();
		await admin()`insert into share_refs (ref_code) values (${inbound})`;
		const idempotencyKey = randomUUID();
		const body = { partyATuple: A, partyBTuple: B, ref: inbound, idempotencyKey };

		// First call: the seam commits, but the client "never observes" the
		// response — we deliberately do not read it.
		const lost = await POST(post(body) as Parameters<typeof POST>[0]);
		expect(lost.status).toBe(200);
		const committed = await persisted(idempotencyKey);
		expect(committed.events).toBe(1);

		// Retry with the SAME key.
		const retry = await POST(post(body) as Parameters<typeof POST>[0]);
		expect(retry.status).toBe(200);
		const json = await retry.json();
		expect(json.ok).toBe(true);
		expect(json.shareRef).toMatch(REF_CODE_REGEX);
		expect(json.shareRef).toBe(committed.share_ref);
		expect(json.shareRef).not.toBe(inbound);
		expect(Object.keys(json.result)).toHaveLength(11);
		expect('layers' in json.result).toBe(false);

		const after = await persisted(idempotencyKey);
		expect(after).toEqual({ events: 1, refs: 1, share_ref: json.shareRef, ref_code: inbound });
	});

	it('V16b: two concurrent calls with the same key resolve to the same shareRef (the persisted share_ref, never the inbound ref_code)', async () => {
		const inbound = mintRefCode();
		await admin()`insert into share_refs (ref_code) values (${inbound})`;
		const idempotencyKey = randomUUID();
		const req = { partyATuple: A, partyBTuple: B, ref: inbound, idempotencyKey };

		const [x, y] = await Promise.all([
			handleCasualReconcile(req, { completer: dbCasualPlayCompleter }),
			handleCasualReconcile(req, { completer: dbCasualPlayCompleter })
		]);
		expect(x.ok && y.ok).toBe(true);
		if (!x.ok || !y.ok) return;
		expect(x.shareRef).toBe(y.shareRef);
		expect(x.shareRef).not.toBe(inbound);

		const row = await persisted(idempotencyKey);
		expect(row).toEqual({ events: 1, refs: 1, share_ref: x.shareRef, ref_code: inbound });
	});
});
