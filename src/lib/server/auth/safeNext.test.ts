import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

describe('safeNext', () => {
	it('allows same-origin paths only', () => {
		expect(safeNext('/app/x?y=1')).toBe('/app/x?y=1');
		expect(safeNext(null)).toBe('/app');
		expect(safeNext('')).toBe('/app');
		expect(safeNext('https://evil.test/')).toBe('/app');
		expect(safeNext('//evil.test/')).toBe('/app');
		expect(safeNext('/\\evil.test')).toBe('/app');
	});
});
