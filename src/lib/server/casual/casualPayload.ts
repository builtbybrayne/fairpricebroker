// T3-m1-casual-mode §4.1: the casual result payload is an explicit
// allowlist, NOT the full ReconcileResult. The boundary is the explicit
// destructure-and-reassemble below plus the exact-key runtime tests
// (V0a/V0b in casualPayload.test.ts) — never a spread, never a cast.
// `ReconcileResult` IS structurally assignable to this interface, so no
// compile-time guarantee is claimed here.
import type {
	EngineVersionMeta,
	PricePoint,
	ReconcileResult,
	Role,
	VWTuple,
	Zone
} from '$lib/server/engine/types';

export interface CasualResultPayload {
	readonly zone: Zone;
	readonly fairPrice: PricePoint;
	readonly convergenceAchieved: boolean;
	readonly convergedTrivially: boolean;
	readonly meta: EngineVersionMeta;
	readonly distances: Readonly<Record<Role, PricePoint>>;
	readonly input: Readonly<Record<Role, { readonly tuple: VWTuple }>>;
	readonly dealLow: PricePoint;
	readonly dealHigh: PricePoint;
	readonly overlapLow: PricePoint;
	readonly overlapHigh: PricePoint;
}

export function buildCasualResultPayload(result: ReconcileResult): CasualResultPayload {
	const {
		zone,
		fairPrice,
		convergenceAchieved,
		convergedTrivially,
		meta,
		distances,
		input,
		dealLow,
		dealHigh,
		overlapLow,
		overlapHigh
	} = result;
	return {
		zone,
		fairPrice,
		convergenceAchieved,
		convergedTrivially,
		meta,
		distances,
		input,
		dealLow,
		dealHigh,
		overlapLow,
		overlapHigh
	};
}
