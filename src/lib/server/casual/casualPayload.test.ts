// T3-m1-casual-mode §4.1 negative tests V0a/V0b: the allowlist projection
// is the runtime boundary — exact keys, excluded keys absent.
import { describe, expect, it } from 'vitest';
import golden from '$lib/server/engine/fixtures/golden.json';
import { reconcile } from '$lib/server/engine';
import type { ReconcileResult, VWTuple } from '$lib/server/engine/types';
import { buildCasualResultPayload } from './casualPayload';

const fixture = golden.fixtures.find((f) => f.id === 'comfort-zone')!;
const asTuple = (xs: readonly number[]) => xs.map(String) as unknown as VWTuple;

function fixtureResult(): ReconcileResult {
	const out = reconcile(
		{ tuple: asTuple(fixture.input.lowPreferrer), direction: 'low-preferring' },
		{ tuple: asTuple(fixture.input.highPreferrer), direction: 'high-preferring' }
	);
	if (!out.ok) throw new Error(`golden fixture rejected: ${out.error.detail}`);
	return out.result;
}

const ALLOWLIST = [
	'zone',
	'fairPrice',
	'convergenceAchieved',
	'convergedTrivially',
	'meta',
	'distances',
	'input',
	'dealLow',
	'dealHigh',
	'overlapLow',
	'overlapHigh'
];

describe('buildCasualResultPayload', () => {
	it('V0a: emits exactly the eleven allowlisted top-level keys', () => {
		const payload = buildCasualResultPayload(fixtureResult());
		expect(Object.keys(payload)).toEqual(ALLOWLIST);
	});

	it('V0b: every internal-only key is absent', () => {
		const payload = buildCasualResultPayload(fixtureResult());
		for (const key of ['layers', 'honesty', 'curves', 'hasComfortZone', 'overlap', 'gap']) {
			expect(key in payload, `${key} must not leak`).toBe(false);
		}
	});
});
