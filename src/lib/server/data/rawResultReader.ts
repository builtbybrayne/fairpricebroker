// T3-m1-data-core §2.7: the ONLY module permitted to select from `results`,
// under the dedicated payload_reader login role. Sole egress from that
// table; a static test asserts no other importer exists.
import { roleDb } from './db';

export async function readRawResult(reconciliationId: string): Promise<unknown> {
	const rows = await roleDb('payload_reader')<{ payload: unknown }[]>`
		select payload from results where reconciliation_id = ${reconciliationId}::uuid
	`;
	if (rows.length === 0) throw new Error('no result for this reconciliation');
	return rows[0].payload;
}
