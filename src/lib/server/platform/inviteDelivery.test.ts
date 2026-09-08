import { describe, expect, it } from 'vitest';
import { buildJoinUrl } from './inviteDelivery';

describe('buildJoinUrl', () => {
	it('joins origin and token, tolerating a trailing slash', () => {
		expect(buildJoinUrl('http://localhost:4173', 'abc_-123')).toBe(
			'http://localhost:4173/join/abc_-123'
		);
		expect(buildJoinUrl('https://x.test/', 'tok')).toBe('https://x.test/join/tok');
	});
});
