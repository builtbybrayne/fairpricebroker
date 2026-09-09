// T3-m1-recruitment-demo §2 / §3: recordDemoStage — one demo stage's
// answers as a demo-flagged, reconciliation-less `events` row under the
// `casual_writer` role. Same transactional shape as data-core's
// completeCasualPlay (advisory lock on the key, replay read, savepointed
// insert, conflict re-read) so a retried POST never adds a row.
//
// Stage 5 writes BOTH a `demo_stage_answered` row and a `demo_completed`
// row in the one transaction (§4 V1: five stage rows plus one completion).
// The idempotency index is per (key, event_type) — see the
// demo_answer_idempotency migration.
import { isRefCode, type RefCode } from '$lib/server/refCodes';
import { roleDb } from '$lib/server/data/db';
import { SALARY_NEGOTIATION_ID } from '$lib/templates/salaryNegotiation';

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEMO_STAGES = [1, 2, 3, 4, 5] as const;
export type DemoStage = (typeof DEMO_STAGES)[number];
export const DEMO_FINAL_STAGE: DemoStage = 5;

export type DemoAnswerValue = string | number | boolean | null;

export interface DemoStageInput {
	/** Client-minted UUID v4 carried through every stage of one walkthrough. */
	readonly demoId: string;
	readonly stage: DemoStage;
	readonly answers: Readonly<Record<string, DemoAnswerValue>>;
	readonly comment: string | null;
	/** Inbound attribution ref, validated at the HTTP boundary. */
	readonly ref: RefCode | null;
	/** Client-minted UUID v4, one per stage submit. */
	readonly idempotencyKey: string;
}

export interface DemoStageRecord {
	/** `inserted` on first write, `replayed` when the key had already landed. */
	readonly outcome: 'inserted' | 'replayed';
}

/** The seam the route factory takes, so tests can inject a fake. */
export interface DemoStageWriter {
	recordDemoStage(input: DemoStageInput): Promise<DemoStageRecord>;
}

export function isDemoStage(x: unknown): x is DemoStage {
	return typeof x === 'number' && (DEMO_STAGES as readonly number[]).includes(x);
}

export function isDemoAnswerValue(x: unknown): x is DemoAnswerValue {
	return x === null || ['string', 'number', 'boolean'].includes(typeof x);
}

export function isAnswersRecord(x: unknown): x is Record<string, DemoAnswerValue> {
	if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
	return Object.values(x).every(isDemoAnswerValue);
}

function isUniqueViolation(e: unknown): boolean {
	return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
}

/** T2-data-layer §7 R5 envelope: demo-flagged so nothing downstream counts it. */
export function demoStagePayload(input: DemoStageInput) {
	return {
		demo: true as const,
		vertical: SALARY_NEGOTIATION_ID,
		demo_id: input.demoId,
		stage: input.stage,
		answers: input.answers,
		comment: input.comment,
		ref_code: input.ref
	};
}

export function eventTypesForStage(stage: DemoStage): readonly string[] {
	return stage === DEMO_FINAL_STAGE
		? ['demo_stage_answered', 'demo_completed']
		: ['demo_stage_answered'];
}

function validate(input: DemoStageInput): void {
	if (!UUID_V4.test(input.demoId)) throw new Error('demoId must be a UUID v4');
	if (!isDemoStage(input.stage)) throw new Error('stage must be an integer 1..5');
	if (!isAnswersRecord(input.answers)) {
		throw new Error('answers must be a record of string | number | boolean | null');
	}
	if (input.comment !== null && typeof input.comment !== 'string') {
		throw new Error('comment must be a string or null');
	}
	if (input.ref !== null && !isRefCode(input.ref)) throw new Error('invalid-ref');
	if (!UUID_V4.test(input.idempotencyKey)) throw new Error('idempotencyKey must be a UUID v4');
}

export async function recordDemoStage(input: DemoStageInput): Promise<DemoStageRecord> {
	validate(input);
	const types = eventTypesForStage(input.stage);
	const payload = demoStagePayload(input);
	const sql = roleDb('casual_writer');
	return sql.begin(async (tx) => {
		await tx`select pg_advisory_xact_lock(hashtextextended(${input.idempotencyKey}::text, 0))`;
		const replay = async () =>
			tx<{ n: number }[]>`
				select count(*)::int as n from events
				where idempotency_key = ${input.idempotencyKey}::uuid
					and reconciliation_id is null and event_type in ${tx(types)}
			`;
		const existing = await replay();
		if (existing[0].n > 0) return { outcome: 'replayed' as const };
		try {
			await tx.savepoint(async (sp) => {
				for (const eventType of types) {
					await sp`
						insert into events (reconciliation_id, event_type, payload, idempotency_key)
						values (null, ${eventType}, ${sp.json(payload)}, ${input.idempotencyKey}::uuid)
					`;
				}
			});
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
			const winner = await replay();
			if (winner[0].n === 0) throw e;
			return { outcome: 'replayed' as const };
		}
		return { outcome: 'inserted' as const };
	});
}

/** The real, DB-backed writer the route wires by default. */
export const dbDemoStageWriter: DemoStageWriter = { recordDemoStage };
