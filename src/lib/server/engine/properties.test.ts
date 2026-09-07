import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { reconcile } from './reconcile.js';
import type {
	DecimalString,
	DirectionalParty,
	PricePoint,
	ReconcileResult,
	VWTuple
} from './types.js';

interface GeneratedPair {
	readonly low: readonly number[];
	readonly high: readonly number[];
	readonly zeroWidthBound?: number;
}

const runConfig = { seed: 20260820, numRuns: 200 } as const;
const base = fc.double({ min: 1e-3, max: 1e12, noNaN: true });

function sortedDistinct(count: number): fc.Arbitrary<readonly number[]> {
	return fc
		.uniqueArray(base, { minLength: count, maxLength: count })
		.map((values) => [...values].sort((a, b) => a - b));
}

const genComfort = sortedDistinct(8).map((values): GeneratedPair => ({
	low: [values[0], values[2], values[5], values[7]],
	high: [values[1], values[3], values[4], values[6]]
}));

const genDealOnly = sortedDistinct(8).map((values): GeneratedPair => ({
	low: [values[0], values[5], values[6], values[7]],
	high: [values[1], values[2], values[3], values[4]]
}));

const genDisjointClassic = sortedDistinct(8).map((values): GeneratedPair => ({
	low: [values[0], values[1], values[2], values[3]],
	high: [values[4], values[5], values[6], values[7]]
}));

const genDisjointInverted = sortedDistinct(8).map((values): GeneratedPair => ({
	low: [values[4], values[5], values[6], values[7]],
	high: [values[0], values[1], values[2], values[3]]
}));

const genZeroWidth = sortedDistinct(7).map((values): GeneratedPair => {
	const middle = values[3];
	return {
		low: [values[0], values[1], middle, values[5]],
		high: [values[2], middle, values[4], values[6]],
		zeroWidthBound: middle
	};
});

const geometries: readonly [string, fc.Arbitrary<GeneratedPair>][] = [
	['comfort', genComfort],
	['deal-only', genDealOnly],
	['classic disjoint', genDisjointClassic],
	['inverted disjoint', genDisjointInverted],
	['zero-width', genZeroWidth]
];

function tuple(values: readonly number[]): VWTuple {
	return values.map((value) => String(value) as DecimalString) as unknown as VWTuple;
}

function parties(pair: GeneratedPair): readonly [DirectionalParty, DirectionalParty] {
	return [
		{ tuple: tuple(pair.low), direction: 'low-preferring' },
		{ tuple: tuple(pair.high), direction: 'high-preferring' }
	];
}

function successful(a: DirectionalParty, b: DirectionalParty): ReconcileResult {
	const outcome = reconcile(a, b);
	expect(outcome.ok).toBe(true);
	if (!outcome.ok) throw new Error(outcome.error.detail);
	return outcome.result;
}

function pricePoints(result: ReconcileResult): readonly PricePoint[] {
	return [
		result.overlapLow,
		result.overlapHigh,
		result.dealLow,
		result.dealHigh,
		result.gap,
		result.fairPrice,
		result.distances['low-preferring'],
		result.distances['high-preferring']
	];
}

describe('reconciliation properties', () => {
	for (const [geometry, arbitrary] of geometries) {
		it(`${geometry}: fair price stays inside the active bounds`, () => {
			fc.assert(
				fc.property(arbitrary, (pair) => {
					const [low, high] = parties(pair);
					const result = successful(low, high);
					expect(result.fairPrice.float).toBeGreaterThanOrEqual(result.overlapLow.float);
					expect(result.fairPrice.float).toBeLessThanOrEqual(result.overlapHigh.float);
				}),
				runConfig
			);
		});

		it(`${geometry}: consensus spreads never increase`, () => {
			fc.assert(
				fc.property(arbitrary, (pair) => {
					const [low, high] = parties(pair);
					const { layers } = successful(low, high);
					for (let index = 1; index < layers.length; index += 1) {
						expect(layers[index].spread).toBeLessThanOrEqual(layers[index - 1].spread + 1e-12);
					}
					if (layers.length === 1) expect(layers[0].spread).toBe(0);
				}),
				runConfig
			);
		});

		it(`${geometry}: identical calls are deterministic`, () => {
			fc.assert(
				fc.property(arbitrary, (pair) => {
					const [low, high] = parties(pair);
					expect(successful(low, high)).toEqual(successful(low, high));
				}),
				runConfig
			);
		});

		it(`${geometry}: argument order is invariant`, () => {
			fc.assert(
				fc.property(arbitrary, (pair) => {
					const [low, high] = parties(pair);
					expect(successful(low, high)).toEqual(successful(high, low));
				}),
				runConfig
			);
		});

		it(`${geometry}: active bounds are always ordered`, () => {
			fc.assert(
				fc.property(arbitrary, (pair) => {
					const [low, high] = parties(pair);
					const result = successful(low, high);
					expect(result.overlapLow.float).toBeLessThanOrEqual(result.overlapHigh.float);
				}),
				runConfig
			);
		});

		it(`${geometry}: every PricePoint decimal round-trips to its float`, () => {
			fc.assert(
				fc.property(arbitrary, (pair) => {
					const [low, high] = parties(pair);
					const result = successful(low, high);
					for (const point of pricePoints(result)) {
						expect(Number(point.decimal)).toBe(point.float);
					}
				}),
				runConfig
			);
		});
	}

	it('zero-width geometry returns its bound in one trivial converged layer', () => {
		fc.assert(
			fc.property(genZeroWidth, (pair) => {
				const [low, high] = parties(pair);
				const result = successful(low, high);
				expect(result.convergedTrivially).toBe(true);
				expect(result.convergenceAchieved).toBe(true);
				expect(result.fairPrice.float).toBe(pair.zeroWidthBound);
				expect(result.layers).toHaveLength(1);
				expect(result.layers[0].spread).toBe(0);
			}),
			runConfig
		);
	});
});
