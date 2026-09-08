// T3-m1-platform-naive-auth §3.1: the per-request Supabase client, built
// from the anon key and the request's cookies. Anything holding a session
// (sign-in, RPCs as the caller) goes through this client, never a shared
// one. Exported separately from hooks.server.ts so unit tests can build
// one over an in-memory cookie jar.
import { createServerClient } from '@supabase/ssr';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

const COOKIE_OPTIONS = { path: '/', sameSite: 'lax', httpOnly: true } as const;

export function createRequestSupabase(cookies: Cookies): SupabaseClient {
	const url = env.PUBLIC_SUPABASE_URL;
	const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anonKey) throw new Error('PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY not set');
	return createServerClient(url, anonKey, {
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (toSet) => {
				for (const { name, value, options } of toSet) {
					cookies.set(name, value, { ...options, ...COOKIE_OPTIONS });
				}
			}
		}
	});
}

/** Validates the cookie session against GoTrue before trusting its claims. */
export async function safeGetSession(
	supabase: SupabaseClient
): Promise<{ session: Session | null; user: User | null }> {
	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (!session) return { session: null, user: null };
	const {
		data: { user },
		error
	} = await supabase.auth.getUser();
	if (error || !user) return { session: null, user: null };
	return { session, user };
}
