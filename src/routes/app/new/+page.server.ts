// A new role: title, currency and the client's budget. No credit is spent
// here; each candidate added on the role page costs one.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { CURRENCIES } from '$lib/client/recruitment/format';
import { parseTuple } from '$lib/server/recruitment/positions';
import { createRole } from '$lib/server/recruitment/roles';
import { recruitmentTemplate } from '$lib/templates/recruitment';

export const load: PageServerLoad = async () => {
	return { currencies: CURRENCIES };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const currency = String(form.get('currency') ?? recruitmentTemplate.currencyDefault);
		const values = { title, currency };

		if (title.length < 1 || title.length > 120) {
			return fail(400, { ...values, error: 'Give the role a name, up to 120 characters.' });
		}
		if (!(CURRENCIES as readonly string[]).includes(currency)) {
			return fail(400, { ...values, error: 'Choose a currency from the list.' });
		}
		const parsed = parseTuple([form.get('v1'), form.get('v2'), form.get('v3'), form.get('v4')]);
		if (!parsed.ok) return fail(400, { ...values, error: parsed.error });

		let id: string;
		try {
			id = await createRole(locals.supabase, { title, currency, budget: parsed.tuple });
		} catch (e) {
			return fail(400, { ...values, error: `Could not create the role: ${(e as Error).message}` });
		}
		redirect(303, `/app/r/${id}`);
	}
};
