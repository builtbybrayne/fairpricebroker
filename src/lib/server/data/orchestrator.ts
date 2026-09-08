// T3-m1-data-core §2.5 D2: the narrow orchestrator. Claim (own short
// transaction, fenced by a sequence value) -> read both rows -> pure
// engine -> finalize as ONE transaction that re-checks the fence first.
import {
	reconcile,
	type DecimalString,
	type DirectionalParty,
	type Role,
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
	sessionId: string,
	hooks: OrchestrateHooks = {}
): Promise<OrchestrateOutcome> {
	const sql = roleDb('orchestrator');

	// 1. Claim.
	const claimed = await sql<{ orchestration_fence: string }[]>`
		update sessions
		set orchestration_claimed_at = now(),
		    orchestration_fence = nextval('orchestration_fence_seq')
		where id = ${sessionId}::uuid
		  and state = 'locked'
		  and (orchestration_claimed_at is null
		       or orchestration_claimed_at < now() - ${STALE_CLAIM_INTERVAL}::interval)
		returning orchestration_fence
	`;
	if (claimed.length === 0) return 'no-op';
	const fence = claimed[0].orchestration_fence;

	// 2. Read both submitted rows, run the pure engine.
	const rows = await sql<{ direction: Role; v1: string; v2: string; v3: string; v4: string }[]>`
		select direction, v1, v2, v3, v4 from party_positions
		where session_id = ${sessionId}::uuid and status = 'submitted'
	`;
	if (rows.length !== 2) throw new Error(`expected two submitted positions, found ${rows.length}`);
	const parties = rows.map((r): DirectionalParty => ({
		direction: r.direction,
		tuple: [r.v1, r.v2, r.v3, r.v4].map((v) => v as DecimalString) as unknown as VWTuple
	}));
	const outcome = reconcile(parties[0], parties[1]);

	if (hooks.beforeFinalize) await hooks.beforeFinalize();

	// 3. Finalize — one transaction, fenced.
	return sql.begin(async (tx) => {
		const current = await tx<{ orchestration_fence: string }[]>`
			select orchestration_fence from sessions where id = ${sessionId}::uuid for update
		`;
		if (current.length === 0 || current[0].orchestration_fence !== fence) return 'superseded';

		if (!outcome.ok) {
			await tx`
				insert into events (session_id, event_type, payload)
				values (${sessionId}::uuid, 'computation_failed', ${tx.json(asJson({ error: outcome.error }))})
				on conflict on constraint events_session_id_event_type_sequence_key do nothing
			`;
			return 'computation-failed';
		}
		const result = outcome.result;
		await tx`
			insert into results (session_id, payload, engine_version, algorithm_version)
			values (${sessionId}::uuid, ${tx.json(asJson(result))},
			        ${result.meta.engineVersion}, ${result.meta.algorithmVersion})
		`;
		for (const role of ['low-preferring', 'high-preferring'] as const) {
			await tx`
				insert into honesty_signal_storage (session_id, direction, signals, signal_set_version)
				values (${sessionId}::uuid, ${role}, ${tx.json(asJson(result.honesty[role]))},
				        ${result.honesty[role].signalSetVersion})
			`;
		}
		await tx`
			insert into events (session_id, event_type, payload)
			values (${sessionId}::uuid, 'reconciliation_completed',
			        ${tx.json({ zone: result.zone, engine_version: result.meta.engineVersion })})
			on conflict (session_id) where event_type = 'reconciliation_completed' do nothing
		`;
		await tx`update sessions set state = 'closed' where id = ${sessionId}::uuid`;
		return 'closed';
	});
}
