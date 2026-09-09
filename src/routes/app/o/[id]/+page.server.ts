// The offer page: the offering side's figures (set once, editable until a
// responder answers), the response links with their progress, and
// generating more links, one credit each. Responders are identified by
// their link; the email arrives when they open it.
import { randomUUID } from 'node:crypto';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { friendlyError, parseTuple } from '$lib/server/offers/figures';
import {
	generateLinks,
	listResponses,
	listTags,
	readOffer,
	tagReconciliation,
	untagReconciliation,
	updateFigures
} from '$lib/server/offers/offers';
import { salaryNegotiationTemplate } from '$lib/templates/salaryNegotiation';

const UUID_RE = /^[0-9a-f-]{36}$/i;
const MAX_LINKS_AT_ONCE = 10;

async function guard(locals: App.Locals, id: string) {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/signin?next=${encodeURIComponent(`/app/o/${id}`)}`);
	const offer = await readOffer(locals.supabase, id);
	if (!offer) error(404, `No such ${salaryNegotiationTemplate.terms.offer.toLowerCase()}`);
	return { user, offer };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { user, offer } = await guard(locals, params.id);
	const responses = await listResponses(
		locals.supabase,
		{ sub: user.id, email: user.email },
		offer,
		url.origin
	);
	const tags = await listTags(locals.supabase, offer.vertical);
	return {
		offer,
		responses,
		tags,
		requestKey: randomUUID(),
		terms: salaryNegotiationTemplate.terms
	};
};

export const actions: Actions = {
	figures: async ({ locals, params, request }) => {
		const { offer } = await guard(locals, params.id);
		const form = await request.formData();
		const parsed = parseTuple([form.get('v1'), form.get('v2'), form.get('v3'), form.get('v4')]);
		if (!parsed.ok) return fail(400, { figuresError: parsed.error });
		try {
			await updateFigures(locals.supabase, offer, parsed.tuple);
		} catch (e) {
			return fail(400, { figuresError: friendlyError(e) });
		}
		return { figuresSaved: true };
	},
	tag: async ({ locals, params, request }) => {
		const { offer } = await guard(locals, params.id);
		const form = await request.formData();
		const reconciliationId = String(form.get('reconciliationId') ?? '');
		const name = String(form.get('name') ?? '');
		if (!UUID_RE.test(reconciliationId) || !name.trim()) {
			return fail(400, { tagError: 'Type a tag.' });
		}
		try {
			await tagReconciliation(locals.supabase, reconciliationId, name, offer.vertical);
		} catch (e) {
			return fail(400, { tagError: `Could not add the tag: ${(e as Error).message}` });
		}
		return { tagged: reconciliationId, offer: offer.id };
	},
	untag: async ({ locals, params, request }) => {
		await guard(locals, params.id);
		const form = await request.formData();
		const reconciliationId = String(form.get('reconciliationId') ?? '');
		const tagId = String(form.get('tagId') ?? '');
		if (!UUID_RE.test(reconciliationId) || !UUID_RE.test(tagId)) {
			return fail(400, { tagError: 'No such tag.' });
		}
		try {
			await untagReconciliation(locals.supabase, reconciliationId, tagId);
		} catch (e) {
			return fail(400, { tagError: `Could not remove the tag: ${(e as Error).message}` });
		}
		return { untagged: reconciliationId };
	},
	generate: async ({ locals, params, request }) => {
		const { offer } = await guard(locals, params.id);
		const form = await request.formData();
		const requestKey = String(form.get('requestKey') ?? '');
		const count = Math.min(MAX_LINKS_AT_ONCE, Math.max(1, Number(form.get('count') ?? 1) || 1));
		if (!UUID_RE.test(requestKey)) {
			return fail(400, { addError: 'This form has expired. Reload and try again.' });
		}
		const out = await generateLinks(locals.supabase, offer, requestKey, count);
		if (out.error && out.made === 0) return fail(400, { addError: out.error });
		return { generated: out.made, addError: out.error ?? undefined };
	}
};
