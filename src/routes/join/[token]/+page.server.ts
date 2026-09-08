// T3-m1-platform-naive-auth §3.7: naive invite redemption.
import { createHash } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { naiveSignIn } from '$lib/server/auth/naiveSignIn';

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

export const load: PageServerLoad = async (event) => {
	const { token } = event.params;
	const supabase = event.locals.supabase;

	const preview = await supabase.rpc('invite_preview', { p_token: token });
	const invite = (preview.data as InvitePreview[] | null)?.[0];
	if (preview.error || !invite) return { dead: true as const };

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
		return { dead: true as const };
	}

	if (invite.email_bound) {
		if (!invite.email) return { dead: true as const };
		if (!user || (user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
			await naiveSignIn(event, invite.email); // D1-naive
		}
	} else if (!user) {
		return { dead: true as const }; // anonymous shareable links are not M1
	}

	const redeemed = await supabase.rpc('redeem_invite', { token });
	if (redeemed.error) return { dead: true as const };
	redirect(303, partyUrl(redeemed.data as string));
};
