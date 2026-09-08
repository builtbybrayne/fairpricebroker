import { describe, expect, it } from 'vitest';
import { formatMoney, formatFair, niceAxis, quantiseRange, rangeOverlap } from './format';

describe('formatMoney', () => {
	it('shows the entered precision between 2 and 4 d.p.', () => {
		expect(formatMoney('42000.1234')).toBe('£42,000.1234');
		expect(formatMoney('48000.5')).toBe('£48,000.50');
		expect(formatMoney('55000')).toBe('£55,000.00');
		expect(formatMoney('1.5', 'USD')).toBe('$1.50');
	});
	it('rounds the fair figure to 2 d.p. for display only', () => {
		expect(formatFair('49852.88833959753')).toBe('£49,852.89');
	});
});

describe('niceAxis / quantiseRange', () => {
	it('brackets the values with a round step', () => {
		const a = niceAxis([41250, 65000, 49852]);
		expect(a.min).toBeLessThanOrEqual(41250);
		expect(a.max).toBeGreaterThanOrEqual(65000);
		expect(a.step).toBe(10000);
	});
	it('quantises to a tenth of the step so figures do not leak through the picture', () => {
		const a = niceAxis([41250, 65000]);
		expect(quantiseRange({ lo: 42000.1234, hi: 65000 }, a)).toEqual({ lo: 42000, hi: 65000 });
		expect(quantiseRange({ lo: 41250, hi: 57800 }, a)).toEqual({ lo: 41000, hi: 58000 });
	});
	it('reports overlap only when the ranges meet', () => {
		expect(rangeOverlap({ lo: 1, hi: 5 }, { lo: 3, hi: 9 })).toEqual({ lo: 3, hi: 5 });
		expect(rangeOverlap({ lo: 1, hi: 2 }, { lo: 3, hi: 9 })).toBeNull();
	});
});
