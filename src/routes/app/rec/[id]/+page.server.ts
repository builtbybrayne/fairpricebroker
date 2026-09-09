// T3-m1-recruitment-core §3 in the T3-m2 vocabulary: the offerer's page for
// one reconciliation, state-driven. The load derives a `phase` server-side;
// the page renders exactly the panels that phase needs. The broker-full
// payload is fetched only when the reconciliation is closed, as the
// signed-in user, through the payload constructor (the sole disclosure
// authority).
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { otherSide } from '$lib/domain/terms';
import { claimAndOrchestrate } from '$lib/server/data/orchestrator';
import {
	friendlyError,
	parseTuple,
	readOwnFigures,
	recallFigures,
	saveFiguresAndSubmit
} from '$lib/server/offers/figures';
import { offerOf } from '$lib/server/offers/offers';
import {
	brokerFullResult,
	isBroker,
	readReconciliation,
	readSeatInvite,
	sideSubmitted,
	type SideProgress
} from '$lib/server/offers/reconciliations';
import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';

export type Phase = 'enter' | 'waiting' | 'locked' | 'closed' | 'cancelled';

async function guard(locals: App.Locals, id: string) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(`/app/rec/${id}`)}`);
	const reconciliation = await readReconciliation(locals.supabase, id);
	if (!reconciliation) error(404, 'No such salary check');
	if (reconciliation.vertical !== salaryNegotiationTemplate.id) error(404, 'No such salary check');
	if (!(await isBroker(locals.supabase, id))) error(403, 'This check belongs to someone else');
	return { user, reconciliation };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { user, reconciliation } = await guard(locals, params.id);
	const id = reconciliation.id;
	const offerer = salaryNegotiationTemplate.offeredBy;
	const respondent = otherSide(offerer);

	if (reconciliation.state === 'locked') {
		// Idempotent: a fresh claim runs the engine; a recent one is a no-op.
		await claimAndOrchestrate(id);
		const again = await readReconciliation(locals.supabase, id);
		if (again) reconciliation.state = again.state;
	}

	const [own, invite, offer] = await Promise.all([
		readOwnFigures(locals.supabase, id),
		readSeatInvite(locals.supabase, id, respondent),
		offerOf(locals.supabase, id, url.origin)
	]);
	const submitted = reconciliation.state === 'open' ? await sideSubmitted(id, respondent) : false;
	const respondentProgress: SideProgress = submitted
		? 'submitted'
		: invite?.opened
			? 'opened'
			: 'not-opened';

	const base = {
		id,
		state: reconciliation.state,
		currency: reconciliation.currency,
		createdAt: reconciliation.created_at,
		respondentEmail: invite?.email ?? null,
		offer,
		respondentProgress,
		ownStatus: own?.status ?? null,
		ownTuple: own?.tuple ?? null,
		terms: salaryNegotiationTemplate.terms
	};

	if (reconciliation.state === 'closed') {
		const result = await brokerFullResult({ sub: user.id, email: user.email }, id);
		return { ...base, phase: 'closed' as Phase, result };
	}
	if (reconciliation.state === 'cancelled') {
		return { ...base, phase: 'cancelled' as Phase, result: null };
	}
	if (reconciliation.state === 'locked') return { ...base, phase: 'locked' as Phase, result: null };
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
			await saveFiguresAndSubmit(
				locals.supabase,
				params.id,
				salaryNegotiationTemplate.offeredBy,
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
			await recallFigures(locals.supabase, params.id);
		} catch (e) {
			return fail(400, { error: friendlyError(e) });
		}
		return { ok: true };
	}
};
