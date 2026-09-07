import { describe, expect, it } from 'vitest';

import { computeHonestySignals } from './honesty.js';

function expectNear(actual: number, expected: number): void {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-12);
}

function numeric(value: { readonly value: number } | { readonly value: null }): number {
	expect(value.value).not.toBeNull();
	if (value.value === null) throw new Error('expected a numeric honesty signal');
	return value.value;
}

describe('honesty signals', () => {
	it('matches the symmetric closed-form fixture', () => {
		// mean=25, sum(d^2)=500; symmetry gives skew=0. The adjusted fourth
		// moment is (20/6)*3.69 - 13.5 = -1.2.
		const signals = computeHonestySignals([10, 20, 30, 40]);
		expectNear(numeric(signals.skewness), 0);
		expectNear(numeric(signals.kurtosis), -1.2);
		expectNear(signals.rangeCompression, 30 / 25);
		expect(signals.signalSetVersion).toBe('honesty/1');
	});

	it('matches the asymmetric closed-form fixture', () => {
		// mean=19, sum(d^2)=596, sum(d^3)=8064, sum(d^4)=204068.
		const signals = computeHonestySignals([10, 12, 14, 40]);
		const expectedSkewness = ((2 / 3) * 8064) / Math.pow(596 / 3, 1.5);
		const expectedKurtosis = ((10 / 3) * 204068) / Math.pow(596 / 3, 2) - 13.5;
		expectNear(numeric(signals.skewness), expectedSkewness);
		expectNear(numeric(signals.kurtosis), expectedKurtosis);
		expectNear(signals.rangeCompression, 30 / 25);
	});

	it('reports undefined higher moments at zero variance', () => {
		const signals = computeHonestySignals([5, 5, 5, 5]);
		expect(signals.skewness).toEqual({ value: null, reason: 'zero-variance' });
		expect(signals.kurtosis).toEqual({ value: null, reason: 'zero-variance' });
		expect(signals.rangeCompression).toBe(0);
	});
});
