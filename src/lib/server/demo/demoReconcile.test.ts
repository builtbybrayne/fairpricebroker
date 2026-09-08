// T3-m1-recruitment-demo §1: runDemoReconciliation over the golden
// fixtures yields the engine's zone plus the recruitment guidance, and
// passes engine rejections through unchanged.
import { describe, expect, it } from 'vitest';
import golden from '$lib/server/engine/fixtures/golden.json';
import type { Zone } from '$lib/server/engine/types';
import { recruitmentTemplate } from '$lib/templates/recruitment';
import { runDemoReconciliation, type DemoRawTuple } from './demoReconcile';

function tuple(xs: readonly number[]): DemoRawTuple {
	return xs.map(String) as unknown as DemoRawTuple;
}

function expectedZone(f: (typeof golden.fixtures)[number]): Zone {
	const r = f.modes['relative-r1'].result;
	if (r.hasComfortZone) return 'comfort';
	return r.overlap ? 'deal' : 'no-deal';
}

const VIEW_KEYS = [
	'budgetTuple',
	'candidateTuple',
	'zone',
	'fairPrice',
	'distances',
	'dealLow',
	'dealHigh',
	'overlapLow',
	'overlapHigh',
	'guidance'
].sort();

describe('runDemoReconciliation', () => {
	for (const f of golden.fixtures) {
		it(`golden ${f.id}: zone + guidance (budget = low-preferring, candidate = high-preferring)`, () => {
			const budget = tuple(f.input.lowPreferrer);
			const candidate = tuple(f.input.highPreferrer);
			const out = runDemoReconciliation(budget, candidate);
			expect(out.ok).toBe(true);
			if (!out.ok) return;
			const zone = expectedZone(f);
			expect(out.view.zone).toBe(zone);
			expect(out.view.guidance).toEqual(recruitmentTemplate.guidance(zone));
			expect(out.view.budgetTuple).toEqual(budget);
			expect(out.view.candidateTuple).toEqual(candidate);
			expect(Object.keys(out.view).sort()).toEqual(VIEW_KEYS);
			expect(out.view.fairPrice.float).toBeGreaterThan(0);
			expect(out.view.distances['low-preferring']).toBeDefined();
			expect(out.view.distances['high-preferring']).toBeDefined();
		});
	}

	it('covers all three guidance zones across the golden archive', () => {
		const zones = new Set(golden.fixtures.map(expectedZone));
		expect([...zones].sort()).toEqual(['comfort', 'deal', 'no-deal']);
	});

	it('returns the engine error unchanged on a non-ascending tuple', () => {
		const out = runDemoReconciliation(tuple([80, 70, 110, 125]), tuple([70, 90, 105, 120]));
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.error.kind).toBe('not-ascending');
	});
});
