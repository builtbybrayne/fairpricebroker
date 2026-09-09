// T3-m1-platform-naive-auth §3.5: the launch-credit seam data-core's
// reconciliation creation is gated behind. Runs on the caller's request-scoped
// (authenticated) connection.
import type { CallerSql } from '$lib/server/data/db';

export interface LaunchCreditReservation {
	reserveAndDebitLaunchCredit(
		requestKey: string,
		accountId: string
	): Promise<{ reservationId: string }>;
}

export function launchCredits(caller: CallerSql) {
	const ensureIdentity = async (): Promise<string> => {
		const rows = await caller<{ id: string }[]>`select ensure_identity() as id`;
		return rows[0].id;
	};
	return {
		ensureIdentity,
		async grantLaunchCredits(): Promise<number> {
			const rows = await caller<{ balance: number }[]>`select grant_launch_credits() as balance`;
			return rows[0].balance;
		},
		async getBalance(): Promise<number> {
			const rows = await caller<{ balance: number }[]>`select current_credit_balance() as balance`;
			return rows[0].balance;
		},
		async reserveAndDebitLaunchCredit(
			requestKey: string,
			accountId: string
		): Promise<{ reservationId: string }> {
			const own = await ensureIdentity();
			if (own !== accountId) throw new Error('accountId does not match the caller');
			const rows = await caller<{ outcome: string }[]>`
				select reserve_and_debit_launch_credit(${requestKey}) as outcome
			`;
			if (rows[0].outcome !== 'debited') throw new Error(rows[0].outcome);
			return { reservationId: requestKey };
		},
		async releaseLaunchCredit(requestKey: string): Promise<void> {
			await caller`select release_launch_credit(${requestKey})`;
		}
	} satisfies LaunchCreditReservation & Record<string, unknown>;
}
