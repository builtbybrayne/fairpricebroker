// The offerer's dashboard: offers in this vertical, each with its responses' states.
import type { PageServerLoad } from './$types';
import { listOffers } from '$lib/server/offers/offers';
import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		offers: await listOffers(locals.supabase, salaryNegotiationTemplate.id),
		terms: salaryNegotiationTemplate.terms
	};
};
