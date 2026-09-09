// The role page: the client's budget (set once, editable until a candidate
// answers), the candidate links with their progress, and generating more
// links, one credit each. Candidates are identified by their link; the
// email arrives when they open it.
import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { friendlyError, parseTuple } from '$lib/server/recruitment/positions';
import {
	generateLink,
	listCandidates,
	listTags,
	readRole,
	tagCandidate,
	untagCandidate,
	updateBudget
} from '$lib/server/recruitment/roles';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_LINKS_AT_ONCE = 10;

async function guard(locals: App.Locals, id: string) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(`/app/r/${id}`)}`);
	const role = await readRole(locals.supabase, id);
	if (!role) error(404, 'No such role');
	return { user, role };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { user, role } = await guard(locals, params.id);
	const candidates = await listCandidates(
		locals.supabase,
		{ sub: user.id, email: user.email },
		role.id,
		url.origin
	);
	const tags = await listTags(locals.supabase);
	return { role, candidates, tags, requestKey: randomUUID() };
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
	tag: async ({ locals, params, request }) => {
		const { role } = await guard(locals, params.id);
		const form = await request.formData();
		const sessionId = String(form.get('sessionId') ?? '');
		const name = String(form.get('name') ?? '');
		if (!UUID_RE.test(sessionId) || !name.trim()) return fail(400, { tagError: 'Type a tag.' });
		try {
			await tagCandidate(locals.supabase, sessionId, name);
		} catch (e) {
			return fail(400, { tagError: `Could not add the tag: ${(e as Error).message}` });
		}
		return { tagged: sessionId, role: role.id };
	},
	untag: async ({ locals, params, request }) => {
		await guard(locals, params.id);
		const form = await request.formData();
		const sessionId = String(form.get('sessionId') ?? '');
		const tagId = String(form.get('tagId') ?? '');
		if (!UUID_RE.test(sessionId) || !UUID_RE.test(tagId))
			return fail(400, { tagError: 'No such tag.' });
		try {
			await untagCandidate(locals.supabase, sessionId, tagId);
		} catch (e) {
			return fail(400, { tagError: `Could not remove the tag: ${(e as Error).message}` });
		}
		return { untagged: sessionId };
	},
	generate: async ({ locals, params, request }) => {
		const { role } = await guard(locals, params.id);
		const form = await request.formData();
		const requestKey = String(form.get('requestKey') ?? '');
		const count = Math.min(MAX_LINKS_AT_ONCE, Math.max(1, Number(form.get('count') ?? 1) || 1));
		if (!UUID_RE.test(requestKey)) {
			return fail(400, { addError: 'This form has expired. Reload and try again.' });
		}
		let made = 0;
		for (let i = 0; i < count; i += 1) {
			// One request key per link so a replayed form cannot double-spend.
			const out = await generateLink(locals.supabase, role, `${requestKey}:${i}`);
			if (!out.ok) {
				if (made === 0) return fail(400, { addError: out.error });
				return { generated: made, addError: out.error };
			}
			made += 1;
		}
		return { generated: made };
	}
};
