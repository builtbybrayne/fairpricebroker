// T3-m1-recruitment-core §4 V4 (R11 negative + R7): a blind template
// session issues no pre-entry disclosure and never a host-full payload;
// the recruitment session does both. Fixture sessions go straight to
// Postgres because the UI cannot create a 'generic' session.
import { afterAll, describe, expect, it } from 'vitest';
import type { JSONValue } from 'postgres';
import { admin, asUser, closeAdmin, createAuthUser } from '../../../../tests/helpers/db';
import {
	createBlindSession,
	createRecruitmentSession,
	redeem
} from '../../../../tests/helpers/fixtures';
import { closeAllDb } from '$lib/server/data/db';
import {
	constructInvitedPayload,
	getVisibilityDisclosure
} from '$lib/server/data/payloadConstructor';
import { disclosureRequired, hostFullResult, partyResult } from './sessions';
import { parseTuple } from './positions';

afterAll(async () => {
	await closeAllDb();
	await closeAdmin();
});

const pp = (n: number) => ({ float: n, decimal: String(n) });
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

async function closeWithResult(sessionId: string) {
	await admin()`update sessions set state = 'closed' where id = ${sessionId}::uuid`;
	await admin()`insert into results (session_id, payload, engine_version, algorithm_version)
	              values (${sessionId}::uuid, ${admin().json(RESULT as unknown as JSONValue)}, '0.1.0', 'reconciliation/1')`;
}

describe('V4: blind template negative', () => {
	it('a generic (blind) session renders no disclosure and issues host-safe, never host-full', async () => {
		const host = await createAuthUser('bhost');
		const low = await createAuthUser('blow');
		const high = await createAuthUser('bhigh');
		const invites = await createBlindSession(host, low.email, high.email);
		const sessionId = invites[0].session_id;
		for (const inv of invites) {
			await redeem(inv.role === 'low-preferring' ? low : high, inv.plaintext_token);
		}
		const vis = await asUser(high, (tx) => getVisibilityDisclosure(tx, sessionId));
		expect(vis).toBe('blind');
		expect(disclosureRequired(vis)).toBe(false);

		await closeWithResult(sessionId);
		const hostPayload = await asUser(host, (tx) => constructInvitedPayload(tx, sessionId));
		expect(hostPayload).not.toHaveProperty('input');
		await expect(hostFullResult(host, sessionId)).rejects.toThrow('not host-full');

		const party = await partyResult(high, sessionId, 'high-preferring');
		expect(party.own).toEqual(['110.1234', '130', '150', '170']);
		expect(party.fair).toBe('130');
	});

	it('a recruitment (host-visible) session renders the disclosure and issues host-full', async () => {
		const rec = await createAuthUser('rrec');
		const cand = await createAuthUser('rcand');
		const [inv] = await createRecruitmentSession(rec, cand.email);
		await redeem(cand, inv.plaintext_token);
		const vis = await asUser(cand, (tx) => getVisibilityDisclosure(tx, inv.session_id));
		expect(vis).toBe('host-visible');
		expect(disclosureRequired(vis)).toBe(true);

		await closeWithResult(inv.session_id);
		const full = await hostFullResult(rec, inv.session_id);
		expect(full.employer).toEqual(['100', '120', '140', '160']);
		expect(full.candidate[0]).toBe('110.1234'); // V5: precision preserved through the payload
		expect(full.guidance.overlap).toBe('stretch');
		// The candidate's own view still carries no employer figure.
		const party = await partyResult(cand, inv.session_id, 'high-preferring');
		expect(JSON.stringify(party)).not.toContain('"100"');
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
