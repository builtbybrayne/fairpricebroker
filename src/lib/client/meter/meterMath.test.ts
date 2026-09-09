import { describe, expect, it } from 'vitest';
import {
	formatFigure,
	isOrdered,
	placeAnchor,
	placeKnob,
	quartiles,
	snapTo,
	toNumber,
	toRaw
} from './meterMath';

describe('meterMath', () => {
	it('snaps to the step without float noise', () => {
		expect(snapTo(327.2987, 1)).toBe(327);
		expect(snapTo(0.35, 0.1)).toBe(0.3);
		expect(snapTo(41234, 500)).toBe(41000);
	});

	it('seeds four spread points', () => {
		expect(quartiles(0, 1000, 1)).toEqual([200, 400, 600, 800]);
	});

	it('keeps a knob between its neighbours', () => {
		expect(placeKnob([100, 200, 300, 400], 1, 350, 1)).toEqual([100, 299, 300, 400]);
		expect(placeKnob([100, 200, 300, 400], 2, 50, 1)).toEqual([100, 200, 201, 400]);
		expect(placeKnob([100, 200, 300, 400], 1, 250, 1)).toEqual([100, 250, 300, 400]);
	});

	it('lets an anchor push the knobs only when it comes inside them', () => {
		expect(placeAnchor([100, 200, 300, 400], 0, 150, 1, 0, 1000)).toEqual([150, 200, 300, 400]);
		expect(placeAnchor([100, 200, 300, 400], 0, 250, 1, 0, 1000)).toEqual([250, 251, 300, 400]);
		expect(placeAnchor([100, 200, 300, 400], 3, 210, 1, 0, 1000)).toEqual([100, 200, 209, 210]);
		expect(placeAnchor([100, 200, 300, 400], 3, 5000, 1, 0, 1000)).toEqual([100, 200, 300, 1000]);
	});

	it('parses and formats raw figures', () => {
		expect(toNumber('12.3456')).toBe(12.3456);
		expect(toNumber('1,200')).toBeNaN();
		expect(toNumber(null)).toBeNaN();
		expect(formatFigure('12.3456')).toBe('£12.3456');
		expect(formatFigure('1200')).toBe('£1,200');
		expect(formatFigure('1200.5')).toBe('£1,200.50');
		expect(formatFigure('999')).toBe('£999.00');
		expect(toRaw(327)).toBe('327');
		expect(toRaw(0.30000000000000004)).toBe('0.3');
		expect(isOrdered([1, 2, 3, 4])).toBe(true);
		expect(isOrdered([1, 2, 2, 4])).toBe(false);
	});
});
