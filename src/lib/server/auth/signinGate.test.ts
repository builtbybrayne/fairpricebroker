import { describe, expect, it } from 'vitest';
import { isPreviewSigninAllowed } from './signinGate';

describe('isPreviewSigninAllowed', () => {
	it('denies everyone when the allowlist is unset or blank', () => {
		expect(isPreviewSigninAllowed('a@b.co', undefined)).toBe(false);
		expect(isPreviewSigninAllowed('a@b.co', '')).toBe(false);
		expect(isPreviewSigninAllowed('a@b.co', '  ')).toBe(false);
	});

	it('allows everyone when the allowlist is "*"', () => {
		expect(isPreviewSigninAllowed('anyone@example.com', '*')).toBe(true);
	});

	it('allows only listed addresses, case-insensitively, ignoring spaces', () => {
		const list = ' Al@fairprice.broker, guest@example.com ';
		expect(isPreviewSigninAllowed('al@fairprice.broker', list)).toBe(true);
		expect(isPreviewSigninAllowed('GUEST@example.com', list)).toBe(true);
		expect(isPreviewSigninAllowed('other@example.com', list)).toBe(false);
	});

	it('allows a whole domain with "*@domain", case-insensitively', () => {
		const list = '*@fairprice.broker, guest@example.com';
		expect(isPreviewSigninAllowed('anyone@fairprice.broker', list)).toBe(true);
		expect(isPreviewSigninAllowed('Al@FairPrice.Broker', list)).toBe(true);
		expect(isPreviewSigninAllowed('guest@example.com', list)).toBe(true);
		expect(isPreviewSigninAllowed('al@notfairprice.broker', list)).toBe(false);
		expect(isPreviewSigninAllowed('al@fairprice.broker.evil.com', list)).toBe(false);
	});
});
