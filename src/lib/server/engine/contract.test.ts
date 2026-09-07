import { describe, expect, it } from 'vitest';

import { FIELD_CLASSES, reconcile } from './index.js';
import type {
	DecimalString,
	DirectionalParty,
	EngineErrorKind,
	ReconcileResult,
	Role,
	VWTuple
} from './types.js';

function tuple(values: readonly string[]): VWTuple {
	return values as unknown as VWTuple;
}

function party(values: readonly string[], direction: Role): DirectionalParty {
	return { tuple: tuple(values), direction };
}

const validLow = party(['10', '20', '30', '40'], 'low-preferring');
const validHigh = party(['15', '25', '35', '45'], 'high-preferring');

function resultOf(low: DirectionalParty, high: DirectionalParty): ReconcileResult {
	const outcome = reconcile(low, high);
	expect(outcome.ok).toBe(true);
	if (!outcome.ok) throw new Error(outcome.error.detail);
	return outcome.result;
}

function expectError(low: DirectionalParty, high: DirectionalParty, kind: EngineErrorKind): void {
	const outcome = reconcile(low, high);
	expect(outcome).toMatchObject({ ok: false, error: { kind } });
}

describe('engine contract', () => {
	it('classifies every result field and no nonexistent field', () => {
		const result = resultOf(validLow, validHigh);
		const splitFields = new Set(['distances', 'honesty', 'input']);
		const resultPaths = Object.keys(result).flatMap((key) =>
			splitFields.has(key) ? [`${key}.low-preferring`, `${key}.high-preferring`] : [key]
		);
		expect(Object.keys(FIELD_CLASSES).sort()).toEqual(resultPaths.sort());
	});

	it('rejects valid decimals outside the magnitude domain', () => {
		expectError(
			party(
				['10000000000000000', '10000000000000001', '10000000000000002', '10000000000000003'],
				'low-preferring'
			),
			validHigh,
			'out-of-magnitude-domain'
		);
		expectError(
			party(['0.0000000001', '1', '2', '3'], 'low-preferring'),
			validHigh,
			'out-of-magnitude-domain'
		);
	});

	it('uses exact decimal equality for ascending validation', () => {
		expectError(
			party(['50', '100', '100.00', '120'], 'low-preferring'),
			validHigh,
			'not-ascending'
		);
	});

	it('rejects malformed decimal spellings', () => {
		for (const malformed of ['1e5', '-3', '1.2.3', '.5', 'NaN', '']) {
			expectError(
				party([malformed, '20', '30', '40'], 'low-preferring'),
				validHigh,
				'malformed-decimal'
			);
		}
	});

	it('distinguishes grammatical zero from malformed input', () => {
		for (const zero of ['0', '0.000']) {
			expectError(party([zero, '20', '30', '40'], 'low-preferring'), validHigh, 'non-positive');
		}
	});

	it('requires exactly one party in each direction', () => {
		expectError(
			validLow,
			party(['15', '25', '35', '45'], 'low-preferring'),
			'same-direction-parties'
		);
	});

	it('defines a trivial result when exact decimals collapse to one float at the active bounds', () => {
		const low = party(['0.5', '1.00000000000000001', '2', '3'], 'low-preferring');
		const high = party(['0.6', '0.9', '1.00000000000000002', '4'], 'high-preferring');
		const result = resultOf(low, high);
		expect(result.overlapLow.float).toBe(result.overlapHigh.float);
		expect(result.convergedTrivially).toBe(true);
		expect(result.convergenceAchieved).toBe(true);
	});

	it('serialises zero and tiny derived values as plain decimals', () => {
		const comfort = resultOf(validLow, validHigh);
		expect(comfort.gap).toEqual({ float: 0, decimal: '0' });

		const low = party(['1', '2', '3', '4.000000001'], 'low-preferring');
		const high = party(['4.000000002', '5', '6', '7'], 'high-preferring');
		const noDeal = resultOf(low, high);
		expect(noDeal.gap.float).toBeCloseTo(1e-9, 15);
		expect(noDeal.gap.decimal).not.toContain('e');
		expect(noDeal.gap.decimal).toMatch(/^0\.0+[0-9]+$/);
		expect(Number(noDeal.gap.decimal)).toBe(noDeal.gap.float);
	});

	it('short-circuits a large-magnitude zero-width comfort zone exactly', () => {
		const low = party(['1', '2', '900000000000000', '900000000000100'], 'low-preferring');
		const high = party(
			['1.5', '900000000000000', '900000000000050', '900000000000200'],
			'high-preferring'
		);
		const result = resultOf(low, high);
		expect(result.fairPrice.float).toBe(900000000000000);
		expect(result.convergedTrivially).toBe(true);
		expect(result.layers).toHaveLength(1);
		expect(result.layers[0].spread).toBe(0);
	});

	it('preserves a lossless branded input string without normalising trailing zeros', () => {
		const low = party(['10.00', '20.0', '30.000', '40.0000'], 'low-preferring');
		const result = resultOf(low, validHigh);
		expect(result.input['low-preferring'].tuple[0]).toBe('10.00' as DecimalString);
	});
});
