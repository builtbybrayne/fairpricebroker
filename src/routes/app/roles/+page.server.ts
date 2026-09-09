// The recruiter's dashboard: roles, each with its candidates' states.
import type { PageServerLoad } from './$types';
import { listRoles } from '$lib/server/recruitment/roles';

export const load: PageServerLoad = async ({ locals }) => {
	return { roles: await listRoles(locals.supabase) };
};
