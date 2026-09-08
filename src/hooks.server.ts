// T3-m1-platform-naive-auth §3.1
import type { Handle } from '@sveltejs/kit';
import { createRequestSupabase, safeGetSession } from '$lib/server/auth/supabaseServer';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createRequestSupabase(event.cookies);
	event.locals.safeGetSession = () => safeGetSession(event.locals.supabase);
	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};
