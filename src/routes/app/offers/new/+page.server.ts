// A new offer: title, currency and the offering side's figures. No credit
// is spent here; each link generated on the offer page costs one.
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { CURRENCIES } from '$lib/client/offers/format';
import { parseTuple } from '$lib/server/offers/figures';
import { createOffer } from '$lib/server/offers/offers';
import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';

export const load: PageServerLoad = async () => {
	return { currencies: CURRENCIES, terms: salaryNegotiationTemplate.terms };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const t = salaryNegotiationTemplate.terms;
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const currency = String(form.get('currency') ?? salaryNegotiationTemplate.currencyDefault);
		const values = { title, currency };

		if (title.length < 1 || title.length > 120) {
			return fail(400, {
				...values,
				error: `Give the ${t.offer.toLowerCase()} a name, up to 120 characters.`
			});
		}
		if (!(CURRENCIES as readonly string[]).includes(currency)) {
			return fail(400, { ...values, error: 'Choose a currency from the list.' });
		}
		const parsed = parseTuple([form.get('v1'), form.get('v2'), form.get('v3'), form.get('v4')]);
		if (!parsed.ok) return fail(400, { ...values, error: parsed.error });

		let id: string;
		try {
			id = await createOffer(locals.supabase, {
				vertical: salaryNegotiationTemplate.id,
				offeredBy: salaryNegotiationTemplate.offeredBy,
				title,
				currency,
				figures: parsed.tuple
			});
		} catch (e) {
			return fail(400, {
				...values,
				error: `Could not create the ${t.offer.toLowerCase()}: ${(e as Error).message}`
			});
		}
		redirect(303, `/app/o/${id}`);
	}
};
