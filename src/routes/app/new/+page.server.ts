// T3-m1-recruitment-core §3: create a recruitment check. One request key
// per form render so a double-submit cannot debit twice
// (launch_invited_session raises 'duplicate-request' on a replay).
import { randomUUID } from 'node:crypto';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { normaliseEmail } from '$lib/server/auth/naiveSignIn';
import { CURRENCIES } from '$lib/client/recruitment/format';
import { stashInviteToken } from '$lib/server/recruitment/sessions';
import { recruitmentTemplate, RECRUITMENT_DIRECTION } from '$lib/templates/recruitment';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export const load: PageServerLoad = async () => {
	return { requestKey: randomUUID(), currencies: CURRENCIES };
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const form = await request.formData();
		const rawEmail = form.get('email');
		const email = normaliseEmail(rawEmail);
		const currency = String(form.get('currency') ?? recruitmentTemplate.currencyDefault);
		const requestKey = String(form.get('requestKey') ?? '');
		const values = { email: typeof rawEmail === 'string' ? rawEmail : '', currency };

		if (!email) return fail(400, { ...values, error: "Enter the candidate's email address." });
		if (!(CURRENCIES as readonly string[]).includes(currency)) {
			return fail(400, { ...values, error: 'Choose a currency from the list.' });
		}
		if (!UUID_RE.test(requestKey)) {
			return fail(400, { ...values, error: 'This form has expired. Reload and try again.' });
		}

		const { user } = await locals.safeGetSession();
		if (user && (user.email ?? '').toLowerCase() === email) {
			return fail(400, { ...values, error: "The candidate's email must differ from your own." });
		}

		const { data, error } = await locals.supabase.rpc('launch_invited_session', {
			p_request_key: requestKey,
			template_id: recruitmentTemplate.id,
			currency,
			composition: 'creator-as-host',
			visit_id: null,
			creator_direction: RECRUITMENT_DIRECTION.budget,
			invite_grants: [{ role: RECRUITMENT_DIRECTION.candidate, email }]
		});
		if (error) {
			const msg = error.message.includes('insufficient-credits')
				? 'You have no credits left, so a new check cannot be started.'
				: error.message.includes('duplicate-request')
					? 'This check was already started. Find it in your list.'
					: `Could not start the check: ${error.message}`;
			return fail(400, { ...values, error: msg });
		}
		const row = (data as { session_id: string; plaintext_token: string }[] | null)?.[0];
		if (!row) return fail(500, { ...values, error: 'The check was not created.' });

		stashInviteToken(cookies, row.session_id, row.plaintext_token);
		redirect(303, `/app/s/${row.session_id}`);
	}
};
