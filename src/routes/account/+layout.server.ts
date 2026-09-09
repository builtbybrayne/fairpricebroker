// Everything under /account needs a session.
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(url.pathname)}`);
	const balance = await locals.supabase.rpc('current_credit_balance');
	return { email: user.email ?? '', balance: balance.error ? 0 : (balance.data as number) };
};
