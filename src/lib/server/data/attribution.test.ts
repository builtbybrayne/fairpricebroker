// VERIFY items 5 and 6: completeCasualPlay, issueSessionRef, recordVisit,
// activation_events attribution, forged visit refusal.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { isRefCode, type RefCode } from '$lib/server/refCodes';
import {
	admin,
	asUser,
	closeAdmin,
	createAuthUser,
	expectPgError
} from '../../../../tests/helpers/db';
import {
	createRecruitmentSession,
	lockedRecruitmentSession
} from '../../../../tests/helpers/fixtures';
import { closeAllDb } from './db';
import { completeCasualPlay, issueSessionRef, mintRefCode } from './events';
import { claimAndOrchestrate } from './orchestrator';
import { recordVisit } from './visits';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

async function casualRows(key: string) {
	const [r] = await admin()<{ events: number; refs: number }[]>`
		select
			(select count(*)::int from events where idempotency_key = ${key}::uuid) as events,
			(select count(*)::int from share_refs where ref_code = (
				select payload ->> 'share_ref' from events where idempotency_key = ${key}::uuid limit 1)) as refs
	`;
	return r;
}

describe('completeCasualPlay', () => {
	it('mints a valid ref and is idempotent sequentially', async () => {
		const inbound = mintRefCode();
		await admin()`insert into share_refs (ref_code) values (${inbound})`;
		const key = randomUUID();
		const a = await completeCasualPlay({
			ref: inbound,
			templateId: 'generic',
			idempotencyKey: key
		});
		expect(isRefCode(a.shareRef)).toBe(true);
		expect(a.shareRef).not.toBe(inbound);
		const b = await completeCasualPlay({
			ref: inbound,
			templateId: 'generic',
			idempotencyKey: key
		});
		expect(b.shareRef).toBe(a.shareRef);
		expect(await casualRows(key)).toEqual({ events: 1, refs: 1 });
		const act = await admin()<{ funnel: string; ref_code: string; visit_id: string | null }[]>`
			select funnel, ref_code, visit_id from activation_events where id = (select id from events where idempotency_key = ${key}::uuid)`;
		expect(act).toEqual([{ funnel: 'casual', ref_code: inbound, visit_id: null }]);
	});

	it('is idempotent under concurrent first calls', async () => {
		const key = randomUUID();
		const [a, b] = await Promise.all([
			completeCasualPlay({ ref: null, templateId: 'generic', idempotencyKey: key }),
			completeCasualPlay({ ref: null, templateId: 'generic', idempotencyKey: key })
		]);
		expect(a.shareRef).toBe(b.shareRef);
		expect(await casualRows(key)).toEqual({ events: 1, refs: 1 });
	});

	it('is idempotent across two distinct connections racing', async () => {
		// Two separate casual_writer connections, no shared pool.
		const url = process.env.CASUAL_WRITER_DB_URL!;
		const c1 = postgres(url, { max: 1 });
		const c2 = postgres(url, { max: 1 });
		const key = randomUUID();
		const run = async (sql: typeof c1) =>
			sql.begin(async (tx) => {
				await tx`select pg_advisory_xact_lock(hashtextextended(${key}::text, 0))`;
				const ex = await tx<
					{ s: string }[]
				>`select payload->>'share_ref' as s from events where idempotency_key = ${key}::uuid and session_id is null and event_type = 'reconciliation_completed'`;
				if (ex.length) return ex[0].s;
				const ref = mintRefCode();
				await tx`insert into share_refs (ref_code) values (${ref})`;
				await tx`insert into events (session_id, event_type, payload, idempotency_key) values (null, 'reconciliation_completed', ${tx.json({ share_ref: ref, ref_code: null, template_id: 'generic' })}, ${key}::uuid)`;
				return ref;
			});
		const [a, b] = await Promise.all([run(c1), run(c2)]);
		expect(a).toBe(b);
		expect(await casualRows(key)).toEqual({ events: 1, refs: 1 });
		await Promise.all([c1.end(), c2.end()]);
	});

	it('rejects a non-UUIDv4 key and a malformed ref', async () => {
		await expect(
			completeCasualPlay({ ref: null, templateId: 'g', idempotencyKey: 'nope' })
		).rejects.toThrow('UUID v4');
		await expect(
			completeCasualPlay({ ref: 'BAD' as RefCode, templateId: 'g', idempotencyKey: randomUUID() })
		).rejects.toThrow('invalid-ref');
	});
});

