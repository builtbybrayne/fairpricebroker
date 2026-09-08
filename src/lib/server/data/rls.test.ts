// VERIFY item 2: focused adversarial authorisation tests.
import { afterAll, describe, expect, it } from 'vitest';
import {
	admin,
	asUser,
	closeAdmin,
	createAuthUser,
	expectPgError
} from '../../../../tests/helpers/db';
import {
	createBlindSession,
	createRecruitmentSession,
	enterPosition,
	redeem,
	submit
} from '../../../../tests/helpers/fixtures';
import { closeAllDb } from './db';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

async function blindTwoParty() {
	const host = await createAuthUser('host');
	const low = await createAuthUser('low');
	const high = await createAuthUser('high');
	const invites = await createBlindSession(host, low.email, high.email);
	const sessionId = invites[0].session_id;
	const lowInv = invites.find((i) => i.role === 'low-preferring')!;
	const highInv = invites.find((i) => i.role === 'high-preferring')!;
	await redeem(low, lowInv.plaintext_token);
	await redeem(high, highInv.plaintext_token);
	await enterPosition(low, sessionId, 'low-preferring');
	await enterPosition(high, sessionId, 'high-preferring');
	return { host, low, high, sessionId, lowInv, highInv };
}

describe('party isolation', () => {
	it('party A sees only their own party_positions row; B likewise; host sees none', async () => {
		const { host, low, high, sessionId } = await blindTwoParty();
		const seenByLow = await asUser(
			low,
			(tx) =>
				tx<
					{ direction: string }[]
				>`select direction from party_positions where session_id = ${sessionId}::uuid`
		);
		expect(seenByLow.map((r) => r.direction)).toEqual(['low-preferring']);
		const seenByHigh = await asUser(
			high,
			(tx) =>
				tx<
					{ direction: string }[]
				>`select direction from party_positions where session_id = ${sessionId}::uuid`
		);
		expect(seenByHigh.map((r) => r.direction)).toEqual(['high-preferring']);
		const seenByHost = await asUser(
			host,
			(tx) => tx`select direction from party_positions where session_id = ${sessionId}::uuid`
		);
		expect(seenByHost).toHaveLength(0);
		// Even an unfiltered scan returns only own rows.
		const all = await asUser(
			low,
			(tx) =>
				tx<
					{ direction: string; session_id: string }[]
				>`select direction, session_id from party_positions`
		);
		expect(all.every((r) => r.session_id === sessionId && r.direction === 'low-preferring')).toBe(
			true
		);
	});

	it("a party cannot update the counterparty's values (0 rows) nor set status directly", async () => {
		const { low, sessionId } = await blindTwoParty();
		const updated = await asUser(
			low,
			(tx) =>
				tx`update party_positions set v1 = 1 where session_id = ${sessionId}::uuid and direction = 'high-preferring'`
		);
		expect(updated.count).toBe(0);
		await expectPgError(
			asUser(
				low,
				(tx) =>
					tx`update party_positions set status = 'submitted' where session_id = ${sessionId}::uuid`
			),
			'permission denied'
		);
		await expectPgError(
			asUser(
				low,
				(tx) =>
					tx`update party_positions set submitted_at = now() where session_id = ${sessionId}::uuid`
			),
			'permission denied'
		);
		const [row] = await admin()<{ status: string; v1: string }[]>`
			select status, v1 from party_positions where session_id = ${sessionId}::uuid and direction = 'high-preferring'`;
		expect(row.status).toBe('draft');
		expect(row.v1).toBe('110');
	});

	it('a party cannot insert a row for the other direction or another session', async () => {
		const { low, sessionId } = await blindTwoParty();
		const other = await blindTwoParty();
		await expectPgError(
			asUser(
				low,
				(tx) => tx`insert into party_positions (session_id, direction, v1, v2, v3, v4)
			  values (${other.sessionId}::uuid, 'low-preferring', 1, 2, 3, 4)`
			),
			'row-level security'
		);
		await asUser(low, (tx) => tx`delete from party_positions where false`).catch(() => {});
		await expectPgError(
			asUser(
				low,
				(tx) => tx`insert into party_positions (session_id, direction, v1, v2, v3, v4)
			  values (${sessionId}::uuid, 'high-preferring', 1, 2, 3, 4)`
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
		'session_participants',
		'identities',
		'developer_grants',
		'purge_tombstone_log',
		'billing_reference',
		'credit_ledger',
		'activation_events'
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
	it('sessions/invites are filtered to own rows for an unrelated principal', async () => {
		const { sessionId } = await blindTwoParty();
		const stranger = await createAuthUser('stranger');
		const s = await asUser(
			stranger,
			(tx) => tx`select id from sessions where id = ${sessionId}::uuid`
		);
		expect(s).toHaveLength(0);
		const i = await asUser(
			stranger,
			(tx) => tx`select id from invites where session_id = ${sessionId}::uuid`
		);
		expect(i).toHaveLength(0);
	});
	it('create_invited_session is not directly executable by authenticated; anon cannot submit', async () => {
		const u = await createAuthUser('x');
		await expectPgError(
			asUser(
				u,
				(tx) =>
					tx`select * from create_invited_session('generic','GBP','creator-as-party',null,'low-preferring','[]'::jsonb)`
			),
			'permission denied'
		);
		await expectPgError(
			asUser(u, (tx) => tx`select submit_position(gen_random_uuid())`, 'anon'),
			'permission denied'
		);
	});
	it('a party cannot update sessions.state directly', async () => {
		const { low, sessionId } = await blindTwoParty();
		await expectPgError(
			asUser(low, (tx) => tx`update sessions set state = 'closed' where id = ${sessionId}::uuid`),
			'permission denied'
		);
	});
	it('a forged client-side host claim is ignored: is_session_host reads persisted membership only', async () => {
		const { low, sessionId } = await blindTwoParty();
		const r = await admin().begin(async (tx) => {
			await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: low.sub, email: low.email, role: 'authenticated', app_role: 'host', is_host: true })}, true)`;
			await tx`set local role authenticated`;
			return tx<
				{ h: boolean; d: boolean }[]
			>`select is_session_host(${sessionId}::uuid) as h, is_developer() as d`;
		});
		expect(r[0]).toEqual({ h: false, d: false });
	});
});

describe('redeem_invite guards', () => {
	it('refuses a second redemption, an expired invite, a revoked invite, and an email mismatch', async () => {
		const creator = await createAuthUser('rec');
		const candidate = await createAuthUser('cand');
		const [inv] = await createRecruitmentSession(creator, candidate.email);
		// wrong email (JWT email differs from invites.email)
		const impostor = await createAuthUser('imp');
		await expectPgError(redeem(impostor, inv.plaintext_token), 'email-mismatch');
		// email compare is case-insensitive
		const upper = { sub: candidate.sub, email: candidate.email.toUpperCase() };
		expect(await redeem(upper, inv.plaintext_token)).toBe(inv.session_id);
		// second redemption
		await expectPgError(redeem(candidate, inv.plaintext_token), 'invite-already-redeemed');
		// expired
		const c2 = await createAuthUser('cand');
		const [inv2] = await createRecruitmentSession(creator, c2.email);
		await admin()`update invites set expires_at = now() - interval '1 minute' where id = ${inv2.invite_id}::uuid`;
		await expectPgError(redeem(c2, inv2.plaintext_token), 'invite-expired');
		// revoked
		const c3 = await createAuthUser('cand');
		const [inv3] = await createRecruitmentSession(creator, c3.email);
		await admin()`update invites set revoked_at = now() where id = ${inv3.invite_id}::uuid`;
		await expectPgError(redeem(c3, inv3.plaintext_token), 'invite-revoked');
		// unknown token
		await expectPgError(redeem(c3, 'not-a-real-token'), 'invite-not-found');
		// the redeemed_at column stays null on every refused path
		const [n] = await admin()<
			{ n: number }[]
		>`select count(*)::int as n from invites where id in (${inv2.invite_id}::uuid, ${inv3.invite_id}::uuid) and redeemed_at is not null`;
		expect(n.n).toBe(0);
	});
});

describe('cancel / recall guards', () => {
	it('cancel allowed with one submitted, refused once both submitted; recall refused once the other submitted', async () => {
		const a = await blindTwoParty();
		await submit(a.low, a.sessionId);
		// recall by low is allowed while high has not submitted
		await asUser(a.low, (tx) => tx`select recall_position(${a.sessionId}::uuid)`);
		expect(await submit(a.low, a.sessionId)).toBe('open');
		// cancel by non-creator refused
		await expectPgError(
			asUser(a.low, (tx) => tx`select cancel_session(${a.sessionId}::uuid)`),
			'not-creator'
		);
		// cancel by creator with one submitted: allowed, invites revoked
		await asUser(a.host, (tx) => tx`select cancel_session(${a.sessionId}::uuid)`);
		const [st] = await admin()<
			{ state: string }[]
		>`select state from sessions where id = ${a.sessionId}::uuid`;
		expect(st.state).toBe('cancelled');

		const b = await blindTwoParty();
		await submit(b.low, b.sessionId);
		expect(await submit(b.high, b.sessionId)).toBe('locked');
		await expectPgError(
			asUser(b.high, (tx) => tx`select recall_position(${b.sessionId}::uuid)`),
			'session-not-open'
		);
		await expectPgError(
			asUser(b.host, (tx) => tx`select cancel_session(${b.sessionId}::uuid)`),
			'session-not-open'
		);

		const c = await blindTwoParty();
		await submit(c.low, c.sessionId);
		// high submits -> locked; low may not recall once high submitted. Simulate
		// the ordering where high has submitted but low tries to recall: use a
		// session where high submits first.
		const d = await blindTwoParty();
		await submit(d.high, d.sessionId);
		await expectPgError(
			asUser(d.low, (tx) => tx`select recall_position(${d.sessionId}::uuid)`),
			'not-submitted'
		);
		expect(await submit(d.low, d.sessionId)).toBe('locked');
		await expectPgError(
			asUser(d.low, (tx) => tx`select recall_position(${d.sessionId}::uuid)`),
			'session-not-open'
		);
	});
	it('recall refused when the other party has already submitted (both submitted on an open session)', async () => {
		// Force the state directly: both rows submitted while the session is still open.
		const a = await blindTwoParty();
		await submit(a.low, a.sessionId);
		await admin()`update party_positions set status = 'submitted' where session_id = ${a.sessionId}::uuid and direction = 'high-preferring'`;
		await expectPgError(
			asUser(a.low, (tx) => tx`select recall_position(${a.sessionId}::uuid)`),
			'other-party-submitted'
		);
		await expectPgError(
			asUser(a.host, (tx) => tx`select cancel_session(${a.sessionId}::uuid)`),
			'both-submitted'
		);
	});
});
