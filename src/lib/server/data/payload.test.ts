// VERIFY item 3: payload golden key-set tests per viewer class (side /
// broker-blind / broker-full / developer), plus the static egress checks
// (§2.11).
import { execFileSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import type { JSONValue } from 'postgres';
import type { ReconcileResult } from '$lib/server/engine';
import { admin, asUser, closeAdmin, createAuthUser } from '../../../../tests/helpers/db';
import { closeAllDb } from './db';
import {
	constructPayload,
	DEVELOPER_ONLY_KEYS,
	getBrokerSeesFigures,
	PER_SIDE_SAFE_KEYS,
	RAW_INPUT_KEYS
} from './payloadConstructor';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

const pp = (n: number) => ({ float: n, decimal: n.toFixed(4) });
function fixture(zone: 'comfort' | 'deal' | 'no-deal'): ReconcileResult {
	return {
		zone,
		hasComfortZone: zone === 'comfort',
		overlap: zone !== 'no-deal',
		overlapLow: pp(120),
		overlapHigh: pp(140),
		dealLow: pp(110),
		dealHigh: pp(150),
		gap: pp(zone === 'no-deal' ? 30 : 0),
		fairPrice: pp(130),
		convergenceAchieved: true,
		convergedTrivially: false,
		layers: [{ methods: [{ name: 'm', value: 1 }], values: [1], spread: 0 }],
		distances: {
			'low-preferring': pp(zone === 'no-deal' ? 12 : 0),
			'high-preferring': pp(zone === 'no-deal' ? 18 : 0)
		},
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
		curves: [{ price: 1, low: 0, high: 1, joint: 0 }],
		input: {
			'low-preferring': { tuple: ['100', '120', '140', '160'] },
			'high-preferring': { tuple: ['110', '130', '150', '170'] }
		},
		meta: {
			inflection: 'reconciliation',
			algorithmVersion: 'reconciliation/1',
			numericPolicyVersion: 'np/1',
			honestySignalSetVersion: 'honesty/1',
			engineVersion: '0.1.0',
			toleranceMode: 'relative-r1'
		}
	} as unknown as ReconcileResult;
}

/** Top-level keys, with distances/input/honesty expanded one level. */
function keyPaths(payload: Record<string, unknown>): string[] {
	const out: string[] = [];
	for (const k of Object.keys(payload)) {
		if (['distances', 'input', 'honesty'].includes(k)) {
			for (const sub of Object.keys(payload[k] as Record<string, unknown>)) out.push(`${k}.${sub}`);
		} else out.push(k);
	}
	return out.sort();
}
const sorted = (xs: readonly string[]) => [...xs].sort();

/** A closed reconciliation with a stored result and one bound principal per seat. */
async function fixtureReconciliation(brokerSees: boolean, zone: 'comfort' | 'deal' | 'no-deal') {
	const broker = await createAuthUser('broker');
	const buyer = await createAuthUser('buyer');
	const seller = await createAuthUser('seller');
	const dev = await createAuthUser('dev');
	const stranger = await createAuthUser('stranger');
	const [r] = await admin()<{ id: string }[]>`
		insert into reconciliations (kind, vertical, broker_sees_figures, currency, state)
		values ('invited', ${brokerSees ? 'salary-negotiation' : 'generic'}, ${brokerSees}, 'GBP', 'closed')
		returning id`;
	await admin()`insert into participants (reconciliation_id, seat, bound_auth_uid) values (${r.id}::uuid, 'broker', ${broker.sub}::uuid)`;
	await admin()`insert into participants (reconciliation_id, seat, bound_auth_uid) values (${r.id}::uuid, 'buyer', ${buyer.sub}::uuid)`;
	await admin()`insert into participants (reconciliation_id, seat, bound_auth_uid) values (${r.id}::uuid, 'seller', ${seller.sub}::uuid)`;
	await admin()`insert into developer_grants (auth_uid, granted_by) values (${dev.sub}::uuid, 'test')`;
	await admin()`insert into results (reconciliation_id, payload, engine_version, algorithm_version)
	              values (${r.id}::uuid, ${admin().json(fixture(zone) as unknown as JSONValue)}, '0.1.0', 'reconciliation/1')`;
	return { reconciliationId: r.id, broker, buyer, seller, dev, stranger };
}

// The stored payload keeps the engine's keys: the buyer IS the
// low-preferring side, the seller the high-preferring one. Spelling the
// keys out here (rather than through OWN_*_KEY) pins that mapping.
const SIDE_BUYER = sorted([
	...PER_SIDE_SAFE_KEYS,
	'distances.low-preferring',
	'input.low-preferring'
]);
const SIDE_SELLER = sorted([
	...PER_SIDE_SAFE_KEYS,
	'distances.high-preferring',
	'input.high-preferring'
]);
const BROKER_BLIND = sorted([
	...PER_SIDE_SAFE_KEYS,
	'distances.low-preferring',
	'distances.high-preferring'
]);
const BROKER_FULL = sorted([...BROKER_BLIND, ...RAW_INPUT_KEYS]);
const DEVELOPER = sorted([...BROKER_FULL, ...DEVELOPER_ONLY_KEYS]);

describe('payload classes', () => {
	for (const zone of ['comfort', 'deal', 'no-deal'] as const) {
		for (const brokerSees of [false, true]) {
			const label = brokerSees ? 'broker-full' : 'broker-blind';
			it(`${zone} / ${label}: side, broker, developer, none`, async () => {
				const f = await fixtureReconciliation(brokerSees, zone);
				const build = (u: { sub: string; email: string }) =>
					asUser(u, (tx) => constructPayload(tx, f.reconciliationId));

				const buyer = await build(f.buyer);
				expect(keyPaths(buyer)).toEqual(SIDE_BUYER);
				expect(buyer).not.toHaveProperty(['distances', 'high-preferring']);
				expect(buyer).not.toHaveProperty(['input', 'high-preferring']);
				if (zone === 'no-deal') {
					expect(
						(buyer.distances as Record<string, { float: number }>)['low-preferring'].float
					).not.toBe(0);
				}
				const seller = await build(f.seller);
				expect(keyPaths(seller)).toEqual(SIDE_SELLER);
				expect(seller).not.toHaveProperty(['input', 'low-preferring']);

				const broker = await build(f.broker);
				expect(keyPaths(broker)).toEqual(brokerSees ? BROKER_FULL : BROKER_BLIND);
				for (const k of ['layers', 'honesty', 'curves', 'gap', 'overlap', 'hasComfortZone']) {
					expect(broker).not.toHaveProperty(k);
				}

				const dev = await build(f.dev);
				expect(keyPaths(dev)).toEqual(DEVELOPER);
				expect(keyPaths(dev)).toEqual(
					keyPaths(fixture(zone) as unknown as Record<string, unknown>)
				);

				await expect(build(f.stranger)).rejects.toThrow('no resolvable viewer');

				// R11: the pre-entry disclosure fact, as a boolean
				expect(await asUser(f.buyer, (tx) => getBrokerSeesFigures(tx, f.reconciliationId))).toBe(
					brokerSees
				);
				expect(await asUser(f.broker, (tx) => getBrokerSeesFigures(tx, f.reconciliationId))).toBe(
					brokerSees
				);
				await expect(
					asUser(f.stranger, (tx) => getBrokerSeesFigures(tx, f.reconciliationId))
				).rejects.toThrow('no-seat');
			});
		}
	}
});

describe('static egress checks', () => {
	const grep = (pattern: string) => {
		try {
			return execFileSync('grep', ['-rl', pattern, 'src', '--include=*.ts'], { encoding: 'utf8' })
				.trim()
				.split('\n')
				.filter(Boolean)
				.sort();
		} catch {
			return [] as string[];
		}
	};
	it('rawResultReader is imported only by payloadConstructor', () => {
		const hits = grep('rawResultReader').filter(
			(f) => !f.endsWith('.test.ts') && f !== 'src/lib/server/data/rawResultReader.ts'
		);
		expect(hits).toEqual(['src/lib/server/data/payloadConstructor.ts']);
	});
	it("a broker viewer's `full` is computed only in principal.ts", () => {
		const assigning = grep("kind: 'broker', full:").filter((f) => !f.endsWith('.test.ts'));
		expect(assigning).toEqual(['src/lib/server/data/principal.ts']);
	});
	it('constructCasualPayload does not exist in src', () => {
		expect(grep('constructCasualPayload').filter((f) => !f.endsWith('.test.ts'))).toEqual([]);
	});
	it('SUPABASE_SERVICE_ROLE_KEY is referenced only under src/lib/server/auth', () => {
		expect(
			grep('SUPABASE_SERVICE_ROLE_KEY').filter(
				(f) => !f.startsWith('src/lib/server/auth/') && !f.endsWith('.test.ts')
			)
		).toEqual([]);
	});
});
