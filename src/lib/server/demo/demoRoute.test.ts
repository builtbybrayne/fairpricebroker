// T3-m1-recruitment-demo §3: the two adapters' transport policy with a
// fake writer (no database).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import golden from '$lib/server/engine/fixtures/golden.json';
import type { DemoStageInput, DemoStageWriter } from './demoAnswers';
import { createDemoAnswerHandler, createDemoReconcileHandler } from './demoRoute';

function req(path: string, body: unknown, raw = false): { request: Request } {
	return {
		request: new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: raw ? (body as string) : JSON.stringify(body)
		})
	};
}

function fakeWriter() {
	const calls: DemoStageInput[] = [];
	const writer: DemoStageWriter = {
		async recordDemoStage(input) {
			calls.push(input);
			return { outcome: 'inserted' };
		}
	};
	return { writer, calls };
}

const valid = () => ({
	demoId: randomUUID(),
	stage: 3,
	answers: { convincing: 4, honest: true, why: 'seems fair' },
	comment: 'a note',
	idempotencyKey: randomUUID()
});

describe('POST /api/demo/answer', () => {
	it('records a well-formed stage and returns { ok:true }', async () => {
		const { writer, calls } = fakeWriter();
		const body = valid();
		const res = await createDemoAnswerHandler({ writer })(req('/api/demo/answer', body));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual({ ...body, ref: null });
	});

	it('omitted comment defaults to null; a valid ref passes through', async () => {
		const { writer, calls } = fakeWriter();
		const { comment: _comment, ...body } = valid();
		void _comment;
		const res = await createDemoAnswerHandler({ writer })(
			req('/api/demo/answer', { ...body, ref: 'abcdefghij' })
		);
		expect(res.status).toBe(200);
		expect(calls[0].comment).toBeNull();
		expect(calls[0].ref).toBe('abcdefghij');
	});

	it('400s structurally bad bodies without calling the writer', async () => {
		const { writer, calls } = fakeWriter();
		const h = createDemoAnswerHandler({ writer });
		const bad: unknown[] = [
			[],
			{ ...valid(), demoId: 'x' },
			{ ...valid(), stage: 0 },
			{ ...valid(), stage: '3' },
			{ ...valid(), answers: [1] },
			{ ...valid(), answers: { a: { nested: true } } },
			{ ...valid(), comment: 7 },
			{ ...valid(), idempotencyKey: 'x' }
		];
		for (const b of bad) {
			const res = await h(req('/api/demo/answer', b));
			expect(res.status).toBe(400);
			const j = await res.json();
			expect(j.ok).toBe(false);
			expect(j.error.kind).toBe('malformed-request');
		}
		const notJson = await h(req('/api/demo/answer', '{nope', true));
		expect(notJson.status).toBe(400);
		expect(calls).toHaveLength(0);
	});

	it('400s a malformed ref with the flat invalid-ref body', async () => {
		const { writer, calls } = fakeWriter();
		const res = await createDemoAnswerHandler({ writer })(
			req('/api/demo/answer', { ...valid(), ref: 'NOT-A-REF' })
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: 'invalid-ref' });
		expect(calls).toHaveLength(0);
	});
});

describe('POST /api/demo/reconcile', () => {
	const f = golden.fixtures.find((x) => x.id === 'deal-only')!;
	const budgetTuple = f.input.lowPreferrer.map(String);
	const candidateTuple = f.input.highPreferrer.map(String);

	it('200s with the view and guidance on acceptance', async () => {
		const res = await createDemoReconcileHandler()(
			req('/api/demo/reconcile', { budgetTuple, candidateTuple })
		);
		expect(res.status).toBe(200);
		const j = await res.json();
		expect(j.ok).toBe(true);
		expect(j.view.zone).toBe('deal');
		expect(j.view.guidance.overlap).toBe('stretch');
		expect(j.view.guidance.nonRemunerationInPlay).toBe(true);
		expect(j.view.budgetTuple).toEqual(budgetTuple);
	});

	it('200s with ok:false on an engine rejection', async () => {
		const res = await createDemoReconcileHandler()(
			req('/api/demo/reconcile', { budgetTuple: ['1', 'x', '3', '4'], candidateTuple })
		);
		expect(res.status).toBe(200);
		const j = await res.json();
		expect(j.ok).toBe(false);
		expect(j.error.kind).toBe('malformed-decimal');
	});

	it('400s structurally bad bodies', async () => {
		const h = createDemoReconcileHandler();
		for (const b of [null, { budgetTuple }, { budgetTuple: ['1', '2', '3'], candidateTuple }]) {
			const res = await h(req('/api/demo/reconcile', b));
			expect(res.status).toBe(400);
		}
	});
});
