// T3-m1-casual-mode §6/§7: grammar test for the shared ref-code authority
// plus — because this brief landed SECOND (data-core created the file) —
// the byte-identity assertion against the body pinned verbatim in §6.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRefCode, REF_CODE_REGEX } from './refCodes';

const PINNED_BODY =
	'declare const refCodeBrand: unique symbol;\n' +
	"export type RefCode = string & { readonly [refCodeBrand]: 'RefCode' };\n" +
	'export const REF_CODE_REGEX = /^[a-z2-7]{10}$/;\n' +
	'export function isRefCode(x: unknown): x is RefCode {\n' +
	"\treturn typeof x === 'string' && REF_CODE_REGEX.test(x);\n" +
	'}\n';

describe('refCodes (shared authority)', () => {
	it('on-disk body is byte-identical to the pinned §6 body', () => {
		const onDisk = readFileSync(new URL('./refCodes.ts', import.meta.url), 'utf8');
		expect(onDisk).toBe(PINNED_BODY);
	});

	it('grammar: accepts a valid sample, rejects invalid ones', () => {
		expect(REF_CODE_REGEX.source).toBe('^[a-z2-7]{10}$');
		expect(isRefCode('abcdefg234')).toBe(true);
		expect(isRefCode('abc123')).toBe(false);
		expect(isRefCode('ABCDEFG234')).toBe(false);
		expect(isRefCode('abcdefg018')).toBe(false);
		expect(isRefCode(null)).toBe(false);
		expect(isRefCode(['a', 'b'])).toBe(false);
	});
});
