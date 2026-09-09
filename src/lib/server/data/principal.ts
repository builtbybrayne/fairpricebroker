// T3-m1-data-core §2.7 (T3-m2 vocabulary): the caller's AUTHORITY is
// derived server-side from persisted state, in one query, as the caller's
// own authenticated role. This module is the SOLE authority that ever
// computes a broker's `full` (whether it sees both sides' figures).
import { isSide, type Side } from '$lib/domain/terms';
import type { CallerSql } from './db';

export type Viewer =
	| { kind: 'side'; side: Side }
	| { kind: 'broker'; full: boolean }
	| { kind: 'developer' }
	| { kind: 'none' };

export async function resolveViewer(caller: CallerSql, reconciliationId: string): Promise<Viewer> {
	const rows = await caller<
		{
			side: string | null;
			is_broker: boolean;
			broker_sees_figures: boolean | null;
			is_developer: boolean;
		}[]
	>`
		select
			side_for(${reconciliationId}::uuid) as side,
			is_broker(${reconciliationId}::uuid) as is_broker,
			(select broker_sees_figures from reconciliations where id = ${reconciliationId}::uuid)
				as broker_sees_figures,
			is_developer() as is_developer
	`;
	const r = rows[0];
	if (!r) return { kind: 'none' };
	if (r.is_developer) return { kind: 'developer' };
	// A broker acting for a side is still the broker seat here: what it may
	// see is the vertical's disclosure fact, not the side it enters for.
	if (r.is_broker) return { kind: 'broker', full: r.broker_sees_figures === true };
	if (isSide(r.side)) return { kind: 'side', side: r.side };
	return { kind: 'none' };
}
