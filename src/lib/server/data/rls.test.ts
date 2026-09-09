// VERIFY item 2: focused adversarial authorisation tests, in the T3-m2
// vocabulary: sides see their own figures only, the broker sees seats but
// never figures, guarded transitions refuse by their new names.
import { afterAll, describe, expect, it } from 'vitest';
import {
	admin,
	asUser,
	closeAdmin,
	createAuthUser,
	expectPgError
} from '../../../../tests/helpers/db';
import {
	createBlindReconciliation,
	createBrokeredReconciliation,
	enterFigures,
	redeem,
	submitFigures
} from '../../../../tests/helpers/fixtures';
import { closeAllDb } from './db';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

async function blindTwoSided() {
	const broker = await createAuthUser('broker');
	const buyer = await createAuthUser('buyer');
	const seller = await createAuthUser('seller');
	const invites = await createBlindReconciliation(broker, buyer.email, seller.email);
	const reconciliationId = invites[0].reconciliation_id;
	const buyerInv = invites.find((i) => i.seat === 'buyer')!;
	const sellerInv = invites.find((i) => i.seat === 'seller')!;
	await redeem(buyer, buyerInv.plaintext_token);
	await redeem(seller, sellerInv.plaintext_token);
	await enterFigures(buyer, reconciliationId, 'buyer');
	await enterFigures(seller, reconciliationId, 'seller');
	return { broker, buyer, seller, reconciliationId, buyerInv, sellerInv };
}

describe('side isolation', () => {
	it('the buyer sees only their own figures row; the seller likewise; the broker sees none', async () => {
		const { broker, buyer, seller, reconciliationId } = await blindTwoSided();
		const seenByBuyer = await asUser(
			buyer,
			(tx) =>
				tx<
					{ side: string }[]
				>`select side from figures where reconciliation_id = ${reconciliationId}::uuid`
		);
		expect(seenByBuyer.map((r) => r.side)).toEqual(['buyer']);
		const seenBySeller = await asUser(
			seller,
			(tx) =>
				tx<
					{ side: string }[]
				>`select side from figures where reconciliation_id = ${reconciliationId}::uuid`
		);
		expect(seenBySeller.map((r) => r.side)).toEqual(['seller']);
		const seenByBroker = await asUser(
			broker,
			(tx) => tx`select side from figures where reconciliation_id = ${reconciliationId}::uuid`
		);
		expect(seenByBroker).toHaveLength(0);
		// Even an unfiltered scan returns only own rows.
		const all = await asUser(
			buyer,
			(tx) =>
				tx<
					{ side: string; reconciliation_id: string }[]
				>`select side, reconciliation_id from figures`
		);
		expect(all.every((r) => r.reconciliation_id === reconciliationId && r.side === 'buyer')).toBe(
			true
		);
	});

	it('a participant sees the seats at their reconciliation, never the figures behind them', async () => {
		const { buyer, broker, reconciliationId } = await blindTwoSided();
		const seats = await asUser(
			buyer,
			(tx) =>
				tx<
					{ seat: string }[]
				>`select seat from participants where reconciliation_id = ${reconciliationId}::uuid order by seat`
		);
		expect(seats.map((r) => r.seat)).toEqual(['broker', 'buyer', 'seller']);
		const brokerFigures = await asUser(
			broker,
			(tx) => tx`select v1 from figures where reconciliation_id = ${reconciliationId}::uuid`
		);
		expect(brokerFigures).toHaveLength(0);
	});

	it("a side cannot update the other side's values (0 rows) nor set status directly", async () => {
		const { buyer, reconciliationId } = await blindTwoSided();
		const updated = await asUser(
			buyer,
			(tx) =>
				tx`update figures set v1 = 1 where reconciliation_id = ${reconciliationId}::uuid and side = 'seller'`
		);
		expect(updated.count).toBe(0);
		await expectPgError(
			asUser(
				buyer,
				(tx) =>
					tx`update figures set status = 'submitted' where reconciliation_id = ${reconciliationId}::uuid`
			),
			'permission denied'
		);
		await expectPgError(
			asUser(
				buyer,
				(tx) =>
					tx`update figures set submitted_at = now() where reconciliation_id = ${reconciliationId}::uuid`
			),
			'permission denied'
		);
		const [row] = await admin()<{ status: string; v1: string }[]>`
			select status, v1 from figures where reconciliation_id = ${reconciliationId}::uuid and side = 'seller'`;
		expect(row.status).toBe('draft');
		expect(row.v1).toBe('110');
	});

	it('a side cannot insert figures for the other side or for another reconciliation', async () => {
		const { buyer, reconciliationId } = await blindTwoSided();
		const other = await blindTwoSided();
		await expectPgError(
			asUser(
				buyer,
				(tx) => tx`insert into figures (reconciliation_id, side, v1, v2, v3, v4)
			  values (${other.reconciliationId}::uuid, 'buyer', 1, 2, 3, 4)`
			),
			'row-level security'
		);
		await asUser(buyer, (tx) => tx`delete from figures where false`).catch(() => {});
		await expectPgError(
			asUser(
				buyer,
				(tx) => tx`insert into figures (reconciliation_id, side, v1, v2, v3, v4)
			  values (${reconciliationId}::uuid, 'seller', 1, 2, 3, 4)`
			),
			''
		);
	});
});

