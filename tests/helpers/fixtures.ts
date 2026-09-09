import { randomUUID } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import { otherSide, type Side } from '$lib/domain/terms';
import { admin, asUser, createAuthUser, type TestUser } from './db';

export type { Side };
export const OTHER: Record<Side, Side> = {
	buyer: otherSide('buyer'),
	seller: otherSide('seller')
};

export interface CreatedInvite {
	reconciliation_id: string;
	invite_id: string;
	seat: string;
	plaintext_token: string;
}

export async function signInAndGrant(user: TestUser): Promise<number> {
	return asUser(user, async (tx) => {
		const r = await tx<{ b: number }[]>`select grant_launch_credits() as b`;
		return r[0].b;
	});
}

/**
 * Brokered (salary-negotiation): the creator is the broker acting for the
 * buyer; one seller invite, email-bound when an email is given and
 * unbound (link only) when it is null.
 */
export async function createBrokeredReconciliation(
	creator: TestUser,
	sellerEmail: string | null,
	opts: { visitId?: string | null; requestKey?: string } = {}
): Promise<CreatedInvite[]> {
	await signInAndGrant(creator);
	const grant = sellerEmail === null ? { seat: 'seller' } : { seat: 'seller', email: sellerEmail };
	return asUser(
		creator,
		(tx) =>
			tx<CreatedInvite[]>`
			select * from launch_reconciliation(
				${opts.requestKey ?? randomUUID()}, 'salary-negotiation', 'GBP', 'broker', 'buyer',
				${opts.visitId ?? null}::uuid, ${tx.json([grant])}
			)
		`
	);
}

/**
 * Blind: the creator is a broker who acts for nobody, in a vertical whose
 * broker does not see figures; one email-bound invite per side.
 */
export async function createBlindReconciliation(
	creator: TestUser,
	buyerEmail: string,
	sellerEmail: string
): Promise<CreatedInvite[]> {
	await signInAndGrant(creator);
	return asUser(
		creator,
		(tx) =>
			tx<CreatedInvite[]>`
			select * from launch_reconciliation(
				${randomUUID()}, 'generic', 'GBP', 'broker', null, null::uuid,
				${tx.json([
					{ seat: 'buyer', email: buyerEmail },
					{ seat: 'seller', email: sellerEmail }
				])}
			)
		`
	);
}

export async function redeem(user: TestUser, token: string): Promise<string> {
	return asUser(user, async (tx) => {
		const r = await tx<{ r: string }[]>`select redeem_invite(${token}) as r`;
		return r[0].r;
	});
}

export const BUYER_TUPLE = ['100', '120', '140', '160'];
export const SELLER_TUPLE = ['110', '130', '150', '170'];

export async function enterFigures(
	user: TestUser,
	reconciliationId: string,
	side: Side,
	tuple: string[] = side === 'buyer' ? BUYER_TUPLE : SELLER_TUPLE
): Promise<void> {
	await asUser(user, async (tx) => {
		await tx`
			insert into figures (reconciliation_id, side, v1, v2, v3, v4)
			values (${reconciliationId}::uuid, ${side}, ${tuple[0]}::numeric, ${tuple[1]}::numeric,
			        ${tuple[2]}::numeric, ${tuple[3]}::numeric)
		`;
	});
}

export async function submitFigures(user: TestUser, reconciliationId: string): Promise<string> {
	return asUser(user, async (tx) => {
		const r = await tx<{ s: string }[]>`select submit_figures(${reconciliationId}::uuid) as s`;
		return r[0].s;
	});
}

export async function reconciliationState(reconciliationId: string): Promise<string> {
	const r = await admin()<
		{ state: string }[]
	>`select state from reconciliations where id = ${reconciliationId}::uuid`;
	return r[0].state;
}

/** A brokered reconciliation taken to `locked` with both sides' figures submitted. */
export async function lockedBrokeredReconciliation(): Promise<{
	creator: TestUser;
	seller: TestUser;
	reconciliationId: string;
}> {
	const creator = await createAuthUser('bro');
	const seller = await createAuthUser('sel');
	const [inv] = await createBrokeredReconciliation(creator, seller.email);
	await redeem(seller, inv.plaintext_token);
	await enterFigures(creator, inv.reconciliation_id, 'buyer');
	await enterFigures(seller, inv.reconciliation_id, 'seller');
	await submitFigures(creator, inv.reconciliation_id);
	const s = await submitFigures(seller, inv.reconciliation_id);
	if (s !== 'locked') throw new Error(`expected locked, got ${s}`);
	return { creator, seller, reconciliationId: inv.reconciliation_id };
}

export async function withUser<T>(
	user: TestUser,
	fn: (tx: TransactionSql) => Promise<T>
): Promise<T> {
	return asUser(user, fn);
}
