// VERIFY item 4: lifecycle happy path, no-op re-orchestration, fence race.
import { afterAll, describe, expect, it } from 'vitest';
import { admin, closeAdmin, createAuthUser } from '../../../../tests/helpers/db';
import {
	createBrokeredReconciliation,
	enterFigures,
	lockedBrokeredReconciliation,
	reconciliationState,
	redeem,
	submitFigures
} from '../../../../tests/helpers/fixtures';
import { closeAllDb } from './db';
import { claimAndOrchestrate } from './orchestrator';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

async function counts(reconciliationId: string) {
	const [r] = await admin()<{ results: number; events: number; honesty: number }[]>`
		select
			(select count(*)::int from results where reconciliation_id = ${reconciliationId}::uuid) as results,
			(select count(*)::int from events where reconciliation_id = ${reconciliationId}::uuid
			   and event_type = 'reconciliation_completed') as events,
			(select count(*)::int from honesty_signal_storage
			   where reconciliation_id = ${reconciliationId}::uuid) as honesty
	`;
	return r;
}

describe('invited lifecycle', () => {
	it('launch (brokered) -> redeem -> both submit -> locked -> orchestrate -> closed', async () => {
		const creator = await createAuthUser('bro');
		const seller = await createAuthUser('sel');
		const invites = await createBrokeredReconciliation(creator, seller.email);
		expect(invites).toHaveLength(1);
		expect(invites[0].seat).toBe('seller');
		expect(invites[0].plaintext_token.length).toBeGreaterThan(30);

		const reconciliationId = invites[0].reconciliation_id;
		const [r] = await admin()<{ broker_sees_figures: boolean; vertical: string }[]>`
			select broker_sees_figures, vertical from reconciliations where id = ${reconciliationId}::uuid
		`;
		expect(r).toEqual({ broker_sees_figures: true, vertical: 'salary-negotiation' });

		expect(await redeem(seller, invites[0].plaintext_token)).toBe(reconciliationId);
		const [idn] = await admin()<{ n: number }[]>`
			select count(*)::int as n from identities where auth_user_id = ${seller.sub}::uuid
		`;
		expect(idn.n).toBe(1);
		// One seat per participant: the broker acts for the buyer, the seller is itself.
		const parts = await admin()<{ seat: string; acts_for: string | null; side: string }[]>`
			select seat, acts_for, side from participants
			where reconciliation_id = ${reconciliationId}::uuid order by seat
		`;
		expect(parts).toEqual([
			{ seat: 'broker', acts_for: 'buyer', side: 'buyer' },
			{ seat: 'seller', acts_for: null, side: 'seller' }
		]);

		await enterFigures(creator, reconciliationId, 'buyer');
		await enterFigures(seller, reconciliationId, 'seller');
		const [fig] = await admin()<{ vertical: string; currency: string }[]>`
			select vertical, currency from figures where reconciliation_id = ${reconciliationId}::uuid limit 1
		`;
		expect(fig).toEqual({ vertical: 'salary-negotiation', currency: 'GBP' });

		expect(await submitFigures(creator, reconciliationId)).toBe('open');
		expect(await submitFigures(seller, reconciliationId)).toBe('locked');
		expect(await reconciliationState(reconciliationId)).toBe('locked');

		expect(await claimAndOrchestrate(reconciliationId)).toBe('closed');
		expect(await reconciliationState(reconciliationId)).toBe('closed');
		expect(await counts(reconciliationId)).toEqual({ results: 1, events: 1, honesty: 2 });
		const [stored] = await admin()<{ t: string; zone: string; ev: string }[]>`
			select jsonb_typeof(payload) as t, payload ->> 'zone' as zone, engine_version as ev
			from results where reconciliation_id = ${reconciliationId}::uuid`;
		expect(stored.t).toBe('object');
		expect(['comfort', 'deal', 'no-deal']).toContain(stored.zone);
		expect(stored.ev).toBe('0.1.0');
		// Honesty signals are stored per SIDE; the engine's direction words stay inside the payload.
		const honesty = await admin()<{ side: string }[]>`
			select side from honesty_signal_storage where reconciliation_id = ${reconciliationId}::uuid order by side`;
		expect(honesty.map((h) => h.side)).toEqual(['buyer', 'seller']);

		expect(await claimAndOrchestrate(reconciliationId)).toBe('no-op');
		expect(await counts(reconciliationId)).toEqual({ results: 1, events: 1, honesty: 2 });
	});

	it('a non-stale claim held by another worker makes a second call a no-op', async () => {
		const { reconciliationId } = await lockedBrokeredReconciliation();
		await admin()`update reconciliations set orchestration_claimed_at = now(), orchestration_fence = 1
		              where id = ${reconciliationId}::uuid`;
		expect(await claimAndOrchestrate(reconciliationId)).toBe('no-op');
		expect(await reconciliationState(reconciliationId)).toBe('locked');
	});

	it('fence: a stale-claim reclaim during a slow finalize leaves one result/event', async () => {
		const { reconciliationId } = await lockedBrokeredReconciliation();
		let secondOutcome: string | undefined;
		const first = await claimAndOrchestrate(reconciliationId, {
			beforeFinalize: async () => {
				// Age the first worker's claim past the stale window, then let a
				// second worker reclaim and finish.
				await admin()`update reconciliations set orchestration_claimed_at = now() - interval '10 minutes'
				              where id = ${reconciliationId}::uuid`;
				secondOutcome = await claimAndOrchestrate(reconciliationId);
			}
		});
		expect(secondOutcome).toBe('closed');
		expect(first).toBe('superseded');
		expect(await reconciliationState(reconciliationId)).toBe('closed');
		expect(await counts(reconciliationId)).toEqual({ results: 1, events: 1, honesty: 2 });
	});
});
