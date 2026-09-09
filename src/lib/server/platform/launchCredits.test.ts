// VERIFY item 7: credits grant idempotent (8 on launch, operator 9 Sep
// 2026), reserve idempotent per key, refuses at zero, release restores.
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
	it('grant is idempotent (balance 8), reserve idempotent on request_key, refuses at zero, release restores', async () => {
		const u = await createAuthUser('cred');
		expect(await asUser(u, (tx) => launchCredits(tx).grantLaunchCredits())).toBe(8);
		expect(await asUser(u, (tx) => launchCredits(tx).grantLaunchCredits())).toBe(8);
		const accountId = await asUser(u, (tx) => launchCredits(tx).ensureIdentity());

		const k1 = randomUUID();
		expect(
			await asUser(u, (tx) => launchCredits(tx).reserveAndDebitLaunchCredit(k1, accountId))
		).toEqual({ reservationId: k1 });
		await expect(
			asUser(u, (tx) => launchCredits(tx).reserveAndDebitLaunchCredit(k1, accountId))
		).rejects.toThrow('already-debited');
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(7);
		await expect(
			asUser(u, (tx) => launchCredits(tx).reserveAndDebitLaunchCredit(randomUUID(), randomUUID()))
		).rejects.toThrow('accountId');

		for (let i = 0; i < 7; i++) {
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

	it('launch_reconciliation debits once and refuses a replayed request key', async () => {
		const u = await createAuthUser('cred');
		await asUser(u, (tx) => launchCredits(tx).grantLaunchCredits());
		const key = randomUUID();
		const launch = () =>
			asUser(
				u,
				(tx) =>
					tx`select reconciliation_id from launch_reconciliation(${key}, 'salary-negotiation', 'GBP', 'broker', 'buyer', null::uuid, ${tx.json([{ seat: 'seller', email: 'c@example.test' }])})`
			);
		expect(await launch()).toHaveLength(1);
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(7);
		await expectPgError(launch(), 'duplicate-request');
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(7);
		// a failing launch rolls the debit back
		await expectPgError(
			asUser(
				u,
				(tx) =>
					tx`select reconciliation_id from launch_reconciliation(${randomUUID()}, 'salary-negotiation', 'GBP', 'broker', 'buyer', null::uuid, '[]'::jsonb)`
			),
			'invite-grant-cardinality'
		);
		expect(await asUser(u, (tx) => launchCredits(tx).getBalance())).toBe(7);
	});
});