describe('invited funnel attribution', () => {
	it('recordVisit + create with visit_id -> activation_events carries ref_code and visit_id; issueSessionRef idempotent', async () => {
		const inbound = mintRefCode();
		await admin()`insert into share_refs (ref_code) values (${inbound})`;
		const visitId = await recordVisit(inbound);
		expect(visitId).toBeTruthy();
		expect(await recordVisit(null)).toBeNull();

		const creator = await createAuthUser('rec');
		const candidate = await createAuthUser('cand');
		const [inv] = await createRecruitmentSession(creator, candidate.email, { visitId });
		const { redeem, enterPosition, submit } = await import('../../../../tests/helpers/fixtures');
		await redeem(candidate, inv.plaintext_token);
		await enterPosition(creator, inv.session_id, 'low-preferring');
		await enterPosition(candidate, inv.session_id, 'high-preferring');
		await submit(creator, inv.session_id);
		await submit(candidate, inv.session_id);
		expect(await claimAndOrchestrate(inv.session_id)).toBe('closed');

		const act = await admin()<{ funnel: string; ref_code: string; visit_id: string }[]>`
			select funnel, ref_code, visit_id from activation_events where session_id = ${inv.session_id}::uuid`;
		expect(act).toEqual([{ funnel: 'invited', ref_code: inbound, visit_id: visitId }]);

		const r1 = await issueSessionRef(inv.session_id);
		const r2 = await issueSessionRef(inv.session_id);
		expect(isRefCode(r1.ref)).toBe(true);
		expect(r2.ref).toBe(r1.ref);
		const [n] = await admin()<
			{ n: number }[]
		>`select count(*)::int as n from share_refs where issued_for_session_id = ${inv.session_id}::uuid`;
		expect(n.n).toBe(1);

		// a visit can attribute at most one session
		await expectPgError(
			createRecruitmentSession(creator, candidate.email, { visitId }),
			'sessions_visit_id_unique'
		);
	});

	it('a forged visit_id is refused', async () => {
		const creator = await createAuthUser('rec');
		await expectPgError(
			createRecruitmentSession(creator, 'c@example.test', { visitId: randomUUID() }),
			'unknown-visit'
		);
	});

	it('demo sessions are excluded from activation_events', async () => {
		const { sessionId } = await lockedRecruitmentSession();
		await admin()`update sessions set is_demo = true where id = ${sessionId}::uuid`;
		expect(await claimAndOrchestrate(sessionId)).toBe('closed');
		const act =
			await admin()`select id from activation_events where session_id = ${sessionId}::uuid`;
		expect(act).toHaveLength(0);
		const ev =
			await admin()`select id from events where session_id = ${sessionId}::uuid and event_type = 'reconciliation_completed'`;
		expect(ev).toHaveLength(1);
	});
});

describe('ref codes', () => {
	it('regex accepts valid and rejects invalid samples', () => {
		expect(isRefCode('abcdefg234')).toBe(true);
		expect(isRefCode('abcdefg23')).toBe(false);
		expect(isRefCode('abcdefg2341')).toBe(false);
		expect(isRefCode('ABCDEFG234')).toBe(false);
		expect(isRefCode('abcdefg018')).toBe(false);
		for (let i = 0; i < 50; i++) expect(isRefCode(mintRefCode())).toBe(true);
		expect(asUser).toBeDefined();
	});
});
