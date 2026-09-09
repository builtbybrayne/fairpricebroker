// The role page: the client's budget (set once, editable until a candidate
// answers), the candidates with their progress, and adding a candidate,
// which spends one credit and shows their private link once.
import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { normaliseEmail } from '$lib/server/auth/naiveSignIn';
import { friendlyError, parseTuple } from '$lib/server/recruitment/positions';
import {
	addCandidate,
	forgetRoleInviteToken,
	listCandidates,
	readRole,
	readRoleInviteTokens,
	stashRoleInviteToken,
	updateBudget
} from '$lib/server/recruitment/roles';

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function guard(locals: App.Locals, id: string) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(`/app/r/${id}`)}`);
	const role = await readRole(locals.supabase, id);
	if (!role) error(404, 'No such role');
	return { user, role };
}

export const load: PageServerLoad = async ({ locals, params, cookies, url }) => {
	const { user, role } = await guard(locals, params.id);
	const candidates = await listCandidates(
		locals.supabase,
		{ sub: user.id, email: user.email },
		role.id
	);
	// Fresh links, shown once: only for candidates who have not opened theirs.
	const tokens = readRoleInviteTokens(cookies);
	const inviteUrls: Record<string, string> = {};
	for (const c of candidates) {
		const t = tokens[c.sessionId];
		if (!t) continue;
		if (c.state === 'open' && c.progress === 'not-opened') {
			inviteUrls[c.sessionId] = `${url.origin}/join/${t}`;
		} else {
			forgetRoleInviteToken(cookies, role.id, c.sessionId);
		}
	}
	return { role, candidates, inviteUrls, requestKey: randomUUID() };
};

export const actions: Actions = {
	budget: async ({ locals, params, request }) => {
		const { role } = await guard(locals, params.id);
		const form = await request.formData();
		const parsed = parseTuple([form.get('v1'), form.get('v2'), form.get('v3'), form.get('v4')]);
		if (!parsed.ok) return fail(400, { budgetError: parsed.error });
		try {
			await updateBudget(locals.supabase, role.id, parsed.tuple);
		} catch (e) {
			return fail(400, { budgetError: friendlyError(e) });
		}
		return { budgetSaved: true };
	},
	add: async ({ locals, params, request, cookies }) => {
		const { user, role } = await guard(locals, params.id);
		const form = await request.formData();
		const rawEmail = form.get('email');
		const email = normaliseEmail(rawEmail);
		const requestKey = String(form.get('requestKey') ?? '');
		const values = { email: typeof rawEmail === 'string' ? rawEmail : '' };
		if (!email) return fail(400, { ...values, addError: "Enter the candidate's email address." });
		if ((user.email ?? '').toLowerCase() === email) {
			return fail(400, { ...values, addError: "The candidate's email must differ from your own." });
		}
		if (!UUID_RE.test(requestKey)) {
			return fail(400, { ...values, addError: 'This form has expired. Reload and try again.' });
		}
		const out = await addCandidate(locals.supabase, role, email, requestKey);
		if (!out.ok) return fail(400, { ...values, addError: out.error });
		stashRoleInviteToken(cookies, role.id, out.sessionId, out.plaintextToken);
		return { added: out.sessionId };
	}
};
