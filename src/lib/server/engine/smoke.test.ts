import { describe, expect, it } from 'vitest';

describe('test wiring', () => {
	it('runs a trivial assertion in the server project', () => {
		expect(1 + 1).toBe(2);
	});
});
