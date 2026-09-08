// T3-m1-data-core §2.8: visit capture, under the ref_writer role.
import { randomUUID } from 'node:crypto';
import type { RefCode } from '$lib/server/refCodes';
import { roleDb } from './db';

export async function recordVisit(refCode: RefCode | null): Promise<string | null> {
	if (refCode === null) return null;
	// The id is minted here rather than RETURNING'd: RETURNING would need a
	// SELECT grant + policy on visits for ref_writer, widening its footprint.
	const id = randomUUID();
	await roleDb('ref_writer')`insert into visits (id, ref_code) values (${id}::uuid, ${refCode})`;
	return id;
}
