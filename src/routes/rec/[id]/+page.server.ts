// T3-m1-recruitment-core §3 in the T3-m2 vocabulary: the responding side's
// surface, reached via /join. R11: the disclosure fact is read server-side
// from the persisted reconciliation and renders BEFORE any figure can be
// entered. The side payload (own tuple, fair figure, zone) is the only
// result data sent.
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { claimAndOrchestrate } from '$lib/server/data/orchestrator';
import {
	friendlyError,
	parseTuple,
	readOwnFigures,
	recallFigures,
	saveFiguresAndSubmit
} from '$lib/server/offers/figures';
import {
	brokerSeesFiguresFor,
	disclosureRequired,
	readReconciliation,
	sideFor,
	sideResult
} from '$lib/server/offers/reconciliations';
import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';

export type SidePhase = 'enter' | 'sealed' | 'locked' | 'closed' | 'cancelled';

async function guard(locals: App.Locals, id: string) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(`/rec/${id}`)}`);
	const reconciliation = await readReconciliation(locals.supabase, id);
	if (!reconciliation) error(404, 'No such reconciliation');
	const side = await sideFor(locals.supabase, id);
	if (!side) error(403, 'Open your invite link to take part in this reconciliation');
	return { user, reconciliation, side };
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { user, reconciliation, side } = await guard(locals, params.id);
	const id = reconciliation.id;

	if (reconciliation.state === 'locked') {
		await claimAndOrchestrate(id);
		const again = await readReconciliation(locals.supabase, id);
		if (again) reconciliation.state = again.state;
	}

	const [own, brokerSees] = await Promise.all([
		readOwnFigures(locals.supabase, id),
		brokerSeesFiguresFor(locals.supabase, id)
	]);

	const base = {
		id,
		side,
		state: reconciliation.state,
		currency: reconciliation.currency,
		vertical: reconciliation.vertical,
		showDisclosure: disclosureRequired(brokerSees),
		ownStatus: own?.status ?? null,
		ownTuple: own?.tuple ?? null,
		terms: salaryNegotiationTemplate.terms
	};

	if (reconciliation.state === 'closed') {
		const result = await sideResult({ sub: user.id, email: user.email }, id, side);
		return { ...base, phase: 'closed' as SidePhase, result };
	}
	if (reconciliation.state === 'cancelled') {
		return { ...base, phase: 'cancelled' as SidePhase, result: null };
	}
	if (reconciliation.state === 'locked') {
		return { ...base, phase: 'locked' as SidePhase, result: null };
	}
	const phase: SidePhase = own?.status === 'submitted' ? 'sealed' : 'enter';
	return { ...base, phase, result: null };
};

export const actions: Actions = {
	submit: async ({ locals, params, request }) => {
		const { side } = await guard(locals, params.id);
		const form = await request.formData();
		const parsed = parseTuple([form.get('v1'), form.get('v2'), form.get('v3'), form.get('v4')]);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		try {
			await saveFiguresAndSubmit(locals.supabase, params.id, side, parsed.tuple);
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
