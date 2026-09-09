// T3-m1-platform-naive-auth §3.7: naive invite redemption.
// 9 Sep 2026: invites may be unbound (candidates are identified by their
// link). An unbound link asks the visitor for their email, signs them in
// under it (D1-naive), and redeems; the invite records that email.
import { createHash } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { naiveSignIn, normaliseEmail } from '$lib/server/auth/naiveSignIn';

interface InvitePreview {
	session_id: string;
	role: string;
	email: string | null;
	email_bound: boolean;
	host_visibility: string;
	state: string;
	redeemable: boolean;
}

const partyUrl = (sessionId: string) => `/s/${sessionId}/party`;

async function preview(locals: App.Locals, token: string): Promise<InvitePreview | null> {
	const r = await locals.supabase.rpc('invite_preview', { p_token: token });
	const invite = (r.data as InvitePreview[] | null)?.[0];
	return r.error || !invite ? null : invite;
}

export const load: PageServerLoad = async (event) => {
	const { token } = event.params;
	const supabase = event.locals.supabase;

	const invite = await preview(event.locals, token);
	if (!invite) return { dead: true as const, needEmail: false as const };

	const { user } = await event.locals.safeGetSession();

	if (!invite.redeemable) {
		// Re-entry by the redeemer is legitimate: invites_select RLS shows a
		// row to its redeemer, so a hit here means this session redeemed it.
		if (user) {
			const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');
			const own = await supabase
				.from('invites')
				.select('session_id')
				.eq('token_hash', tokenHash)
				.eq('redeemed_by_auth_uid', user.id)
				.maybeSingle();
			if (own.data?.session_id) redirect(303, partyUrl(own.data.session_id));
		}
		return { dead: true as const, needEmail: false as const };
	}

	if (invite.email_bound) {
		if (!invite.email) return { dead: true as const, needEmail: false as const };
		if (!user || (user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
			await naiveSignIn(event, invite.email); // D1-naive
		}
	} else if (!user) {
		// Unbound: ask who is opening it before redeeming.
		return { dead: false as const, needEmail: true as const };
	}

	const redeemed = await supabase.rpc('redeem_invite', { token });
	if (redeemed.error) return { dead: true as const, needEmail: false as const };
	redirect(303, partyUrl(redeemed.data as string));
};

export const actions: Actions = {
	default: async (event) => {
		const { token } = event.params;
		const form = await event.request.formData();
		const raw = form.get('email');
		const email = normaliseEmail(raw);
		if (!email) {
			return fail(400, {
				email: typeof raw === 'string' ? raw : '',
				error: 'Enter a valid email address.'
			});
		}
		const invite = await preview(event.locals, token);
		if (!invite || !invite.redeemable || invite.email_bound) {
			return fail(400, { email, error: 'This link is no longer live.' });
		}
		await naiveSignIn(event, email); // D1-naive
		const redeemed = await event.locals.supabase.rpc('redeem_invite', { token });
		if (redeemed.error) return fail(400, { email, error: 'This link is no longer live.' });
		redirect(303, partyUrl(redeemed.data as string));
	}
};
