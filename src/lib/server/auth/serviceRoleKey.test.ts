// V5 (T3-m1-platform-naive-auth §5): the service-role key is read only
// inside src/lib/server/auth/. Test files are exempt (they name the key as
// a string literal to assert this very rule — data-core's payload.test.ts
// applies the same exemption); no non-test file outside auth/ may.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('V5 service-role key containment', () => {
	it('only files under src/lib/server/auth/ mention SUPABASE_SERVICE_ROLE_KEY', () => {
		let out: string;
		try {
			out = execFileSync('grep', ['-rl', 'SUPABASE_SERVICE_ROLE_KEY', 'src'], {
				encoding: 'utf8'
			});
		} catch (e) {
			// grep exits 1 when nothing matches; that would be a regression too.
			out = String((e as { stdout?: string }).stdout ?? '');
		}
		const files = out
			.split('\n')
			.filter(Boolean)
			.filter((f) => !f.endsWith('.test.ts'));
		expect(files).toEqual(['src/lib/server/auth/naiveSignIn.ts']);
	});
});
