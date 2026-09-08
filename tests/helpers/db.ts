import { randomUUID } from 'node:crypto';
import postgres, { type Sql, type TransactionSql } from 'postgres';
import { expect } from 'vitest';
import { loadDotEnv } from './env';

loadDotEnv();

export const DIRS = ['low-preferring', 'high-preferring'] as const;

let adminPool: Sql | undefined;
/** Migration-owner (postgres) connection: bypasses RLS; fixture setup only. */
export function admin(): Sql {
	if (!adminPool) {
		const url = process.env.SUPABASE_DB_URL;
		if (!url) throw new Error('SUPABASE_DB_URL missing');
		adminPool = postgres(url, { max: 4, onnotice: () => {} });
	}
	return adminPool;
}

export async function closeAdmin(): Promise<void> {
	await adminPool?.end({ timeout: 5 });
	adminPool = undefined;
}

export interface TestUser {
	sub: string;
	email: string;
}

/** Creates a real auth.users row so identities.auth_user_id's FK resolves. */
export async function createAuthUser(emailPrefix = 'u'): Promise<TestUser> {
	const sub = randomUUID();
	const email = `${emailPrefix}-${sub.slice(0, 8)}@example.test`;
	await admin()`
		insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
		                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
		values (${sub}::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
		        ${email}, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
	`;
	return { sub, email };
}

/**
 * Runs fn as the `authenticated` role with these claims inside one
 * transaction (mirrors src/lib/server/data/db.ts withAuthenticatedCaller,
 * but lets a test override the email claim to forge a mismatch).
 */
export async function asUser<T>(
	user: { sub: string; email?: string | null },
	fn: (tx: TransactionSql) => Promise<T>,
	role: 'authenticated' | 'anon' = 'authenticated'
): Promise<T> {
	const payload = JSON.stringify({ sub: user.sub, email: user.email ?? undefined, role });
	const out = await admin().begin(async (tx) => {
		await tx`select set_config('request.jwt.claims', ${payload}, true)`;
		await tx.unsafe(`set local role ${role}`);
		return fn(tx);
	});
	return out as T;
}

/** Expects a rejected promise whose Postgres message contains `needle`. */
export async function expectPgError(p: Promise<unknown>, needle: string): Promise<void> {
	let err: unknown;
	try {
		await p;
	} catch (e) {
		err = e;
	}
	expect(err, `expected an error containing "${needle}" but the call succeeded`).toBeDefined();
	const msg = String((err as { message?: string }).message ?? err);
	expect(msg).toContain(needle);
}
