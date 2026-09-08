// V1 (T3-m1-platform-naive-auth §5): two sign-ins with one email → one
// auth.users row, one identities row, one launch-grant ledger row, balance
// 20 both times. Runs against local Supabase over an in-memory cookie jar.
import type { Cookies } from '@sveltejs/kit';
import { afterAll, describe, expect, it } from 'vitest';
import { admin, closeAdmin } from '../../../../tests/helpers/db';
import { naiveSignIn, normaliseEmail } from './naiveSignIn';
import { createRequestSupabase, safeGetSession } from './supabaseServer';

/** Minimal SvelteKit Cookies over a Map: enough for @supabase/ssr. */
function cookieJar(): Cookies {
	const jar = new Map<string, string>();
	return {
		get: (name) => jar.get(name),
		getAll: () => [...jar].map(([name, value]) => ({ name, value })),
		set: (name, value) => void jar.set(name, value),
		delete: (name) => void jar.delete(name),
		serialize: (name, value) => `${name}=${value}`
	};
}

function fakeEvent() {
	const cookies = cookieJar();
	const supabase = createRequestSupabase(cookies);
	return {
		cookies,
		locals: { supabase, safeGetSession: () => safeGetSession(supabase) }
	};
}

afterAll(closeAdmin);

describe('normaliseEmail', () => {
	it('trims, lowercases and rejects non-emails', () => {
		expect(normaliseEmail('  Foo@Example.TEST ')).toBe('foo@example.test');
		expect(normaliseEmail('nope')).toBeNull();
		expect(normaliseEmail('a b@example.test')).toBeNull();
		expect(normaliseEmail('a@b')).toBeNull();
		expect(normaliseEmail(42)).toBeNull();
	});
});

describe('naiveSignIn (V1)', () => {
	it('signing in twice with one email yields one user, one identity, one grant, balance 20', async () => {
		const email = `v1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

		const first = fakeEvent();
		const { userId } = await naiveSignIn(first, `  ${email.toUpperCase()} `);
		const s1 = await first.locals.safeGetSession();
		expect(s1.user?.id).toBe(userId);
		expect(s1.user?.email).toBe(email);
		expect(first.cookies.getAll().length).toBeGreaterThan(0);

		const second = fakeEvent();
		const again = await naiveSignIn(second, email);
		expect(again.userId).toBe(userId);

		const users = await admin()<{ n: number }[]>`
			select count(*)::int as n from auth.users where email = ${email}`;
		expect(users[0].n).toBe(1);
		const identities = await admin()<{ n: number }[]>`
			select count(*)::int as n from identities where auth_user_id = ${userId}::uuid`;
		expect(identities[0].n).toBe(1);
		const grants = await admin()<{ n: number }[]>`
			select count(*)::int as n from credit_ledger l
			join identities i on i.id = l.account_identity_id
			where i.auth_user_id = ${userId}::uuid and l.reason = 'launch-grant'`;
		expect(grants[0].n).toBe(1);

		for (const ev of [first, second]) {
			const bal = await ev.locals.supabase.rpc('current_credit_balance');
			expect(bal.error).toBeNull();
			expect(bal.data).toBe(20);
		}
	});

	it('rejects an invalid email with a 400 before touching GoTrue', async () => {
		await expect(naiveSignIn(fakeEvent(), 'not-an-email')).rejects.toMatchObject({ status: 400 });
	});
});
