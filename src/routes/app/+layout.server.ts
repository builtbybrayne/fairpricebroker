// T3-m1-platform-naive-auth §3.3: everything under /app needs a session.
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname + url.search)}`);

	// identity_for_current_uid is not granted to `authenticated` (final
	// grants migration); ensure_identity is the client-facing equivalent.
	const [identity, balance] = await Promise.all([
		locals.supabase.rpc('ensure_identity'),
		locals.supabase.rpc('current_credit_balance')
	]);
	if (identity.error) throw error(500, `ensure_identity: ${identity.error.message}`);
	if (balance.error) throw error(500, `current_credit_balance: ${balance.error.message}`);

	return {
		email: user.email ?? '',
		identityId: identity.data as string,
		balance: balance.data as number
	};
};
