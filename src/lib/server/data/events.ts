// T3-m1-data-core §2.8 / seam contract v2: completeCasualPlay and
// issueSessionRef — each ONE transaction, advisory-locked on its key,
// idempotent as a whole with a conflict re-read.
import { randomBytes } from 'node:crypto';
import { isRefCode, type RefCode } from '$lib/server/refCodes';
import { roleDb } from './db';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

export function mintRefCode(): RefCode {
	const bytes = randomBytes(10);
	let out = '';
	for (const b of bytes) out += BASE32[b & 31];
	if (!isRefCode(out)) throw new Error('minted ref failed its own grammar');
	return out;
}

function isUniqueViolation(e: unknown): boolean {
	return typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';
}

export async function completeCasualPlay(input: {
	ref: RefCode | null;
	templateId: string;
	idempotencyKey: string;
}): Promise<{ shareRef: RefCode }> {
	if (!UUID_V4.test(input.idempotencyKey)) throw new Error('idempotencyKey must be a UUID v4');
	if (input.ref !== null && !isRefCode(input.ref)) throw new Error('invalid-ref');
	const sql = roleDb('casual_writer');
	return sql.begin(async (tx) => {
		await tx`select pg_advisory_xact_lock(hashtextextended(${input.idempotencyKey}::text, 0))`;
		const replay = async () =>
			tx<{ share_ref: string }[]>`
				select payload ->> 'share_ref' as share_ref from events
				where idempotency_key = ${input.idempotencyKey}::uuid
					and session_id is null and event_type = 'reconciliation_completed'
			`;
		const existing = await replay();
		if (existing.length > 0) return { shareRef: existing[0].share_ref as RefCode };
		const shareRef = mintRefCode();
		const payload = { template_id: input.templateId, ref_code: input.ref, share_ref: shareRef };
		try {
			await tx.savepoint(async (sp) => {
				await sp`insert into share_refs (ref_code, issued_for_session_id) values (${shareRef}, null)`;
				await sp`
					insert into events (session_id, event_type, payload, idempotency_key)
					values (null, 'reconciliation_completed', ${sp.json(payload)}, ${input.idempotencyKey}::uuid)
				`;
			});
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
			const winner = await replay();
			if (winner.length === 0) throw e;
			return { shareRef: winner[0].share_ref as RefCode };
		}
		return { shareRef };
	});
}

export async function issueSessionRef(sessionId: string): Promise<{ ref: RefCode }> {
	const sql = roleDb('orchestrator');
	return sql.begin(async (tx) => {
		await tx`select pg_advisory_xact_lock(hashtextextended(${sessionId}::text, 0))`;
		const replay = async () =>
			tx<{ ref_code: string }[]>`
				select ref_code from share_refs where issued_for_session_id = ${sessionId}::uuid
			`;
		const existing = await replay();
		if (existing.length > 0) return { ref: existing[0].ref_code as RefCode };
		const ref = mintRefCode();
		try {
			await tx.savepoint(async (sp) => {
				await sp`insert into share_refs (ref_code, issued_for_session_id) values (${ref}, ${sessionId}::uuid)`;
			});
		} catch (e) {
			if (!isUniqueViolation(e)) throw e;
			const winner = await replay();
			if (winner.length === 0) throw e;
			return { ref: winner[0].ref_code as RefCode };
		}
		return { ref };
	});
}
