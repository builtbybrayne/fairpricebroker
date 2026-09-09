// Every page knows who is signed in, their credit balance, and which
// vertical the current route belongs to.
import type { LayoutServerLoad } from './$types';
import { scopeFor, VERTICALS } from '$lib/verticals';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	let balance: number | null = null;
	if (user) {
		const r = await locals.supabase.rpc('current_credit_balance');
		balance = r.error ? null : (r.data as number);
	}
	return {
		account: user ? { email: user.email ?? '' } : null,
		balance,
		scope: scopeFor(url.pathname),
		verticals: VERTICALS
	};
};
