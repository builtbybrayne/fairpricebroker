// Per-role database connections (T3-m1-data-core §2.5, r4): each internal
// module opens its OWN connection as its own LOGIN role via that role's
// connection string — never SET ROLE on a shared connection, never the
// service-role credential. Client-facing calls run as `authenticated`
// with the verified JWT's claims applied (withAuthenticatedCaller).
import postgres, { type Sql, type TransactionSql } from 'postgres';
import { env as privateEnv } from '$env/dynamic/private';

export type InternalRole = 'orchestrator' | 'payload_reader' | 'casual_writer' | 'ref_writer';

/** Anything that accepts a postgres-js tagged query: a pool or a transaction. */
export type CallerSql = Sql | TransactionSql;

const ENV_KEY: Record<InternalRole, string> = {
	orchestrator: 'ORCHESTRATOR_DB_URL',
	payload_reader: 'PAYLOAD_READER_DB_URL',
	casual_writer: 'CASUAL_WRITER_DB_URL',
	ref_writer: 'REF_WRITER_DB_URL'
};

const pools = new Map<string, Sql>();

function requireEnv(key: string): string {
	// Vitest (via tests/helpers/env.ts) populates process.env; the SvelteKit
	// dev/preview server exposes .env only through $env/dynamic/private.
	const v = process.env[key] ?? privateEnv[key];
	if (!v) throw new Error(`${key} is not set`);
	return v;
}

function pool(key: string, url: string): Sql {
	let p = pools.get(key);
	if (!p) {
		// prepare:false — Supabase's transaction pooler (port 6543), which the
		// serverless deploy connects through, does not support named prepared
		// statements. Harmless on a direct/local connection.
		p = postgres(url, { max: 4, prepare: false, onnotice: () => {} });
		pools.set(key, p);
	}
	return p;
}

/** The dedicated connection for one internal role. */
export function roleDb(role: InternalRole): Sql {
	const key = ENV_KEY[role];
	return pool(key, requireEnv(key));
}

/**
 * Runs `fn` inside one transaction as the `authenticated` Postgres role
 * with the given (already server-verified) JWT claims applied, so RLS and
 * the SECURITY DEFINER helpers see exactly what a PostgREST request would.
 * The underlying connection is the migration-owner URL; the role is
 * downgraded for the whole transaction before any user statement runs.
 */
export async function withAuthenticatedCaller<T>(
	claims: { sub: string; email?: string | null; role?: 'authenticated' | 'anon' },
	fn: (tx: TransactionSql) => Promise<T>
): Promise<T> {
	const sql = pool('SUPABASE_DB_URL', requireEnv('SUPABASE_DB_URL'));
	const role = claims.role ?? 'authenticated';
	const payload = JSON.stringify({ sub: claims.sub, email: claims.email ?? undefined, role });
	const out = await sql.begin(async (tx) => {
		await tx`select set_config('request.jwt.claims', ${payload}, true)`;
		await tx.unsafe(`set local role ${role}`);
		return fn(tx);
	});
	return out as T;
}

export async function closeAllDb(): Promise<void> {
	const all = [...pools.values()];
	pools.clear();
	await Promise.all(all.map((p) => p.end({ timeout: 5 })));
}