describe('deny-by-default tables', () => {
	const tables = [
		'results',
		'honesty_signal_storage',
		'events',
		'share_refs',
		'visits',
		'identities',
		'developer_grants',
		'purge_tombstone_log',
		'billing_reference',
		'credit_ledger',
		'credit_balances',
		'activation_events',
		'demo_answers'
	];
	for (const table of tables) {
		it(`authenticated cannot select from ${table}`, async () => {
			const u = await createAuthUser('x');
			await expectPgError(
				asUser(u, (tx) => tx.unsafe(`select * from ${table}`)),
				'permission denied'
			);
		});
		it(`anon cannot select from ${table}`, async () => {
			const u = await createAuthUser('x');
			await expectPgError(
				asUser(u, (tx) => tx.unsafe(`select * from ${table}`), 'anon'),
				'permission denied'
			);
		});
	}
	it('reconciliations/invites/participants are filtered to own rows for an unrelated principal', async () => {
		const { reconciliationId } = await blindTwoSided();
		const stranger = await createAuthUser('stranger');
		const r = await asUser(
			stranger,
			(tx) => tx`select id from reconciliations where id = ${reconciliationId}::uuid`
		);
		expect(r).toHaveLength(0);
		const i = await asUser(
			stranger,
			(tx) => tx`select id from invites where reconciliation_id = ${reconciliationId}::uuid`
		);
		expect(i).toHaveLength(0);
		const p = await asUser(
			stranger,
			(tx) => tx`select seat from participants where reconciliation_id = ${reconciliationId}::uuid`
		);
		expect(p).toHaveLength(0);
	});
	it('create_reconciliation is not directly executable by authenticated; anon cannot submit', async () => {
		const u = await createAuthUser('x');
		await expectPgError(
			asUser(
				u,
				(tx) =>
					tx`select * from create_reconciliation('generic','GBP','buyer',null,null::uuid,'[]'::jsonb)`
			),
			'permission denied'
		);
		await expectPgError(
			asUser(u, (tx) => tx`select submit_figures(gen_random_uuid())`, 'anon'),
			'permission denied'
		);
	});
	it('a side cannot update reconciliations.state directly', async () => {
		const { buyer, reconciliationId } = await blindTwoSided();
		await expectPgError(
			asUser(
				buyer,
				(tx) => tx`update reconciliations set state = 'closed' where id = ${reconciliationId}::uuid`
			),
			'permission denied'
		);
	});
	it('a forged client-side broker claim is ignored: is_broker reads persisted membership only', async () => {
		const { buyer, reconciliationId } = await blindTwoSided();
		const r = await admin().begin(async (tx) => {
			await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: buyer.sub, email: buyer.email, role: 'authenticated', seat: 'broker', is_broker: true })}, true)`;
			await tx`set local role authenticated`;
			return tx<
				{ b: boolean; d: boolean }[]
			>`select is_broker(${reconciliationId}::uuid) as b, is_developer() as d`;
		});
		expect(r[0]).toEqual({ b: false, d: false });
	});
});

describe('redeem_invite guards', () => {
	it('refuses a second redemption, an expired invite, a revoked invite, and an email mismatch', async () => {
		const creator = await createAuthUser('bro');
		const seller = await createAuthUser('sel');
		const [inv] = await createBrokeredReconciliation(creator, seller.email);
		// wrong email (JWT email differs from invites.email)
		const impostor = await createAuthUser('imp');
		await expectPgError(redeem(impostor, inv.plaintext_token), 'email-mismatch');
		// email compare is case-insensitive
		const upper = { sub: seller.sub, email: seller.email.toUpperCase() };
		expect(await redeem(upper, inv.plaintext_token)).toBe(inv.reconciliation_id);
		// second redemption
		await expectPgError(redeem(seller, inv.plaintext_token), 'invite-already-redeemed');
		// expired
		const s2 = await createAuthUser('sel');
		const [inv2] = await createBrokeredReconciliation(creator, s2.email);
		await admin()`update invites set expires_at = now() - interval '1 minute' where id = ${inv2.invite_id}::uuid`;
		await expectPgError(redeem(s2, inv2.plaintext_token), 'invite-expired');
		// revoked
		const s3 = await createAuthUser('sel');
		const [inv3] = await createBrokeredReconciliation(creator, s3.email);
		await admin()`update invites set revoked_at = now() where id = ${inv3.invite_id}::uuid`;
		await expectPgError(redeem(s3, inv3.plaintext_token), 'invite-revoked');
		// unknown token
		await expectPgError(redeem(s3, 'not-a-real-token'), 'invite-not-found');
		// the redeemed_at column stays null on every refused path
		const [n] = await admin()<
			{ n: number }[]
		>`select count(*)::int as n from invites where id in (${inv2.invite_id}::uuid, ${inv3.invite_id}::uuid) and redeemed_at is not null`;
		expect(n.n).toBe(0);
	});
});

describe('cancel / recall guards', () => {
	it('cancel allowed with one submitted, refused once both submitted; recall refused once the other submitted', async () => {
		const a = await blindTwoSided();
		await submitFigures(a.buyer, a.reconciliationId);
		// recall by the buyer is allowed while the seller has not submitted
		await asUser(a.buyer, (tx) => tx`select recall_figures(${a.reconciliationId}::uuid)`);
		expect(await submitFigures(a.buyer, a.reconciliationId)).toBe('open');
		// cancel by non-creator refused
		await expectPgError(
			asUser(a.buyer, (tx) => tx`select cancel_reconciliation(${a.reconciliationId}::uuid)`),
			'not-creator'
		);
		// cancel by creator with one submitted: allowed, invites revoked
		await asUser(a.broker, (tx) => tx`select cancel_reconciliation(${a.reconciliationId}::uuid)`);
		const [st] = await admin()<
			{ state: string }[]
		>`select state from reconciliations where id = ${a.reconciliationId}::uuid`;
		expect(st.state).toBe('cancelled');

		const b = await blindTwoSided();
		await submitFigures(b.buyer, b.reconciliationId);
		expect(await submitFigures(b.seller, b.reconciliationId)).toBe('locked');
		await expectPgError(
			asUser(b.seller, (tx) => tx`select recall_figures(${b.reconciliationId}::uuid)`),
			'reconciliation-not-open'
		);
		await expectPgError(
			asUser(b.broker, (tx) => tx`select cancel_reconciliation(${b.reconciliationId}::uuid)`),
			'reconciliation-not-open'
		);

		const c = await blindTwoSided();
		await submitFigures(c.buyer, c.reconciliationId);
		// The seller submits first; the buyer may not recall figures it has
		// not submitted, and once it submits (locking) may not recall either.
		const d = await blindTwoSided();
		await submitFigures(d.seller, d.reconciliationId);
		await expectPgError(
			asUser(d.buyer, (tx) => tx`select recall_figures(${d.reconciliationId}::uuid)`),
			'not-submitted'
		);
		expect(await submitFigures(d.buyer, d.reconciliationId)).toBe('locked');
		await expectPgError(
			asUser(d.buyer, (tx) => tx`select recall_figures(${d.reconciliationId}::uuid)`),
			'reconciliation-not-open'
		);
	});
	it('recall refused when the other side has already submitted (both submitted on an open reconciliation)', async () => {
		// Force the state directly: both rows submitted while the reconciliation is still open.
		const a = await blindTwoSided();
		await submitFigures(a.buyer, a.reconciliationId);
		await admin()`update figures set status = 'submitted' where reconciliation_id = ${a.reconciliationId}::uuid and side = 'seller'`;
		await expectPgError(
			asUser(a.buyer, (tx) => tx`select recall_figures(${a.reconciliationId}::uuid)`),
			'other-side-submitted'
		);
		await expectPgError(
			asUser(a.broker, (tx) => tx`select cancel_reconciliation(${a.reconciliationId}::uuid)`),
			'both-submitted'
		);
	});
});
