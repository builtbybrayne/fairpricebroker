import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { naiveSignIn, normaliseEmail } from '$lib/server/auth/naiveSignIn';
import { safeNext } from '$lib/server/auth/safeNext';
import { isPreviewSigninAllowed } from '$lib/server/auth/signinGate';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (user) redirect(303, safeNext(url.searchParams.get('next')));
	return {
		next: url.searchParams.get('next') ?? '',
		open: (env.PREVIEW_SIGNIN_ALLOWLIST ?? '').trim() !== ''
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const raw = form.get('email');
		const email = normaliseEmail(raw);
		if (!email) {
			return fail(400, {
				email: typeof raw === 'string' ? raw : '',
				error: 'Enter a valid email address.'
			});
		}
		if (!isPreviewSigninAllowed(email, env.PREVIEW_SIGNIN_ALLOWLIST)) {
			return fail(403, { email, error: 'Preview sign-in is not open to this address.' });
		}
		await naiveSignIn(event, email);
		redirect(303, safeNext(event.url.searchParams.get('next')));
	}
};
