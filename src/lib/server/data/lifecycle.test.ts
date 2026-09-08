// VERIFY item 4: lifecycle happy path, no-op re-orchestration, fence race.
import { afterAll, describe, expect, it } from 'vitest';
import { admin, closeAdmin, createAuthUser } from '../../../../tests/helpers/db';
import {
	createRecruitmentSession,
	enterPosition,
	lockedRecruitmentSession,
	redeem,
	sessionState,
	submit
} from '../../../../tests/helpers/fixtures';
import { closeAllDb } from './db';
import { claimAndOrchestrate } from './orchestrator';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

async function counts(sessionId: string) {
	const [r] = await admin()<{ results: number; events: number; honesty: number }[]>`
		select
			(select count(*)::int from results where session_id = ${sessionId}::uuid) as results,
			(select count(*)::int from events where session_id = ${sessionId}::uuid
			   and event_type = 'reconciliation_completed') as events,
			(select count(*)::int from honesty_signal_storage where session_id = ${sessionId}::uuid) as honesty
	`;
	return r;
}

describe('invited lifecycle', () => {
	it('create (recruitment) -> redeem -> both submit -> locked -> orchestrate -> closed', async () => {
		const creator = await createAuthUser('rec');
		const candidate = await createAuthUser('cand');
		const invites = await createRecruitmentSession(creator, candidate.email);
		expect(invites).toHaveLength(1);
		expect(invites[0].role).toBe('high-preferring');
		expect(invites[0].plaintext_token.length).toBeGreaterThan(30);

		const sessionId = invites[0].session_id;
		const [s] = await admin()<{ host_visibility: string; composition: string }[]>`
			select host_visibility, composition from sessions where id = ${sessionId}::uuid
		`;
		expect(s.host_visibility).toBe('host-visible');
		const parts = await admin()<{ direction: string | null; is_host: boolean }[]>`
			select direction, is_host from session_participants where session_id = ${sessionId}::uuid order by is_host
		`;
		expect(parts).toEqual([
			{ direction: 'low-preferring', is_host: false },
			{ direction: null, is_host: true }
		]);

		expect(await redeem(candidate, invites[0].plaintext_token)).toBe(sessionId);
		const [idn] = await admin()<{ n: number }[]>`
			select count(*)::int as n from identities where auth_user_id = ${candidate.sub}::uuid
		`;
		expect(idn.n).toBe(1);

		await enterPosition(creator, sessionId, 'low-preferring');
		await enterPosition(candidate, sessionId, 'high-preferring');
		const [pp] = await admin()<{ vertical: string; currency: string }[]>`
			select vertical, currency from party_positions where session_id = ${sessionId}::uuid limit 1
		`;
		expect(pp).toEqual({ vertical: 'recruitment', currency: 'GBP' });

		expect(await submit(creator, sessionId)).toBe('open');
		expect(await submit(candidate, sessionId)).toBe('locked');
		expect(await sessionState(sessionId)).toBe('locked');

		expect(await claimAndOrchestrate(sessionId)).toBe('closed');
		expect(await sessionState(sessionId)).toBe('closed');
		expect(await counts(sessionId)).toEqual({ results: 1, events: 1, honesty: 2 });
		const [stored] = await admin()<{ t: string; zone: string; ev: string }[]>`
			select jsonb_typeof(payload) as t, payload ->> 'zone' as zone, engine_version as ev
			from results where session_id = ${sessionId}::uuid`;
		expect(stored.t).toBe('object');
		expect(['comfort', 'deal', 'no-deal']).toContain(stored.zone);
		expect(stored.ev).toBe('0.1.0');

		expect(await claimAndOrchestrate(sessionId)).toBe('no-op');
		expect(await counts(sessionId)).toEqual({ results: 1, events: 1, honesty: 2 });
	});

	it('a non-stale claim held by another worker makes a second call a no-op', async () => {
		const { sessionId } = await lockedRecruitmentSession();
		await admin()`update sessions set orchestration_claimed_at = now(), orchestration_fence = 1
		              where id = ${sessionId}::uuid`;
		expect(await claimAndOrchestrate(sessionId)).toBe('no-op');
		expect(await sessionState(sessionId)).toBe('locked');
	});

	it('fence: a stale-claim reclaim during a slow finalize leaves one result/event', async () => {
		const { sessionId } = await lockedRecruitmentSession();
		let secondOutcome: string | undefined;
		const first = await claimAndOrchestrate(sessionId, {
			beforeFinalize: async () => {
				// Age the first worker's claim past the stale window, then let a
				// second worker reclaim and finish.
				await admin()`update sessions set orchestration_claimed_at = now() - interval '10 minutes'
				              where id = ${sessionId}::uuid`;
				secondOutcome = await claimAndOrchestrate(sessionId);
			}
		});
		expect(secondOutcome).toBe('closed');
		expect(first).toBe('superseded');
		expect(await sessionState(sessionId)).toBe('closed');
		expect(await counts(sessionId)).toEqual({ results: 1, events: 1, honesty: 2 });
	});
});
