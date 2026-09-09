// T3-m1-recruitment-core §4 V4 (R11 negative + R7) in the T3-m2 vocabulary:
// a reconciliation in a blind vertical issues no pre-entry disclosure and
// never a broker-full payload; a salary-negotiation reconciliation does
// both. The blind fixture goes straight to Postgres because the UI cannot
// create a reconciliation in a vertical that is not ready.
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { JSONValue } from 'postgres';
import {
	admin,
	asUser,
	closeAdmin,
	createAuthUser,
	type TestUser
} from '../../../../tests/helpers/db';
import { createBrokeredReconciliation, redeem } from '../../../../tests/helpers/fixtures';
import { closeAllDb } from '$lib/server/data/db';
import { constructPayload, getBrokerSeesFigures } from '$lib/server/data/payloadConstructor';
import { brokerFullResult, disclosureRequired, sideResult } from './reconciliations';
import { parseTuple } from './figures';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

const pp = (n: number) => ({ float: n, decimal: String(n) });
// The stored payload keeps the engine's keys (T3-m2 word map).
const RESULT = {
	zone: 'deal',
	fairPrice: pp(130),
	convergenceAchieved: true,
	convergedTrivially: false,
	distances: { 'low-preferring': pp(0), 'high-preferring': pp(0) },
	honesty: {
		'low-preferring': {
			skewness: { value: 0 },
			kurtosis: { value: 0 },
			rangeCompression: 1,
			signalSetVersion: 'honesty/1'
		},
		'high-preferring': {
			skewness: { value: 0 },
			kurtosis: { value: 0 },
			rangeCompression: 1,
			signalSetVersion: 'honesty/1'
		}
	},
	input: {
		'low-preferring': { tuple: ['100', '120', '140', '160'] },
		'high-preferring': { tuple: ['110.1234', '130', '150', '170'] }
	},
	meta: { engineVersion: '0.1.0', algorithmVersion: 'reconciliation/1' }
};

async function closeWithResult(reconciliationId: string) {
	await admin()`update reconciliations set state = 'closed' where id = ${reconciliationId}::uuid`;
	await admin()`insert into results (reconciliation_id, payload, engine_version, algorithm_version)
	              values (${reconciliationId}::uuid, ${admin().json(RESULT as unknown as JSONValue)}, '0.1.0', 'reconciliation/1')`;
}

interface Launched {
	reconciliation_id: string;
	invite_id: string;
	seat: string;
	plaintext_token: string;
}

/** A pure-broker reconciliation in a vertical whose broker does not see figures. */
async function createBlindReconciliation(
	creator: TestUser,
	buyerEmail: string,
	sellerEmail: string
): Promise<Launched[]> {
	await asUser(creator, (tx) => tx`select grant_launch_credits()`);
	return asUser(
		creator,
		(tx) =>
			tx<Launched[]>`
			select * from launch_reconciliation(
				${randomUUID()}, 'founders', 'GBP', 'broker', null, null::uuid,
				${tx.json([
					{ seat: 'buyer', email: buyerEmail },
					{ seat: 'seller', email: sellerEmail }
				])}
			)
		`
	);
}

describe('V4: blind vertical negative', () => {
	it('a blind-vertical reconciliation renders no disclosure and issues broker-blind, never broker-full', async () => {
		const broker = await createAuthUser('bbroker');
		const buyer = await createAuthUser('bbuyer');
		const seller = await createAuthUser('bseller');
		const invites = await createBlindReconciliation(broker, buyer.email, seller.email);
		const reconciliationId = invites[0].reconciliation_id;
		for (const inv of invites) {
			await redeem(inv.seat === 'buyer' ? buyer : seller, inv.plaintext_token);
		}
		const sees = await asUser(seller, (tx) => getBrokerSeesFigures(tx, reconciliationId));
		expect(sees).toBe(false);
		expect(disclosureRequired(sees)).toBe(false);

		await closeWithResult(reconciliationId);
		const brokerPayload = await asUser(broker, (tx) => constructPayload(tx, reconciliationId));
		expect(brokerPayload).not.toHaveProperty('input');
		await expect(brokerFullResult(broker, reconciliationId)).rejects.toThrow('not broker-full');

		const side = await sideResult(seller, reconciliationId, 'seller');
		expect(side.own).toEqual(['110.1234', '130', '150', '170']);
		expect(side.fair).toBe('130');
	});

	it('a salary-negotiation reconciliation renders the disclosure and issues broker-full', async () => {
		const consultant = await createAuthUser('rcons');
		const candidate = await createAuthUser('rcand');
		const [inv] = await createBrokeredReconciliation(consultant, candidate.email);
		await redeem(candidate, inv.plaintext_token);
		const sees = await asUser(candidate, (tx) => getBrokerSeesFigures(tx, inv.reconciliation_id));
		expect(sees).toBe(true);
		expect(disclosureRequired(sees)).toBe(true);

		await closeWithResult(inv.reconciliation_id);
		const full = await brokerFullResult(consultant, inv.reconciliation_id);
		expect(full.figures.buyer).toEqual(['100', '120', '140', '160']);
		expect(full.figures.seller[0]).toBe('110.1234'); // V5: precision preserved through the payload
		expect(full.guidance.overlap).toBe('stretch');
		// The candidate's own view still carries no hiring-company figure.
		const side = await sideResult(candidate, inv.reconciliation_id, 'seller');
		expect(JSON.stringify(side)).not.toContain('"100"');
	});
});

describe('parseTuple', () => {
	it('keeps four decimal places and strips thousands separators', () => {
		const r = parseTuple(['41,250', '46 500', '51750.5', '57800.1234']);
		expect(r).toEqual({ ok: true, tuple: ['41250', '46500', '51750.5', '57800.1234'] });
	});
	it('rejects non-ascending, empty and over-precise entries', () => {
		expect(parseTuple(['1', '2', '2', '4']).ok).toBe(false);
		expect(parseTuple(['1', '', '3', '4']).ok).toBe(false);
		expect(parseTuple(['1.00001', '2', '3', '4']).ok).toBe(false);
	});
});
