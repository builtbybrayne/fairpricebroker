// T3-m1-recruitment-core §3: the recruiter's session page, one route,
// state-driven. The load derives a `phase` server-side; the page renders
// exactly the panels that phase needs. The host-full payload is fetched
// only when the session is closed, as the signed-in user, through the
// payload constructor (the sole disclosure authority).
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { claimAndOrchestrate } from '$lib/server/data/orchestrator';
import {
	cancelSession,
	friendlyError,
	parseTuple,
	readOwnPosition,
	recallPosition,
	savePositionAndSubmit
} from '$lib/server/recruitment/positions';
import {
	candidateSubmitted,
	forgetInviteToken,
	hostFullResult,
	isHost,
	readCandidateInvite,
	readInviteToken,
	readSession,
	type CandidateStatus
} from '$lib/server/recruitment/sessions';
import { recruitmentTemplate, RECRUITMENT_DIRECTION } from '$lib/templates/recruitment';

export type Phase = 'enter' | 'waiting' | 'locked' | 'closed' | 'cancelled';

async function guard(locals: App.Locals, id: string) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(`/app/s/${id}`)}`);
	const session = await readSession(locals.supabase, id);
	if (!session) error(404, 'No such salary check');
	if (session.template_id !== recruitmentTemplate.id) error(404, 'No such salary check');
	if (!(await isHost(locals.supabase, id))) error(403, 'This check belongs to someone else');
	return { user, session };
}

export const load: PageServerLoad = async ({ locals, params, cookies, url }) => {
	const { user, session } = await guard(locals, params.id);
	const id = session.id;

	if (session.state === 'locked') {
		// Idempotent: a fresh claim runs the engine; a recent one is a no-op.
		await claimAndOrchestrate(id);
		const again = await readSession(locals.supabase, id);
		if (again) session.state = again.state;
	}

	const [own, invite] = await Promise.all([
		readOwnPosition(locals.supabase, id),
		readCandidateInvite(locals.supabase, id)
	]);
	const submitted = session.state === 'open' ? await candidateSubmitted(id) : false;
	const candidateStatus: CandidateStatus = submitted
		? 'submitted'
		: invite?.opened
			? 'opened'
			: 'not-opened';

	let inviteUrl: string | null = null;
	const token = readInviteToken(cookies, id);
	if (token && session.state === 'open' && invite && !invite.opened && !invite.revoked) {
		inviteUrl = `${url.origin}/join/${token}`;
	} else if (token) {
		forgetInviteToken(cookies, id);
	}

	const base = {
		id,
		state: session.state,
		currency: session.currency,
		createdAt: session.created_at,
		candidateEmail: invite?.email ?? null,
		candidateStatus,
		inviteUrl,
		ownStatus: own?.status ?? null,
		ownTuple: own?.tuple ?? null
	};

	if (session.state === 'closed') {
		const result = await hostFullResult({ sub: user.id, email: user.email }, id);
		return { ...base, phase: 'closed' as Phase, result };
	}
	if (session.state === 'cancelled') return { ...base, phase: 'cancelled' as Phase, result: null };
	if (session.state === 'locked') return { ...base, phase: 'locked' as Phase, result: null };
	const phase: Phase = own?.status === 'submitted' ? 'waiting' : 'enter';
	return { ...base, phase, result: null };
};

export const actions: Actions = {
	submit: async ({ locals, params, request }) => {
		await guard(locals, params.id);
		const form = await request.formData();
		const parsed = parseTuple([form.get('v1'), form.get('v2'), form.get('v3'), form.get('v4')]);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		try {
			await savePositionAndSubmit(
				locals.supabase,
				params.id,
				RECRUITMENT_DIRECTION.budget,
				parsed.tuple
			);
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
	},
	cancel: async ({ locals, params, cookies }) => {
		await guard(locals, params.id);
		try {
			await cancelSession(locals.supabase, params.id);
		} catch (e) {
			return fail(400, { error: friendlyError(e) });
		}
		forgetInviteToken(cookies, params.id);
		return { ok: true };
	}
};
