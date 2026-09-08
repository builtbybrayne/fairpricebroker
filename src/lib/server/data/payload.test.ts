// VERIFY item 3: payload golden key-set tests per viewer class, plus the
// static egress checks (§2.11).
import { execFileSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import type { JSONValue } from 'postgres';
import type { ReconcileResult } from '$lib/server/engine';
import { admin, asUser, closeAdmin, createAuthUser } from '../../../../tests/helpers/db';
import { closeAllDb } from './db';
import {
	constructInvitedPayload,
	DEVELOPER_ONLY_KEYS,
	getVisibilityDisclosure,
	PER_PARTY_SAFE_KEYS,
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

async function fixtureSession(
	visibility: 'blind' | 'host-visible',
	zone: 'comfort' | 'deal' | 'no-deal'
) {
	const host = await createAuthUser('host');
	const low = await createAuthUser('low');
	const high = await createAuthUser('high');
	const dev = await createAuthUser('dev');
	const stranger = await createAuthUser('stranger');
	const [s] = await admin()<{ id: string }[]>`
		insert into sessions (type, composition, template_id, host_visibility, currency, state)
		values ('invited', 'creator-as-host', ${visibility === 'host-visible' ? 'recruitment' : 'generic'}, ${visibility}, 'GBP', 'closed')
		returning id`;
	await admin()`insert into session_participants (session_id, is_host, bound_auth_uid) values (${s.id}::uuid, true, ${host.sub}::uuid)`;
	await admin()`insert into session_participants (session_id, direction, bound_auth_uid) values (${s.id}::uuid, 'low-preferring', ${low.sub}::uuid)`;
	await admin()`insert into session_participants (session_id, direction, bound_auth_uid) values (${s.id}::uuid, 'high-preferring', ${high.sub}::uuid)`;
	await admin()`insert into developer_grants (auth_uid, granted_by) values (${dev.sub}::uuid, 'test')`;
	await admin()`insert into results (session_id, payload, engine_version, algorithm_version)
	              values (${s.id}::uuid, ${admin().json(fixture(zone) as unknown as JSONValue)}, '0.1.0', 'reconciliation/1')`;
	return { sessionId: s.id, host, low, high, dev, stranger };
}

const PARTY_LOW = sorted([
	...PER_PARTY_SAFE_KEYS,
	'distances.low-preferring',
	'input.low-preferring'
]);
const PARTY_HIGH = sorted([
	...PER_PARTY_SAFE_KEYS,
	'distances.high-preferring',
	'input.high-preferring'
]);
const BLIND_HOST = sorted([
	...PER_PARTY_SAFE_KEYS,
	'distances.low-preferring',
	'distances.high-preferring'
]);
const HOST_FULL = sorted([...BLIND_HOST, ...RAW_INPUT_KEYS]);
const DEVELOPER = sorted([...HOST_FULL, ...DEVELOPER_ONLY_KEYS]);

describe('payload classes', () => {
	for (const zone of ['comfort', 'deal', 'no-deal'] as const) {
		for (const visibility of ['blind', 'host-visible'] as const) {
			it(`${zone} / ${visibility}: party, host, developer, none`, async () => {
				const f = await fixtureSession(visibility, zone);
				const build = (u: { sub: string; email: string }) =>
					asUser(u, (tx) => constructInvitedPayload(tx, f.sessionId));

				const low = await build(f.low);
				expect(keyPaths(low)).toEqual(PARTY_LOW);
				expect(low).not.toHaveProperty(['distances', 'high-preferring']);
				expect(low).not.toHaveProperty(['input', 'high-preferring']);
				if (zone === 'no-deal') {
					expect(
						(low.distances as Record<string, { float: number }>)['low-preferring'].float
					).not.toBe(0);
				}
				const high = await build(f.high);
				expect(keyPaths(high)).toEqual(PARTY_HIGH);

				const host = await build(f.host);
				expect(keyPaths(host)).toEqual(visibility === 'host-visible' ? HOST_FULL : BLIND_HOST);
				for (const k of ['layers', 'honesty', 'curves', 'gap', 'overlap', 'hasComfortZone']) {
					expect(host).not.toHaveProperty(k);
				}

				const dev = await build(f.dev);
				expect(keyPaths(dev)).toEqual(DEVELOPER);
				expect(keyPaths(dev)).toEqual(
					keyPaths(fixture(zone) as unknown as Record<string, unknown>)
				);

				await expect(build(f.stranger)).rejects.toThrow('no resolvable role');

				// pre-entry disclosure fact
				expect(await asUser(f.low, (tx) => getVisibilityDisclosure(tx, f.sessionId))).toBe(
					visibility
				);
				await expect(
					asUser(f.stranger, (tx) => getVisibilityDisclosure(tx, f.sessionId))
				).rejects.toThrow('no-role');
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
	it('hostFull is computed only in principal.ts', () => {
		const assigning = grep('hostFull:').filter((f) => !f.endsWith('.test.ts'));
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
