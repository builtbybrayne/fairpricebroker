// VERIFY item 7: credits grant idempotent, reserve idempotent per key,
// refuses at zero, release restores.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { asUser, closeAdmin, createAuthUser, expectPgError } from '../../../../tests/helpers/db';
import { closeAllDb } from '$lib/server/data/db';
import { launchCredits } from './launchCredits';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

describe('launch credits', () => {
	it('grant is idempotent (balance 20), reserve idempotent on request_key, refuses at zero, release restores', async () => {
		const u = await createAuthUser('cred');
		expect(await asUser(u, (tx) => launchCredits(tx).grantLaunchCredits())).toBe(20);
		expect(await asUser(u, (tx) => launchCredits(tx).grantLaunchCredits())).toBe(20);
		const accountId = await asUser(u, (tx) => launchCredits(tx).ensureIdentity());

		const k1 = randomUUID();
		expect(
			await asUser(u, (tx) => launchCredits(tx).reserveAndDebitLaunchCredit(k1, accountId))
		).toEqual({ reservationId: k1 });
		await expect(
			asUser(u, (tx) => launchCredits(tx).reserveAndDebitLaunchCredit(k1, accountId))
		).rejects.toThrow('already-debited');
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(19);
		await expect(
			asUser(u, (tx) => launchCredits(tx).reserveAndDebitLaunchCredit(randomUUID(), randomUUID()))
		).rejects.toThrow('accountId');

		for (let i = 0; i < 19; i++) {
			await asUser(u, (tx) =>
				launchCredits(tx).reserveAndDebitLaunchCredit(randomUUID(), accountId)
			);
		}
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(0);
		await expectPgError(
			asUser(u, (tx) => launchCredits(tx).reserveAndDebitLaunchCredit(randomUUID(), accountId)),
			'insufficient-credits'
		);

		await asUser(u, (tx) => launchCredits(tx).releaseLaunchCredit(k1));
		await asUser(u, (tx) => launchCredits(tx).releaseLaunchCredit(k1));
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(1);
		// releasing a key that was never debited is a no-op
		await asUser(u, (tx) => launchCredits(tx).releaseLaunchCredit(randomUUID()));
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(1);
	});

	it('launch_invited_session debits once and refuses a replayed request key', async () => {
		const u = await createAuthUser('cred');
		await asUser(u, (tx) => launchCredits(tx).grantLaunchCredits());
		const key = randomUUID();
		const create = () =>
			asUser(
				u,
				(tx) =>
					tx`select session_id from launch_invited_session(${key}, 'recruitment', 'GBP', 'creator-as-host', null::uuid, 'low-preferring', ${tx.json([{ role: 'high-preferring', email: 'c@example.test' }])})`
			);
		expect(await create()).toHaveLength(1);
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(19);
		await expectPgError(create(), 'duplicate-request');
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(19);
		// a failing create rolls the debit back
		await expectPgError(
			asUser(
				u,
				(tx) =>
					tx`select session_id from launch_invited_session(${randomUUID()}, 'recruitment', 'GBP', 'creator-as-host', null::uuid, 'low-preferring', '[]'::jsonb)`
			),
			'invite-grant-cardinality'
		);
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(19);
	});
});
