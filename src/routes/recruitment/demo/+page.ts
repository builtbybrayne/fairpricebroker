import type { PageLoad } from './$types';

// T3-m1-recruitment-demo §2: carry the inbound attribution ref from the
// outreach link into every demo answer payload. Universal load — no server
// data is needed; the ref is validated at the API boundary.
export const load: PageLoad = ({ url }) => {
	return { ref: url.searchParams.get('ref') };
};
