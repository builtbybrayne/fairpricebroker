// The account home: the verticals this account can use, with a glance at
// each, and the credit balance. Offers live one level down.
import type { PageServerLoad } from './$types';
import { listOffers } from '$lib/server/offers/offers';
import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';

export const load: PageServerLoad = async ({ locals }) => {
	const offers = await listOffers(locals.supabase, salaryNegotiationTemplate.id);
	return {
		offerCount: offers.length,
		openCount: offers.filter((o) => o.responses.some((r) => r.state === 'open')).length
	};
};
