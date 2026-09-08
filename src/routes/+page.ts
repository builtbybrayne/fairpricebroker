import type { PageLoad } from './$types';

// T3-m1-casual-mode §6/§7: capture the inbound attribution ref from the
// share link. Universal load — no server data is needed for the homepage.
// The value is threaded into CasualFlow unmodified (never user-editable)
// and validated server-side at the route boundary, not here.
export const load: PageLoad = ({ url }) => {
	return { ref: url.searchParams.get('ref') };
};
