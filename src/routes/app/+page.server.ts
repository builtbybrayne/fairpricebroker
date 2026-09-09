// The account home: the verticals this account can use, with a glance at
// each, and the credit balance. Roles live one level down.
import type { PageServerLoad } from './$types';
import { listRoles } from '$lib/server/recruitment/roles';

export const load: PageServerLoad = async ({ locals }) => {
	const roles = await listRoles(locals.supabase);
	return {
		roleCount: roles.length,
		openCount: roles.filter((r) => r.candidates.some((c) => c.state === 'open')).length
	};
};
