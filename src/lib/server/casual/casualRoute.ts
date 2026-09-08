// T3-m1-casual-mode §4 transport policy: the same-origin UI adapter's
// body, factored so tests can construct it with a spy completer while
// `src/routes/api/casual/reconcile/+server.ts` wires the real one.
//
//   parse failure / structural failure  -> 400 { ok:false, error:{kind:'malformed-decimal', detail} }
//   ref present but fails isRefCode     -> 400 { error:'invalid-ref' }   (flat, distinct body)
//   engine rejection                    -> 200 { ok:false, error }
//   engine acceptance                   -> 200 { ok:true, result, shareRef }
//
// Precedence when BOTH a malformed ref and another structural fault are
// present (unspecified by the brief): the ref check runs first, because a
// malformed ref is a tampered URL the client must discard regardless.
import { json } from '@sveltejs/kit';
import { isRefCode, type RefCode } from '$lib/server/refCodes';
import type { CasualPlayCompleter } from './casualCompletionSeam';
import {
	handleCasualReconcile,
	type CasualReconcileRequest,
	type RawTuple
} from './casualReconcile';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INVALID_REF_BODY = { error: 'invalid-ref' } as const;

function structural(detail: string): Response {
	return json({ ok: false, error: { kind: 'malformed-decimal', detail } }, { status: 400 });
}

function isRawTuple(x: unknown): x is RawTuple {
	return Array.isArray(x) && x.length === 4 && x.every((v) => typeof v === 'string');
}

type Parsed =
	| { kind: 'ok'; req: CasualReconcileRequest }
	| { kind: 'invalid-ref' }
	| { kind: 'structural'; detail: string };

function parseBody(body: unknown): Parsed {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return { kind: 'structural', detail: 'request body must be a JSON object' };
	}
	const b = body as Record<string, unknown>;

	// Ref: omitted or null is the legitimate no-attribution path; anything
	// else must satisfy the shared ref-code grammar or it is invalid-ref.
	const rawRef = b.ref;
	let ref: RefCode | null = null;
	if (rawRef !== undefined && rawRef !== null) {
		if (!isRefCode(rawRef)) return { kind: 'invalid-ref' };
		ref = rawRef;
	}

	if (!isRawTuple(b.partyATuple)) {
		return { kind: 'structural', detail: 'partyATuple must be an array of exactly 4 strings' };
	}
	if (!isRawTuple(b.partyBTuple)) {
		return { kind: 'structural', detail: 'partyBTuple must be an array of exactly 4 strings' };
	}
	if (typeof b.idempotencyKey !== 'string' || !UUID_V4.test(b.idempotencyKey)) {
		return { kind: 'structural', detail: 'idempotencyKey must be a UUID v4' };
	}

	return {
		kind: 'ok',
		req: {
			partyATuple: b.partyATuple,
			partyBTuple: b.partyBTuple,
			ref,
			idempotencyKey: b.idempotencyKey
		}
	};
}

export function createCasualReconcileHandler(deps: { readonly completer: CasualPlayCompleter }) {
	return async ({ request }: { request: Request }): Promise<Response> => {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return structural('request body is not valid JSON');
		}
		const parsed = parseBody(body);
		if (parsed.kind === 'invalid-ref') return json(INVALID_REF_BODY, { status: 400 });
		if (parsed.kind === 'structural') return structural(parsed.detail);
		// Both engine outcomes are 200: rejection is a valid, expected response.
		return json(await handleCasualReconcile(parsed.req, deps), { status: 200 });
	};
}
