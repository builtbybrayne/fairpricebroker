// Offers (T3-m2-domain-terms §2–§3): a standing offer by one side, in one
// vertical, collecting reconciliations, one per respondent. The offerer's
// figures stand once on the offer; each response is one reconciliation
// created through the credit-gated launch with `offer_id` set. The creator
// takes the broker seat acting for the offering side, so the offerer sees
// every response in full (broker-full) while each responder sees only
// their own. When a link is generated the offer's figures are copied in and
// submitted for the offering side, so the reconciliation locks the moment
// the responder answers. Editing the figures re-submits them on every
// response still open.
//
// Ownership is an access map (§4): an offer belongs to the map it points
// at; today that is the creator's personal map.
import type { SupabaseClient } from '@supabase/supabase-js';
import { otherSide, type ReconciliationState, type Side, type VerticalId } from '$lib/domain/terms';
import { roleDb } from '$lib/server/data/db';
import type { OverlapLevel } from '$lib/templates/salaryNegotiation';
import { readOwnFigures, recallFigures, saveFiguresAndSubmit, type Tuple } from './figures';
import { brokerFullResult, sideSubmitted } from './reconciliations';

export interface OfferRow {
	id: string;
	vertical: VerticalId;
	offeredBy: Side;
	title: string;
	currency: string;
	createdAt: string;
	/** The offerer's four figures; null until entered. */
	figures: Tuple | null;
}

export interface OfferListItem extends OfferRow {
	responses: { reconciliationId: string; email: string | null; state: ReconciliationState }[];
}

type RawOffer = {
	id: string;
	vertical: string;
	offered_by: Side;
	title: string;
	currency: string;
	created_at: string;
	v1: string | number | null;
	v2: string | number | null;
	v3: string | number | null;
	v4: string | number | null;
};

type RawInvite = {
	seat: string;
	email: string | null;
	plaintext_token?: string | null;
	redeemed_at?: string | null;
	revoked_at?: string | null;
	expires_at?: string;
};

function figuresOf(r: RawOffer): Tuple | null {
	if (r.v1 === null || r.v2 === null || r.v3 === null || r.v4 === null) return null;
	return [String(r.v1), String(r.v2), String(r.v3), String(r.v4)];
}

function rowOf(r: RawOffer): OfferRow {
	return {
		id: r.id,
		vertical: r.vertical as VerticalId,
		offeredBy: r.offered_by,
		title: r.title,
		currency: r.currency,
		createdAt: r.created_at,
		figures: figuresOf(r)
	};
}

/** The caller's personal access map (created on first call). */
export async function personalMap(supabase: SupabaseClient): Promise<string> {
	const { data, error } = await supabase.rpc('personal_map');
	if (error) throw new Error(`personal_map: ${error.message}`);
	return data as string;
}

export async function createOffer(
	supabase: SupabaseClient,
	input: {
		vertical: VerticalId;
		offeredBy: Side;
		title: string;
		currency: string;
		figures: Tuple | null;
	}
): Promise<string> {
	const mapId = await personalMap(supabase);
	const values = input.figures
		? { v1: input.figures[0], v2: input.figures[1], v3: input.figures[2], v4: input.figures[3] }
		: {};
	const { data, error } = await supabase
		.from('offers')
		.insert({
			vertical: input.vertical,
			offered_by: input.offeredBy,
			title: input.title,
			currency: input.currency,
			access_map_id: mapId,
			...values
		})
		.select('id')
		.single();
	if (error) throw new Error(`offers: ${error.message}`);
	return data.id as string;
}

export async function readOffer(
	supabase: SupabaseClient,
	offerId: string
): Promise<OfferRow | null> {
	const { data, error } = await supabase
		.from('offers')
		.select('id, vertical, offered_by, title, currency, created_at, v1, v2, v3, v4')
		.eq('id', offerId)
		.maybeSingle();
	if (error) throw new Error(`offers: ${error.message}`);
	return data ? rowOf(data as RawOffer) : null;
}

