import { describe, expect, it } from 'vitest';

import fixturesJson from './fixtures/golden.json';
import { ENGINE_VERSION, reconcile } from './index.js';
import type { DecimalString, DirectionalParty, ToleranceMode, VWTuple, Zone } from './types.js';

interface ExpectedLayer {
	readonly methods: readonly { readonly name: string; readonly value: number }[];
	readonly values: readonly number[];
	readonly spread: number;
}

interface ExpectedResult {
	readonly overlap: boolean;
	readonly overlapLow: number;
	readonly overlapHigh: number;
	readonly dealLow: number;
	readonly dealHigh: number;
	readonly hasComfortZone: boolean;
	readonly gap: number;
	readonly layers: readonly ExpectedLayer[];
	readonly fairPrice: number;
	readonly convergenceAchieved: boolean;
}

interface Fixture {
	readonly id: string;
	readonly input: {
		readonly lowPreferrer: readonly number[];
		readonly highPreferrer: readonly number[];
	};
	readonly modes: Readonly<
		Record<ToleranceMode, { readonly threshold: number; readonly result: ExpectedResult }>
	>;
	readonly derivedDistances?: {
		readonly lowPreferrer: number;
		readonly highPreferrer: number;
	};
}

interface FixtureArchive {
	readonly anchors: {
		readonly inflection: string;
		readonly algorithmVersion: string;
		readonly numericPolicyVersion: string;
		readonly honestySignalSetVersion: string;
		readonly engineVersion: string;
	};
	readonly fixtures: readonly Fixture[];
}

const archive = fixturesJson as FixtureArchive;
const modes: readonly ToleranceMode[] = ['absolute-0.01', 'relative-r1'];

function tuple(numbers: readonly number[]): VWTuple {
	return numbers.map((value) => String(value) as DecimalString) as unknown as VWTuple;
}

function parties(fixture: Fixture): readonly [DirectionalParty, DirectionalParty] {
	return [
		{ tuple: tuple(fixture.input.lowPreferrer), direction: 'low-preferring' },
		{ tuple: tuple(fixture.input.highPreferrer), direction: 'high-preferring' }
	];
}

function expectedZone(expected: ExpectedResult): Zone {
	if (expected.hasComfortZone) return 'comfort';
	return expected.overlap ? 'deal' : 'no-deal';
}

function expectNear(actual: number, expected: number): void {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)));
}

describe('golden reconciliation fixtures', () => {
	it('anchors the complete five-field implementation identity', () => {
		expect({
			inflection: archive.anchors.inflection,
			algorithmVersion: archive.anchors.algorithmVersion,
			numericPolicyVersion: archive.anchors.numericPolicyVersion,
			honestySignalSetVersion: archive.anchors.honestySignalSetVersion,
			engineVersion: archive.anchors.engineVersion
		}).toEqual({
			inflection: 'reconciliation',
			algorithmVersion: 'reconciliation/1',
			numericPolicyVersion: 'np/1',
			honestySignalSetVersion: 'honesty/1',
			engineVersion: ENGINE_VERSION
		});
	});

	for (const fixture of archive.fixtures) {
		for (const mode of modes) {
			it(`${fixture.id} matches every recorded trace in ${mode}`, () => {
				const [low, high] = parties(fixture);
				const outcome = reconcile(low, high, { tolerance: { mode } });
				expect(outcome.ok).toBe(true);
				if (!outcome.ok) throw new Error(outcome.error.detail);

				const actual = outcome.result;
				const expected = fixture.modes[mode].result;
				expect(actual.zone).toBe(expectedZone(expected));
				expect(actual.hasComfortZone).toBe(expected.hasComfortZone);
				expect(actual.overlap).toBe(expected.overlap);
				expectNear(actual.overlapLow.float, expected.overlapLow);
				expectNear(actual.overlapHigh.float, expected.overlapHigh);
				expectNear(actual.dealLow.float, expected.dealLow);
				expectNear(actual.dealHigh.float, expected.dealHigh);
				expectNear(actual.gap.float, expected.gap);
				expect(actual.layers).toHaveLength(expected.layers.length);

				for (let layerIndex = 0; layerIndex < expected.layers.length; layerIndex += 1) {
					const actualLayer = actual.layers[layerIndex];
					const expectedLayer = expected.layers[layerIndex];
					expect(actualLayer.methods).toHaveLength(expectedLayer.methods.length);
					expect(actualLayer.values).toHaveLength(expectedLayer.values.length);
					for (let methodIndex = 0; methodIndex < expectedLayer.methods.length; methodIndex += 1) {
						expect(actualLayer.methods[methodIndex].name).toBe(
							expectedLayer.methods[methodIndex].name
						);
						expectNear(
							actualLayer.methods[methodIndex].value,
							expectedLayer.methods[methodIndex].value
						);
						expectNear(actualLayer.values[methodIndex], expectedLayer.values[methodIndex]);
					}
					expectNear(actualLayer.spread, expectedLayer.spread);
				}

				expectNear(actual.fairPrice.float, expected.fairPrice);
				expect(actual.fairPrice.decimal).toBe(String(actual.fairPrice.float));
				expect(actual.convergenceAchieved).toBe(expected.convergenceAchieved);
				expect(actual.meta).toEqual({
					inflection: 'reconciliation',
					algorithmVersion: 'reconciliation/1',
					numericPolicyVersion: 'np/1',
					honestySignalSetVersion: 'honesty/1',
					engineVersion: ENGINE_VERSION,
					toleranceMode: mode
				});

				if (fixture.id === 'no-deal' && fixture.derivedDistances) {
					expectNear(
						actual.distances['low-preferring'].float,
						fixture.derivedDistances.lowPreferrer
					);
					expectNear(
						actual.distances['high-preferring'].float,
						fixture.derivedDistances.highPreferrer
					);
				}

				if (fixture.id === 'decimal-precision') {
					expect(actual.input['low-preferring'].tuple).toEqual(low.tuple);
					expect(actual.input['high-preferring'].tuple).toEqual(high.tuple);
				}
			});
		}
	}

	it('records the exact R1 tolerance divergence', () => {
		const fixture = archive.fixtures.find(({ id }) => id === 'r1-divergence');
		expect(fixture).toBeDefined();
		if (!fixture) throw new Error('missing r1-divergence fixture');
		const [low, high] = parties(fixture);
		const absolute = reconcile(low, high, { tolerance: { mode: 'absolute-0.01' } });
		const relative = reconcile(low, high, { tolerance: { mode: 'relative-r1' } });
		expect(absolute.ok).toBe(true);
		expect(relative.ok).toBe(true);
		if (!absolute.ok || !relative.ok) throw new Error('valid golden input was rejected');
		expect(absolute.result.layers).toHaveLength(8);
		expect(relative.result.layers).toHaveLength(5);
		expect(absolute.result.fairPrice.float).not.toBe(relative.result.fairPrice.float);
	});
});
