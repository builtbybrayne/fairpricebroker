// T3-m1-recruitment-demo §1 / §3: the demo's reconciliation. Both tuples
// are the visitor's own (they play both hats), so the view is the
// broker-full shape plus the salary-negotiation guidance layer
// (T2-product-surfaces §7 R9). Pure compute: no reconciliation row, no
// results row, no credit, no I/O. The engine runs in its own words
// (low-preferring / high-preferring); sides are mapped at this edge.
import { reconcile } from '$lib/server/engine';
import type {
	DirectionalParty,
	EngineError,
	PricePoint,
	VWTuple,
	Zone
} from '$lib/server/engine/types';
import { sideToDirection, type Side } from '$lib/domain/terms';
import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';
import type { SalaryGuidance } from '$lib/templates/salaryNegotiation';

export type DemoRawTuple = readonly [string, string, string, string];

export interface DemoReconcileView {
	/** The hiring company's budget: the buyer side. */
	readonly budgetTuple: DemoRawTuple;
	/** The candidate's expectations: the seller side. */
	readonly candidateTuple: DemoRawTuple;
	readonly zone: Zone;
	readonly fairPrice: PricePoint;
	readonly distances: Readonly<Record<Side, PricePoint>>;
	readonly dealLow: PricePoint;
	readonly dealHigh: PricePoint;
	readonly overlapLow: PricePoint;
	readonly overlapHigh: PricePoint;
	readonly guidance: SalaryGuidance;
}

export type DemoReconcileResponse =
	| { readonly ok: true; readonly view: DemoReconcileView }
	| { readonly ok: false; readonly error: EngineError };

/**
 * Brand-only cast: the engine is the sole validation authority
 * (T3-m1-engine-port §2.3), so nothing is re-validated here.
 */
function asParty(tuple: DemoRawTuple, side: Side): DirectionalParty {
	return { tuple: tuple as unknown as VWTuple, direction: sideToDirection[side] };
}

export function runDemoReconciliation(
	budgetTuple: DemoRawTuple,
	candidateTuple: DemoRawTuple
): DemoReconcileResponse {
	const offerer = salaryNegotiationTemplate.offeredBy;
	const respondent: Side = offerer === 'buyer' ? 'seller' : 'buyer';
	const budget = asParty(budgetTuple, offerer);
	const candidate = asParty(candidateTuple, respondent);
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
			distances: {
				buyer: distances[sideToDirection.buyer],
				seller: distances[sideToDirection.seller]
			},
			dealLow,
			dealHigh,
			overlapLow,
			overlapHigh,
			guidance: salaryNegotiationTemplate.guidance(zone)
		}
	};
}
