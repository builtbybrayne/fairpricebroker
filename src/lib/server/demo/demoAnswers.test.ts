// T3-m1-recruitment-demo §4 V1–V3 at the server layer, against the REAL
// local Supabase stack (populated .env, loaded by tests/helpers/db):
//   V1  five demo_stage_answered rows + one demo_completed per demo_id;
//       activation_events count unchanged; demo_answers view returns them
//   V2  abandon after stage 2: exactly two rows
//   V3  replaying a stage with the same key adds no row
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closeAllDb } from '$lib/server/data/db';
import { mintRefCode } from '$lib/server/data/events';
import { admin, closeAdmin } from '../../../../tests/helpers/db';
import { recordDemoStage, type DemoStage, type DemoStageInput } from './demoAnswers';
import { POST } from '../../../routes/api/demo/answer/+server';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

interface Row {
	event_type: string;
	stage: number;
	answers: Record<string, unknown>;
	comment: string | null;
	ref_code: string | null;
	reconciliation_id: string | null;
	demo: boolean;
	vertical: string;
}

async function rowsFor(demoId: string): Promise<Row[]> {
	return admin()<Row[]>`
		select event_type, (payload ->> 'stage')::int as stage, payload -> 'answers' as answers,
		       payload ->> 'comment' as comment, payload ->> 'ref_code' as ref_code, reconciliation_id,
		       (payload ->> 'demo')::boolean as demo, payload ->> 'vertical' as vertical
		from events where payload ->> 'demo_id' = ${demoId}
		order by (payload ->> 'stage')::int, event_type
	`;
}

async function activationCount(): Promise<number> {
	const [r] = await admin()<{ n: number }[]>`select count(*)::int as n from activation_events`;
	return r.n;
}

function stageInput(demoId: string, stage: DemoStage, extra: Partial<DemoStageInput> = {}) {
	return {
		demoId,
		stage,
		answers: { q1: `answer ${stage}`, likert: stage, yes: stage % 2 === 0 },
		comment: stage === 3 ? null : `comment ${stage}`,
		ref: null,
		idempotencyKey: randomUUID(),
		...extra
	} satisfies DemoStageInput;
}

/**
 * The local `postgres` login is not a superuser and holds no membership in
 * the nologin `scorecard_reader` role, so the grant is asserted directly
 * and the view read as the migration owner (it is owner-executed anyway).
 */
async function scorecardReaderCanSelectView(): Promise<boolean> {
	const [r] = await admin()<{ ok: boolean }[]>`
		select has_table_privilege('scorecard_reader', 'demo_answers', 'select') as ok
	`;
	return r.ok;
}

async function readView(demoId: string) {
	return admin()<
		{
			demo_id: string;
			stage: number;
			event_type: string;
			answers: unknown;
			comment: string | null;
			ref_code: string | null;
		}[]
	>`
		select demo_id, stage, event_type, answers, comment, ref_code from demo_answers
		where demo_id = ${demoId}::uuid order by stage, event_type
	`;
}

describe('recordDemoStage (real casual_writer transaction)', () => {
	it('V1: a full walkthrough lands 5 stage rows + 1 demo_completed, demo-flagged, reconciliation-less, invisible to activation', async () => {
		const before = await activationCount();
		const demoId = randomUUID();
		const inbound = mintRefCode();
		await admin()`insert into share_refs (ref_code) values (${inbound})`;

		for (const stage of [1, 2, 3, 4, 5] as const) {
			const out = await recordDemoStage(stageInput(demoId, stage, { ref: inbound }));
			expect(out.outcome).toBe('inserted');
		}

		const rows = await rowsFor(demoId);
		expect(rows).toHaveLength(6);
		expect(rows.filter((r) => r.event_type === 'demo_stage_answered').map((r) => r.stage)).toEqual([
			1, 2, 3, 4, 5
		]);
		const completed = rows.filter((r) => r.event_type === 'demo_completed');
		expect(completed).toHaveLength(1);
		expect(completed[0].stage).toBe(5);
		for (const r of rows) {
			expect(r.reconciliation_id).toBeNull();
			expect(r.demo).toBe(true);
			expect(r.vertical).toBe('salary-negotiation');
			expect(r.ref_code).toBe(inbound);
		}
		expect(rows[2].comment).toBeNull(); // stage 3 sent a null comment
		expect(rows[0].answers).toEqual({ q1: 'answer 1', likert: 1, yes: false });

		// Other test files write real activation rows concurrently, so assert on
		// THIS demo's rows rather than a global count: none of them may surface
		// in activation_events.
		const [leaked] = await admin()<{ n: number }[]>`
			select count(*)::int as n from activation_events
			where id in (select id from events where payload ->> 'demo_id' = ${demoId})
		`;
		expect(leaked.n).toBe(0);
		expect(await activationCount()).toBeGreaterThanOrEqual(before);

		expect(await scorecardReaderCanSelectView()).toBe(true);
		const view = await readView(demoId);
		expect(view).toHaveLength(6);
		expect(view.map((v) => [v.stage, v.event_type])).toEqual([
			[1, 'demo_stage_answered'],
			[2, 'demo_stage_answered'],
			[3, 'demo_stage_answered'],
			[4, 'demo_stage_answered'],
			[5, 'demo_completed'],
			[5, 'demo_stage_answered']
		]);
		expect(view[0].demo_id).toBe(demoId);
		expect(view[0].answers).toEqual({ q1: 'answer 1', likert: 1, yes: false });
		expect(view[0].ref_code).toBe(inbound);
	});

	it('V2: abandoning after stage 2 leaves exactly two rows', async () => {
		const demoId = randomUUID();
		await recordDemoStage(stageInput(demoId, 1));
		await recordDemoStage(stageInput(demoId, 2));
		const rows = await rowsFor(demoId);
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.event_type === 'demo_stage_answered')).toBe(true);
	});

	it('V3: replaying a stage with the same idempotency key adds no row (function and route)', async () => {
		const demoId = randomUUID();
		const first = stageInput(demoId, 1);
		expect((await recordDemoStage(first)).outcome).toBe('inserted');
		expect((await recordDemoStage(first)).outcome).toBe('replayed');
		expect(await rowsFor(demoId)).toHaveLength(1);

		// Stage 5 replay: neither of its two rows is duplicated.
		const last = stageInput(demoId, 5);
		await recordDemoStage(last);
		await recordDemoStage(last);
		expect(await rowsFor(demoId)).toHaveLength(3);

		// Through the real route with the real writer.
		const body = stageInput(demoId, 2);
		const post = () =>
			POST({
				request: new Request('http://localhost/api/demo/answer', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(body)
				})
			} as Parameters<typeof POST>[0]);
		expect((await post()).status).toBe(200);
		const retry = await post();
		expect(retry.status).toBe(200);
		expect(await retry.json()).toEqual({ ok: true });
		expect(await rowsFor(demoId)).toHaveLength(4);
	});

	it('rejects malformed input before touching the database', async () => {
		const demoId = randomUUID();
		await expect(
			recordDemoStage(stageInput(demoId, 1, { idempotencyKey: 'nope' }))
		).rejects.toThrow('idempotencyKey');
		await expect(
			recordDemoStage({ ...stageInput(demoId, 1), stage: 6 as DemoStage })
		).rejects.toThrow('stage');
		await expect(
			recordDemoStage(stageInput(demoId, 1, { answers: { nested: { a: 1 } } as never }))
		).rejects.toThrow('answers');
		expect(await rowsFor(demoId)).toHaveLength(0);
	});
});
