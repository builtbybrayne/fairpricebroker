// Every page knows who is signed in, their credit balance, and which
// vertical the current route belongs to (the top bar's scope tag).
import type { LayoutServerLoad } from './$types';
import { scopeFor, VERTICALS } from '$lib/domain/terms';

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
