// T3-m1-data-core §2.5 D2: the narrow orchestrator. Claim (own short
// transaction, fenced by a sequence value) -> read both sides' figures ->
// pure engine -> finalize as ONE transaction that re-checks the fence first.
//
// The engine speaks low-preferring / high-preferring; the tables speak
// buyer / seller. The two constants from $lib/domain/terms are the whole
// of the translation, applied at this boundary in both directions.
import { directionToSide, isSide, sideToDirection } from '$lib/domain/terms';
import {
	reconcile,
	type DecimalString,
	type DirectionalParty,
	type VWTuple
} from '$lib/server/engine';
import type { JSONValue } from 'postgres';
import { roleDb } from './db';

const asJson = (x: unknown) => x as JSONValue;

export const STALE_CLAIM_INTERVAL = '5 minutes';

export interface OrchestrateHooks {
	/** Test seam: runs between the claim and the finalize transaction. */
	beforeFinalize?: () => Promise<void>;
}

export type OrchestrateOutcome = 'no-op' | 'superseded' | 'closed' | 'computation-failed';

export async function claimAndOrchestrate(
	reconciliationId: string,
	hooks: OrchestrateHooks = {}
): Promise<OrchestrateOutcome> {
	const sql = roleDb('orchestrator');

	// 1. Claim.
	const claimed = await sql<{ orchestration_fence: string }[]>`
		update reconciliations
		set orchestration_claimed_at = now(),
		    orchestration_fence = nextval('orchestration_fence_seq')
		where id = ${reconciliationId}::uuid
		  and state = 'locked'
		  and (orchestration_claimed_at is null
		       or orchestration_claimed_at < now() - ${STALE_CLAIM_INTERVAL}::interval)
		returning orchestration_fence
	`;
	if (claimed.length === 0) return 'no-op';
	const fence = claimed[0].orchestration_fence;

	// 2. Read both submitted sides, run the pure engine.
	const rows = await sql<{ side: string; v1: string; v2: string; v3: string; v4: string }[]>`
		select side, v1, v2, v3, v4 from figures
		where reconciliation_id = ${reconciliationId}::uuid and status = 'submitted'
	`;
	if (rows.length !== 2) throw new Error(`expected two submitted figures, found ${rows.length}`);
	const inputs = rows.map((r): DirectionalParty => {
		if (!isSide(r.side)) throw new Error(`figures row with unknown side ${r.side}`);
		return {
			direction: sideToDirection[r.side],
			tuple: [r.v1, r.v2, r.v3, r.v4].map((v) => v as DecimalString) as unknown as VWTuple
		};
	});
	const outcome = reconcile(inputs[0], inputs[1]);

	if (hooks.beforeFinalize) await hooks.beforeFinalize();

	// 3. Finalize — one transaction, fenced.
	return sql.begin(async (tx) => {
		const current = await tx<{ orchestration_fence: string }[]>`
			select orchestration_fence from reconciliations where id = ${reconciliationId}::uuid for update
		`;
		if (current.length === 0 || current[0].orchestration_fence !== fence) return 'superseded';

		if (!outcome.ok) {
			await tx`
				insert into events (reconciliation_id, event_type, payload)
				values (${reconciliationId}::uuid, 'computation_failed', ${tx.json(asJson({ error: outcome.error }))})
				on conflict on constraint events_reconciliation_id_event_type_sequence_key do nothing
			`;
			return 'computation-failed';
		}
		const result = outcome.result;
		await tx`
			insert into results (reconciliation_id, payload, engine_version, algorithm_version)
			values (${reconciliationId}::uuid, ${tx.json(asJson(result))},
			        ${result.meta.engineVersion}, ${result.meta.algorithmVersion})
		`;
		for (const direction of ['low-preferring', 'high-preferring'] as const) {
			await tx`
				insert into honesty_signal_storage (reconciliation_id, side, signals, signal_set_version)
				values (${reconciliationId}::uuid, ${directionToSide[direction]},
				        ${tx.json(asJson(result.honesty[direction]))},
				        ${result.honesty[direction].signalSetVersion})
			`;
		}
		await tx`
			insert into events (reconciliation_id, event_type, payload)
			values (${reconciliationId}::uuid, 'reconciliation_completed',
			        ${tx.json({ zone: result.zone, engine_version: result.meta.engineVersion })})
			on conflict (reconciliation_id) where event_type = 'reconciliation_completed' do nothing
		`;
		await tx`update reconciliations set state = 'closed' where id = ${reconciliationId}::uuid`;
		return 'closed';
	});
}