export async function listOffers(
	supabase: SupabaseClient,
	vertical: VerticalId
): Promise<OfferListItem[]> {
	const { data, error } = await supabase
		.from('offers')
		.select(
			'id, vertical, offered_by, title, currency, created_at, v1, v2, v3, v4, ' +
				'reconciliations(id, state, created_at, invites(seat, email))'
		)
		.eq('vertical', vertical)
		.order('created_at', { ascending: false });
	if (error) throw new Error(`offers: ${error.message}`);
	type Raw = RawOffer & {
		reconciliations: {
			id: string;
			state: ReconciliationState;
			created_at: string;
			invites: RawInvite[] | null;
		}[];
	};
	return ((data ?? []) as unknown as Raw[]).map((r) => {
		const respondent = otherSide(r.offered_by);
		return {
			...rowOf(r),
			responses: (r.reconciliations ?? [])
				.sort((a, b) => a.created_at.localeCompare(b.created_at))
				.map((rec) => ({
					reconciliationId: rec.id,
					email: rec.invites?.find((i) => i.seat === respondent)?.email ?? null,
					state: rec.state
				}))
		};
	});
}

/** Sets the offer's figures and re-submits them on every response still open. */
export async function updateFigures(
	supabase: SupabaseClient,
	offer: OfferRow,
	figures: Tuple
): Promise<{ updated: number }> {
	const { error } = await supabase
		.from('offers')
		.update({ v1: figures[0], v2: figures[1], v3: figures[2], v4: figures[3] })
		.eq('id', offer.id);
	if (error) throw new Error(`offers: ${error.message}`);
	const open = await openReconciliations(supabase, offer.id);
	let updated = 0;
	for (const reconciliationId of open) {
		const own = await readOwnFigures(supabase, reconciliationId);
		if (own?.status === 'submitted') await recallFigures(supabase, reconciliationId);
		await saveFiguresAndSubmit(supabase, reconciliationId, offer.offeredBy, figures);
		updated += 1;
	}
	return { updated };
}

