import { randomUUID } from 'node:crypto';
import type { TransactionSql } from 'postgres';
import { admin, asUser, createAuthUser, type TestUser } from './db';

export type Dir = 'low-preferring' | 'high-preferring';
export const OTHER: Record<Dir, Dir> = {
	'low-preferring': 'high-preferring',
	'high-preferring': 'low-preferring'
};

export interface CreatedInvite {
	session_id: string;
	invite_id: string;
	role: string;
	plaintext_token: string;
}

export async function signInAndGrant(user: TestUser): Promise<number> {
	return asUser(user, async (tx) => {
		const r = await tx<{ b: number }[]>`select grant_launch_credits() as b`;
		return r[0].b;
	});
}

/** Recruitment composition: creator = host + low-preferring; one invite (high). */
export async function createRecruitmentSession(
	creator: TestUser,
	inviteeEmail: string,
	opts: { visitId?: string | null; requestKey?: string } = {}
): Promise<CreatedInvite[]> {
	await signInAndGrant(creator);
	return asUser(
		creator,
		(tx) =>
			tx<CreatedInvite[]>`
			select * from launch_invited_session(
				${opts.requestKey ?? randomUUID()}, 'recruitment', 'GBP', 'creator-as-host',
				${opts.visitId ?? null}::uuid, 'low-preferring',
				${tx.json([{ role: 'high-preferring', email: inviteeEmail }])}
			)
		`
	);
}

/** Blind composition: creator = host only; two party invites. */
export async function createBlindSession(
	creator: TestUser,
	lowEmail: string,
	highEmail: string
): Promise<CreatedInvite[]> {
	await signInAndGrant(creator);
	return asUser(
		creator,
		(tx) =>
			tx<CreatedInvite[]>`
			select * from launch_invited_session(
				${randomUUID()}, 'generic', 'GBP', 'creator-as-host', null::uuid, null,
				${tx.json([
					{ role: 'low-preferring', email: lowEmail },
					{ role: 'high-preferring', email: highEmail }
				])}
			)
		`
	);
}

export async function redeem(user: TestUser, token: string): Promise<string> {
	return asUser(user, async (tx) => {
		const r = await tx<{ s: string }[]>`select redeem_invite(${token}) as s`;
		return r[0].s;
	});
}

export const LOW_TUPLE = ['100', '120', '140', '160'];
export const HIGH_TUPLE = ['110', '130', '150', '170'];

export async function enterPosition(
	user: TestUser,
	sessionId: string,
	direction: Dir,
	tuple: string[] = direction === 'low-preferring' ? LOW_TUPLE : HIGH_TUPLE
): Promise<void> {
	await asUser(user, async (tx) => {
		await tx`
			insert into party_positions (session_id, direction, v1, v2, v3, v4)
			values (${sessionId}::uuid, ${direction}, ${tuple[0]}::numeric, ${tuple[1]}::numeric,
			        ${tuple[2]}::numeric, ${tuple[3]}::numeric)
		`;
	});
}

export async function submit(user: TestUser, sessionId: string): Promise<string> {
	return asUser(user, async (tx) => {
		const r = await tx<{ s: string }[]>`select submit_position(${sessionId}::uuid) as s`;
		return r[0].s;
	});
}

export async function sessionState(sessionId: string): Promise<string> {
	const r = await admin()<
		{ state: string }[]
	>`select state from sessions where id = ${sessionId}::uuid`;
	return r[0].state;
}

/** A recruitment session taken to `locked` with both positions submitted. */
export async function lockedRecruitmentSession(): Promise<{
	creator: TestUser;
	candidate: TestUser;
	sessionId: string;
}> {
	const creator = await createAuthUser('rec');
	const candidate = await createAuthUser('cand');
	const [inv] = await createRecruitmentSession(creator, candidate.email);
	await redeem(candidate, inv.plaintext_token);
	await enterPosition(creator, inv.session_id, 'low-preferring');
	await enterPosition(candidate, inv.session_id, 'high-preferring');
	await submit(creator, inv.session_id);
	const s = await submit(candidate, inv.session_id);
	if (s !== 'locked') throw new Error(`expected locked, got ${s}`);
	return { creator, candidate, sessionId: inv.session_id };
}

export async function withUser<T>(
	user: TestUser,
	fn: (tx: TransactionSql) => Promise<T>
): Promise<T> {
	return asUser(user, fn);
}
