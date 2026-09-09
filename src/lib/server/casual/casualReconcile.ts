// T3-m1-casual-mode §2 / §4: the named shared casual capability contract.
// Consumers are the casual UI, HTTP, and MCP adapters only — never a
// broker-visible catalogue handler (§2). Pure-ish orchestration: no I/O
// beyond the engine call and the one seam call.
import { CASUAL_TEMPLATE_ID } from '$lib/casual/casualTemplate';
import { sideToDirection, type Side } from '$lib/domain/terms';
import { reconcile } from '$lib/server/engine';
import type { DirectionalParty, EngineError, VWTuple } from '$lib/server/engine/types';
import type { RefCode } from '$lib/server/refCodes';
import type { CasualPlayCompleter } from './casualCompletionSeam';
import { buildCasualResultPayload, type CasualResultPayload } from './casualPayload';

// Declared seam, T2-agent-distribution's catalogue (not built in this
// brief). handleCasualReconcile is the shared implementation both the
// same-origin route and the catalogue's MCP/HTTP adapters call.
export const CASUAL_RECONCILE_CAPABILITY = {
	name: 'casual.reconcile',
	authTier: 'none',
	reconciliationKinds: ['casual'],
	invokingRole: 'co-present-pair',
	payloadClass: 'casual-full-detail',
	rateLimitClass: 'compute'
} as const;

export type RawTuple = readonly [string, string, string, string];

export interface CasualReconcileRequest {
	readonly buyerTuple: RawTuple;
	readonly sellerTuple: RawTuple;
	/** Inbound attribution ref, validated at the HTTP boundary (casualRoute.ts). */
	readonly ref: RefCode | null;
	/** Client-minted UUID v4, validated at the HTTP boundary. */
	readonly idempotencyKey: string;
}

export type CasualReconcileResponse =
	| { readonly ok: true; readonly result: CasualResultPayload; readonly shareRef: RefCode }
	| { readonly ok: false; readonly error: EngineError };

/**
 * Wraps a raw tuple as the engine's branded input WITHOUT re-validating —
 * the engine is the sole validation authority (T3-m1-engine-port §2.3).
 * The side → direction mapping is the domain's one constant (buyer = low).
 */
function asEngineInput(tuple: RawTuple, side: Side): DirectionalParty {
	// Brand-only cast: DecimalString is a nominal brand over string.
	return { tuple: tuple as unknown as VWTuple, direction: sideToDirection[side] };
}

export async function handleCasualReconcile(
	req: CasualReconcileRequest,
	deps: { readonly completer: CasualPlayCompleter }
): Promise<CasualReconcileResponse> {
	// 1. Fixed directional mapping: the buyer is low-preferring, the seller high.
	const buyer = asEngineInput(req.buyerTuple, 'buyer');
	const seller = asEngineInput(req.sellerTuple, 'seller');

	// 2. Default tolerance (relative-r1).
	const outcome = reconcile(buyer, seller);

	// 3. Engine rejection: returned unchanged; the seam is never reached.
	if (!outcome.ok) return { ok: false, error: outcome.error };

	// 4. Awaited, keyed completion — a 200 is proof the completion was
	//    accepted and shareRef is the seam's value, never minted here.
	const { shareRef } = await deps.completer.completeCasualPlay({
		ref: req.ref,
		templateId: CASUAL_TEMPLATE_ID,
		idempotencyKey: req.idempotencyKey
	});

	return { ok: true, result: buildCasualResultPayload(outcome.result), shareRef };
}
