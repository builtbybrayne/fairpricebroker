// T3-m1-recruitment-core §3: the candidate's surface, reached via /join.
// R11: the visibility fact is read server-side from the persisted session
// and the disclosure renders BEFORE any figure can be entered. The party
// payload (own tuple, fair figure, zone) is the only result data sent.
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { claimAndOrchestrate } from '$lib/server/data/orchestrator';
import type { Role } from '$lib/server/engine/types';
import {
	friendlyError,
	parseTuple,
	readOwnPosition,
	recallPosition,
	savePositionAndSubmit
} from '$lib/server/recruitment/positions';
import {
	disclosureRequired,
	partyResult,
	readSession,
	roleFor,
	visibilityFor
} from '$lib/server/recruitment/sessions';

export type PartyPhase = 'enter' | 'sealed' | 'locked' | 'closed' | 'cancelled';

async function guard(locals: App.Locals, id: string) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(`/s/${id}/party`)}`);
	const session = await readSession(locals.supabase, id);
	if (!session) error(404, 'No such session');
	const role = await roleFor(locals.supabase, id);
	if (!role) error(403, 'Open your invite link to take part in this session');
	return { user, session, role: role as Role };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { user, session, role } = await guard(locals, params.id);
	const id = session.id;

	if (session.state === 'locked') {
		await claimAndOrchestrate(id);
		const again = await readSession(locals.supabase, id);
		if (again) session.state = again.state;
	}

	const [own, visibility] = await Promise.all([
		readOwnPosition(locals.supabase, id),
		visibilityFor(locals.supabase, id)
	]);

	const base = {
		id,
		role,
		state: session.state,
		currency: session.currency,
		templateId: session.template_id,
		showDisclosure: disclosureRequired(visibility),
		ownStatus: own?.status ?? null,
		ownTuple: own?.tuple ?? null
	};

	if (session.state === 'closed') {
		const result = await partyResult({ sub: user.id, email: user.email }, id, role);
		return { ...base, phase: 'closed' as PartyPhase, result };
	}
	if (session.state === 'cancelled')
		return { ...base, phase: 'cancelled' as PartyPhase, result: null };
	if (session.state === 'locked') return { ...base, phase: 'locked' as PartyPhase, result: null };
	const phase: PartyPhase = own?.status === 'submitted' ? 'sealed' : 'enter';
	return { ...base, phase, result: null };
};

export const actions: Actions = {
	submit: async ({ locals, params, request }) => {
		const { role } = await guard(locals, params.id);
		const form = await request.formData();
		const parsed = parseTuple([form.get('v1'), form.get('v2'), form.get('v3'), form.get('v4')]);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		try {
			await savePositionAndSubmit(locals.supabase, params.id, role, parsed.tuple);
		} catch (e) {
			return fail(400, { error: friendlyError(e) });
		}
		return { ok: true };
	},
	recall: async ({ locals, params }) => {
		await guard(locals, params.id);
		try {
			await recallPosition(locals.supabase, params.id);
		} catch (e) {
			return fail(400, { error: friendlyError(e) });
		}
		return { ok: true };
	}
};