async function openReconciliations(supabase: SupabaseClient, offerId: string): Promise<string[]> {
	const { data, error } = await supabase
		.from('reconciliations')
		.select('id')
		.eq('offer_id', offerId)
		.eq('state', 'open');
	if (error) throw new Error(`reconciliations: ${error.message}`);
	return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export type GenerateOutcome =
	{ ok: true; reconciliationId: string; plaintextToken: string } | { ok: false; error: string };

/**
 * One credit, one reconciliation on the offer with an unbound single-use
 * invite into the responding seat (its plaintext link kept until used),
 * and the offer's figures submitted for the offering side so the
 * reconciliation locks on the responder's answer. Responders are
 * identified by the link; their email is learned when they open it.
 */
export async function generateLink(
	supabase: SupabaseClient,
	offer: OfferRow,
	requestKey: string
): Promise<GenerateOutcome> {
	if (!offer.figures) return { ok: false, error: 'Enter the figures before generating links.' };
	const respondent = otherSide(offer.offeredBy);
	const { data, error } = await supabase.rpc('launch_reconciliation', {
		p_request_key: requestKey,
		p_vertical: offer.vertical,
		p_currency: offer.currency,
		p_creator_seat: 'broker',
		p_creator_acts_for: offer.offeredBy,
		p_visit_id: null,
		p_invite_grants: [{ seat: respondent }],
		p_offer_id: offer.id
	});
	if (error) {
		const msg = error.message.includes('insufficient-credits')
			? 'You have no credits left, so another link cannot be generated.'
			: error.message.includes('duplicate-request')
				? 'Those links were already generated. Reload to see them.'
				: `Could not generate the link: ${error.message}`;
		return { ok: false, error: msg };
	}
	const row = (data as { reconciliation_id: string; plaintext_token: string }[] | null)?.[0];
	if (!row) return { ok: false, error: 'The check was not created.' };
	await saveFiguresAndSubmit(supabase, row.reconciliation_id, offer.offeredBy, offer.figures);
	return { ok: true, reconciliationId: row.reconciliation_id, plaintextToken: row.plaintext_token };
}

/** `count` links, one request key each so a replayed form cannot double-spend. */
export async function generateLinks(
	supabase: SupabaseClient,
	offer: OfferRow,
	requestKey: string,
	count: number
): Promise<{ made: number; error: string | null }> {
	let made = 0;
	for (let i = 0; i < count; i += 1) {
		const out = await generateLink(supabase, offer, `${requestKey}:${i}`);
		if (!out.ok) return { made, error: out.error };
		made += 1;
	}
	return { made, error: null };
}

export type ResponseProgress = 'not-opened' | 'opened' | 'answered' | 'result' | 'cancelled';

export interface ResponseView {
	reconciliationId: string;
	/** Known once the responder has opened their link. */
	email: string | null;
	/** The private link, shown until it is used. */
	link: string | null;
	copyable: boolean;
	tags: { id: string; name: string }[];
	createdAt: string;
	state: ReconciliationState;
	progress: ResponseProgress;
	/** Only when the reconciliation is closed. */
	fair: string | null;
	overlap: OverlapLevel | null;
	nonRemunerationInPlay: boolean | null;
	figures: Record<Side, Tuple> | null;
	computedAt: string | null;
}

type Claims = { sub: string; email?: string | null };

/** Every response on the offer, oldest first, with what the offerer may see of each. */
export async function listResponses(
	supabase: SupabaseClient,
	claims: Claims,
	offer: OfferRow,
	origin: string
): Promise<ResponseView[]> {
	const respondent = otherSide(offer.offeredBy);
	const { data, error } = await supabase
		.from('reconciliations')
		.select(
			'id, state, created_at, ' +
				'invites(seat, email, plaintext_token, redeemed_at, revoked_at, expires_at), ' +
				'tag_links(tags(id, name))'
		)
		.eq('offer_id', offer.id)
		.order('created_at', { ascending: true });
	if (error) throw new Error(`reconciliations: ${error.message}`);
	type Raw = {
		id: string;
		state: ReconciliationState;
		created_at: string;
		invites: RawInvite[] | null;
		tag_links: { tags: { id: string; name: string } | null }[] | null;
	};
	const rows = (data ?? []) as unknown as Raw[];
	return Promise.all(
		rows.map(async (rec) => {
			const invite = rec.invites?.find((i) => i.seat === respondent) ?? null;
			const opened = !!invite?.redeemed_at;
			const token = invite?.plaintext_token ?? null;
			const base = {
				reconciliationId: rec.id,
				email: invite?.email ?? null,
				link: token ? `${origin}/join/${token}` : null,
				copyable: !!token && !opened,
				tags: (rec.tag_links ?? [])
					.map((t) => t.tags)
					.filter((t): t is { id: string; name: string } => t !== null)
					.sort((a, b) => a.name.localeCompare(b.name)),
				createdAt: rec.created_at,
				state: rec.state,
				fair: null as string | null,
				overlap: null as OverlapLevel | null,
				nonRemunerationInPlay: null as boolean | null,
				figures: null as Record<Side, Tuple> | null,
				computedAt: null as string | null
			};
			if (rec.state === 'cancelled') return { ...base, progress: 'cancelled' as const };
			if (rec.state === 'closed') {
				const [r, computedAt] = await Promise.all([
					brokerFullResult(claims, rec.id),
					resultComputedAt(rec.id)
				]);
				return {
					...base,
					progress: 'result' as const,
					fair: r.fair,
					overlap: r.guidance.overlap,
					nonRemunerationInPlay: r.guidance.nonRemunerationInPlay,
					figures: r.figures,
					computedAt
				};
			}
			if (rec.state === 'locked') return { ...base, progress: 'answered' as const };
			const submitted = await sideSubmitted(rec.id, respondent);
			return {
				...base,
				progress: submitted
					? ('answered' as const)
					: opened
						? ('opened' as const)
						: ('not-opened' as const)
			};
		})
	);
}

/** When the engine closed the reconciliation. Read under the payload-reader role; only the timestamp leaves. */
async function resultComputedAt(reconciliationId: string): Promise<string | null> {
	const rows = await roleDb('payload_reader')<{ computed_at: string }[]>`
		select computed_at from results where reconciliation_id = ${reconciliationId}::uuid
	`;
	return rows[0]?.computed_at ?? null;
}

/** Which offer a reconciliation belongs to, with its link (copyable only until opened). */
export async function offerOf(
	supabase: SupabaseClient,
	reconciliationId: string,
	origin: string
): Promise<{ id: string; title: string; link: string | null; copyable: boolean } | null> {
	const { data, error } = await supabase
		.from('reconciliations')
		.select('offer_id, offers(title, offered_by), invites(seat, plaintext_token, redeemed_at)')
		.eq('id', reconciliationId)
		.maybeSingle();
	if (error) throw new Error(`reconciliations: ${error.message}`);
	if (!data || !data.offer_id) return null;
	const offer = data.offers as unknown as { title: string; offered_by: Side } | null;
	const respondent = otherSide(offer?.offered_by ?? 'buyer');
	const invite =
		((data.invites as unknown as RawInvite[] | null) ?? []).find((i) => i.seat === respondent) ??
		null;
	const token = invite?.plaintext_token ?? null;
	return {
		id: data.offer_id as string,
		title: offer?.title ?? 'Offer',
		link: token ? `${origin}/join/${token}` : null,
		copyable: !!token && !invite?.redeemed_at
	};
}

// Tags: invented by the offerer, owned through their access map, per vertical

export interface Tag {
	id: string;
	name: string;
}

export async function listTags(supabase: SupabaseClient, vertical: VerticalId): Promise<Tag[]> {
	const { data, error } = await supabase
		.from('tags')
		.select('id, name')
		.eq('vertical', vertical)
		.order('name');
	if (error) throw new Error(`tags: ${error.message}`);
	return (data ?? []) as Tag[];
}

/** Find-or-create the tag by name in the caller's personal map, then link it to the reconciliation. */
export async function tagReconciliation(
	supabase: SupabaseClient,
	reconciliationId: string,
	name: string,
	vertical: VerticalId
): Promise<void> {
	const clean = name.trim().slice(0, 40);
	if (!clean) throw new Error('empty-tag');
	const existing = await supabase
		.from('tags')
		.select('id')
		.eq('vertical', vertical)
		.eq('name', clean)
		.maybeSingle();
	if (existing.error) throw new Error(`tags: ${existing.error.message}`);
	let tagId = existing.data?.id as string | undefined;
	if (!tagId) {
		const mapId = await personalMap(supabase);
		const created = await supabase
			.from('tags')
			.insert({ access_map_id: mapId, vertical, name: clean })
			.select('id')
			.single();
		if (created.error) throw new Error(`tags: ${created.error.message}`);
		tagId = created.data.id as string;
	}
	// A plain insert: tagging twice is a no-op (23505), not an error.
	const { error } = await supabase
		.from('tag_links')
		.insert({ reconciliation_id: reconciliationId, tag_id: tagId });
	if (error && error.code !== '23505') throw new Error(`tag_links: ${error.message}`);
}

export async function untagReconciliation(
	supabase: SupabaseClient,
	reconciliationId: string,
	tagId: string
): Promise<void> {
	const { error } = await supabase
		.from('tag_links')
		.delete()
		.eq('reconciliation_id', reconciliationId)
		.eq('tag_id', tagId);
	if (error) throw new Error(`tag_links: ${error.message}`);
}
