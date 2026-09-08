// T3-m1-recruitment-core §3: the recruiter's dashboard.
import type { PageServerLoad } from './$types';
import { listRecruiterSessions } from '$lib/server/recruitment/sessions';

export const load: PageServerLoad = async ({ locals }) => {
	return { sessions: await listRecruiterSessions(locals.supabase) };
};
