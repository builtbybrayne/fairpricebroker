// T3-m1-recruitment-demo §1 / §3: the demo's reconciliation. Both tuples
// are the visitor's own (they play both hats), so the view is the
// host-full shape plus the recruitment guidance layer (T2-product-surfaces
// §7 R9). Pure compute: no session row, no results row, no credit, no I/O.
import { reconcile } from '$lib/server/engine';
import type {
	DirectionalParty,
	EngineError,
	PricePoint,
	Role,
	VWTuple,
	Zone
} from '$lib/server/engine/types';
import { RECRUITMENT_DIRECTION, recruitmentTemplate } from '$lib/templates/recruitment';
import type { RecruitmentGuidance } from '$lib/templates/recruitment';

export type DemoRawTuple = readonly [string, string, string, string];

export interface DemoReconcileView {
	readonly budgetTuple: DemoRawTuple;
	readonly candidateTuple: DemoRawTuple;
	readonly zone: Zone;
	readonly fairPrice: PricePoint;
	readonly distances: Readonly<Record<Role, PricePoint>>;
	readonly dealLow: PricePoint;
	readonly dealHigh: PricePoint;
	readonly overlapLow: PricePoint;
	readonly overlapHigh: PricePoint;
	readonly guidance: RecruitmentGuidance;
}

export type DemoReconcileResponse =
	| { readonly ok: true; readonly view: DemoReconcileView }
	| { readonly ok: false; readonly error: EngineError };

/**
 * Brand-only cast: the engine is the sole validation authority
 * (T3-m1-engine-port §2.3), so nothing is re-validated here.
 */
function asParty(tuple: DemoRawTuple, direction: Role): DirectionalParty {
	return { tuple: tuple as unknown as VWTuple, direction };
}

export function runDemoReconciliation(
	budgetTuple: DemoRawTuple,
	candidateTuple: DemoRawTuple
): DemoReconcileResponse {
	const budget = asParty(budgetTuple, RECRUITMENT_DIRECTION.budget);
	const candidate = asParty(candidateTuple, RECRUITMENT_DIRECTION.candidate);
	const outcome = reconcile(budget, candidate);
	if (!outcome.ok) return { ok: false, error: outcome.error };

	const { zone, fairPrice, distances, dealLow, dealHigh, overlapLow, overlapHigh } = outcome.result;
	return {
		ok: true,
		view: {
			budgetTuple,
			candidateTuple,
			zone,
			fairPrice,
			distances,
			dealLow,
			dealHigh,
			overlapLow,
			overlapHigh,
			guidance: recruitmentTemplate.guidance(zone)
		}
	};
}
