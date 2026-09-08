// T3-m1-recruitment-demo §3: the two thin same-origin adapters, factored
// (as casualRoute.ts is) so tests construct them with a fake writer while
// the `+server.ts` files wire the real one.
//
// /api/demo/answer
//   parse / structural failure          -> 400 { ok:false, error:{ kind:'malformed-request', detail } }
//   ref present but fails isRefCode     -> 400 { error:'invalid-ref' }   (flat, as casual)
//   recorded (first write or replay)    -> 200 { ok:true }
//
// /api/demo/reconcile
//   parse / structural failure          -> 400 { ok:false, error:{ kind:'malformed-decimal', detail } }
//   engine rejection                    -> 200 { ok:false, error }
//   engine acceptance                   -> 200 { ok:true, view }
//
// Both are declared rate-limit class `compute` for the catalogue, as in
// the casual brief.
import { json } from '@sveltejs/kit';
import { isRefCode, type RefCode } from '$lib/server/refCodes';
import {
	isAnswersRecord,
	isDemoStage,
	UUID_V4,
	type DemoStageInput,
	type DemoStageWriter
} from './demoAnswers';
import { runDemoReconciliation, type DemoRawTuple } from './demoReconcile';

export const DEMO_ANSWER_CAPABILITY = {
	name: 'demo.answer',
	authTier: 'none',
	sessionTypes: ['demo'],
	invokingRole: 'visitor',
	payloadClass: 'none',
	rateLimitClass: 'compute'
} as const;

export const DEMO_RECONCILE_CAPABILITY = {
	name: 'demo.reconcile',
	authTier: 'none',
	sessionTypes: ['demo'],
	invokingRole: 'visitor',
	payloadClass: 'host-full',
	rateLimitClass: 'compute'
} as const;

export const INVALID_REF_BODY = { error: 'invalid-ref' } as const;

function malformed(kind: 'malformed-request' | 'malformed-decimal', detail: string): Response {
	return json({ ok: false, error: { kind, detail } }, { status: 400 });
}

function isRawTuple(x: unknown): x is DemoRawTuple {
	return Array.isArray(x) && x.length === 4 && x.every((v) => typeof v === 'string');
}

function asObject(body: unknown): Record<string, unknown> | null {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
	return body as Record<string, unknown>;
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
	try {
		return { ok: true, body: await request.json() };
	} catch {
		return { ok: false };
	}
}

type ParsedAnswer =
	| { kind: 'ok'; input: DemoStageInput }
	| { kind: 'invalid-ref' }
	| { kind: 'structural'; detail: string };

export function parseAnswerBody(body: unknown): ParsedAnswer {
	const b = asObject(body);
	if (!b) return { kind: 'structural', detail: 'request body must be a JSON object' };

	// Ref: omitted or null is the legitimate no-attribution path.
	let ref: RefCode | null = null;
	if (b.ref !== undefined && b.ref !== null) {
		if (!isRefCode(b.ref)) return { kind: 'invalid-ref' };
		ref = b.ref;
	}

	if (typeof b.demoId !== 'string' || !UUID_V4.test(b.demoId)) {
		return { kind: 'structural', detail: 'demoId must be a UUID v4' };
	}
	if (!isDemoStage(b.stage)) {
		return { kind: 'structural', detail: 'stage must be an integer 1..5' };
	}
	if (!isAnswersRecord(b.answers)) {
		return {
			kind: 'structural',
			detail: 'answers must be an object of string | number | boolean | null values'
		};
	}
	const comment = b.comment === undefined ? null : b.comment;
	if (comment !== null && typeof comment !== 'string') {
		return { kind: 'structural', detail: 'comment must be a string or null' };
	}
	if (typeof b.idempotencyKey !== 'string' || !UUID_V4.test(b.idempotencyKey)) {
		return { kind: 'structural', detail: 'idempotencyKey must be a UUID v4' };
	}

	return {
		kind: 'ok',
		input: {
			demoId: b.demoId,
			stage: b.stage,
			answers: b.answers,
			comment,
			ref,
			idempotencyKey: b.idempotencyKey
		}
	};
}

export function createDemoAnswerHandler(deps: { readonly writer: DemoStageWriter }) {
	return async ({ request }: { request: Request }): Promise<Response> => {
		const read = await readJson(request);
		if (!read.ok) return malformed('malformed-request', 'request body is not valid JSON');
		const parsed = parseAnswerBody(read.body);
		if (parsed.kind === 'invalid-ref') return json(INVALID_REF_BODY, { status: 400 });
		if (parsed.kind === 'structural') return malformed('malformed-request', parsed.detail);
		// A replay is a success: the row is there, which is all the client needs.
		await deps.writer.recordDemoStage(parsed.input);
		return json({ ok: true }, { status: 200 });
	};
}

type ParsedReconcile =
	| { kind: 'ok'; budgetTuple: DemoRawTuple; candidateTuple: DemoRawTuple }
	| { kind: 'structural'; detail: string };

export function parseReconcileBody(body: unknown): ParsedReconcile {
	const b = asObject(body);
	if (!b) return { kind: 'structural', detail: 'request body must be a JSON object' };
	if (!isRawTuple(b.budgetTuple)) {
		return { kind: 'structural', detail: 'budgetTuple must be an array of exactly 4 strings' };
	}
	if (!isRawTuple(b.candidateTuple)) {
		return { kind: 'structural', detail: 'candidateTuple must be an array of exactly 4 strings' };
	}
	return { kind: 'ok', budgetTuple: b.budgetTuple, candidateTuple: b.candidateTuple };
}

export function createDemoReconcileHandler() {
	return async ({ request }: { request: Request }): Promise<Response> => {
		const read = await readJson(request);
		if (!read.ok) return malformed('malformed-decimal', 'request body is not valid JSON');
		const parsed = parseReconcileBody(read.body);
		if (parsed.kind === 'structural') return malformed('malformed-decimal', parsed.detail);
		// Both engine outcomes are 200: rejection is a valid, expected response.
		return json(runDemoReconciliation(parsed.budgetTuple, parsed.candidateTuple), {
			status: 200
		});
	};
}
