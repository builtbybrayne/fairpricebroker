// Roles (9 Sep 2026, operator ruling): a recruitment check is for a role
// and admits many candidates, distinguished by email. The role holds the
// client budget once; each candidate is still one invited session, created
// through the credit-gated launch and joined to the role in
// `role_candidates`. When a candidate is added the role's budget is copied
// into that session and submitted as the host's position, so the check
// locks the moment the candidate answers. Editing the budget re-submits it
// on every candidate session that is still open.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import { RECRUITMENT_DIRECTION, recruitmentTemplate } from '$lib/templates/recruitment';
import type { OverlapLevel } from '$lib/templates/recruitment';
import { readOwnPosition, recallPosition, savePositionAndSubmit, type Tuple } from './positions';
import {
	candidateSubmitted,
	hostFullResult,
	readCandidateInvite,
	type SessionState
} from './sessions';

export interface RoleRow {
	id: string;
	title: string;
	currency: string;
	createdAt: string;
	budget: Tuple | null;
}

export interface RoleListItem extends RoleRow {
	candidates: { sessionId: string; email: string; state: SessionState }[];
}

type RawRole = {
	id: string;
	title: string;
	currency: string;
	created_at: string;
	v1: string | number | null;
	v2: string | number | null;
	v3: string | number | null;
	v4: string | number | null;
};

function budgetOf(r: RawRole): Tuple | null {
	if (r.v1 === null || r.v2 === null || r.v3 === null || r.v4 === null) return null;
	return [String(r.v1), String(r.v2), String(r.v3), String(r.v4)];
}

function rowOf(r: RawRole): RoleRow {
	return {
		id: r.id,
		title: r.title,
		currency: r.currency,
		createdAt: r.created_at,
		budget: budgetOf(r)
	};
}

export async function createRole(
	supabase: SupabaseClient,
	input: { title: string; currency: string; budget: Tuple | null }
): Promise<string> {
	const values = input.budget
		? { v1: input.budget[0], v2: input.budget[1], v3: input.budget[2], v4: input.budget[3] }
		: {};
	const { data, error } = await supabase
		.from('roles')
		.insert({ title: input.title, currency: input.currency, ...values })
		.select('id')
		.single();
	if (error) throw new Error(`roles: ${error.message}`);
	return data.id as string;
}

export async function readRole(supabase: SupabaseClient, roleId: string): Promise<RoleRow | null> {
	const { data, error } = await supabase
		.from('roles')
		.select('id, title, currency, created_at, v1, v2, v3, v4')
		.eq('id', roleId)
		.maybeSingle();
	if (error) throw new Error(`roles: ${error.message}`);
	return data ? rowOf(data as RawRole) : null;
}

export async function listRoles(supabase: SupabaseClient): Promise<RoleListItem[]> {
	const { data, error } = await supabase
		.from('roles')
		.select(
			'id, title, currency, created_at, v1, v2, v3, v4, role_candidates(session_id, email, sessions(state))'
		)
		.order('created_at', { ascending: false });
	if (error) throw new Error(`roles: ${error.message}`);
	type Raw = RawRole & {
		role_candidates: {
			session_id: string;
			email: string;
			sessions: { state: SessionState } | null;
		}[];
	};
	return ((data ?? []) as unknown as Raw[]).map((r) => ({
		...rowOf(r),
		candidates: (r.role_candidates ?? []).map((c) => ({
			sessionId: c.session_id,
			email: c.email,
			state: c.sessions?.state ?? 'open'
		}))
	}));
}

/** Sets the role's budget and re-submits it on every candidate check still open. */
export async function updateBudget(
	supabase: SupabaseClient,
	roleId: string,
	budget: Tuple
): Promise<{ updated: number }> {
	const { error } = await supabase
		.from('roles')
		.update({ v1: budget[0], v2: budget[1], v3: budget[2], v4: budget[3] })
		.eq('id', roleId);
	if (error) throw new Error(`roles: ${error.message}`);
	const open = await openCandidateSessions(supabase, roleId);
	let updated = 0;
	for (const sessionId of open) {
		const own = await readOwnPosition(supabase, sessionId);
		if (own?.status === 'submitted') await recallPosition(supabase, sessionId);
		await savePositionAndSubmit(supabase, sessionId, RECRUITMENT_DIRECTION.budget, budget);
		updated += 1;
	}
	return { updated };
}

async function openCandidateSessions(supabase: SupabaseClient, roleId: string): Promise<string[]> {
	const { data, error } = await supabase
		.from('role_candidates')
		.select('session_id, sessions(state)')
		.eq('role_id', roleId);
	if (error) throw new Error(`role_candidates: ${error.message}`);
	type Raw = { session_id: string; sessions: { state: SessionState } | null };
	return ((data ?? []) as unknown as Raw[])
		.filter((c) => c.sessions?.state === 'open')
		.map((c) => c.session_id);
}

export type AddCandidateOutcome =
	{ ok: true; sessionId: string; plaintextToken: string } | { ok: false; error: string };

/**
 * One credit, one invited session, one join row, and the role's budget
 * submitted as the host's position so the check locks on the candidate's
 * answer.
 */
export async function addCandidate(
	supabase: SupabaseClient,
	role: RoleRow,
	email: string,
	requestKey: string
): Promise<AddCandidateOutcome> {
	if (!role.budget) return { ok: false, error: 'Set the client budget before adding candidates.' };
	const { data, error } = await supabase.rpc('launch_invited_session', {
		p_request_key: requestKey,
		template_id: recruitmentTemplate.id,
		currency: role.currency,
		composition: 'creator-as-host',
		visit_id: null,
		creator_direction: RECRUITMENT_DIRECTION.budget,
		invite_grants: [{ role: RECRUITMENT_DIRECTION.candidate, email }]
	});
	if (error) {
		const msg = error.message.includes('insufficient-credits')
			? 'You have no credits left, so another candidate cannot be added.'
			: error.message.includes('duplicate-request')
				? 'That candidate was already added. Reload to see them.'
				: `Could not add the candidate: ${error.message}`;
		return { ok: false, error: msg };
	}
	const row = (data as { session_id: string; plaintext_token: string }[] | null)?.[0];
	if (!row) return { ok: false, error: 'The check was not created.' };
	const join = await supabase
		.from('role_candidates')
		.insert({ role_id: role.id, session_id: row.session_id, email });
	if (join.error) {
		const msg = join.error.message.includes('duplicate')
			? 'That email is already a candidate for this role.'
			: `Could not attach the candidate: ${join.error.message}`;
		return { ok: false, error: msg };
	}
	await savePositionAndSubmit(supabase, row.session_id, RECRUITMENT_DIRECTION.budget, role.budget);
	return { ok: true, sessionId: row.session_id, plaintextToken: row.plaintext_token };
}

export type CandidateProgress = 'not-opened' | 'opened' | 'answered' | 'result' | 'cancelled';

export interface CandidateView {
	sessionId: string;
	email: string;
	state: SessionState;
	progress: CandidateProgress;
	/** Only when the check is closed. */
	fair: string | null;
	overlap: OverlapLevel | null;
	nonRemunerationInPlay: boolean | null;
}

type Claims = { sub: string; email?: string | null };

export async function listCandidates(
	supabase: SupabaseClient,
	claims: Claims,
	roleId: string
): Promise<CandidateView[]> {
	const { data, error } = await supabase
		.from('role_candidates')
		.select('session_id, email, created_at, sessions(state)')
		.eq('role_id', roleId)
		.order('created_at', { ascending: true });
	if (error) throw new Error(`role_candidates: ${error.message}`);
	type Raw = { session_id: string; email: string; sessions: { state: SessionState } | null };
	const rows = (data ?? []) as unknown as Raw[];
	return Promise.all(
		rows.map(async (c) => {
			const state = c.sessions?.state ?? 'open';
			const base = {
				sessionId: c.session_id,
				email: c.email,
				state,
				fair: null as string | null,
				overlap: null as OverlapLevel | null,
				nonRemunerationInPlay: null as boolean | null
			};
			if (state === 'cancelled') return { ...base, progress: 'cancelled' as const };
			if (state === 'closed') {
				const r = await hostFullResult(claims, c.session_id);
				return {
					...base,
					progress: 'result' as const,
					fair: r.fair,
					overlap: r.guidance.overlap,
					nonRemunerationInPlay: r.guidance.nonRemunerationInPlay
				};
			}
			if (state === 'locked') return { ...base, progress: 'answered' as const };
			const [invite, submitted] = await Promise.all([
				readCandidateInvite(supabase, c.session_id),
				candidateSubmitted(c.session_id)
			]);
			return {
				...base,
				progress: submitted
					? ('answered' as const)
					: invite?.opened
						? ('opened' as const)
						: ('not-opened' as const)
			};
		})
	);
}

/** Which role, if any, a session belongs to (for the session page's back link). */
export async function roleOfSession(
	supabase: SupabaseClient,
	sessionId: string
): Promise<{ id: string; title: string } | null> {
	const { data, error } = await supabase
		.from('role_candidates')
		.select('role_id, roles(title)')
		.eq('session_id', sessionId)
		.maybeSingle();
	if (error) throw new Error(`role_candidates: ${error.message}`);
	if (!data) return null;
	const roles = data.roles as unknown as { title: string } | null;
	return { id: data.role_id as string, title: roles?.title ?? 'Role' };
}

// Fresh invite links are shown once, on the role page, from a short-lived
// cookie scoped to that page. One cookie per candidate session.
const TOKEN_COOKIE_TTL_SECONDS = 60 * 60;
const PREFIX = 'fp-role-invite-';

export function stashRoleInviteToken(
	cookies: Cookies,
	roleId: string,
	sessionId: string,
	token: string
): void {
	cookies.set(`${PREFIX}${sessionId}`, token, {
		path: `/app/r/${roleId}`,
		httpOnly: true,
		sameSite: 'lax',
		maxAge: TOKEN_COOKIE_TTL_SECONDS
	});
}

export function readRoleInviteTokens(cookies: Cookies): Record<string, string> {
	const out: Record<string, string> = {};
	for (const c of cookies.getAll()) {
		if (c.name.startsWith(PREFIX)) out[c.name.slice(PREFIX.length)] = c.value;
	}
	return out;
}

export function forgetRoleInviteToken(cookies: Cookies, roleId: string, sessionId: string): void {
	cookies.delete(`${PREFIX}${sessionId}`, { path: `/app/r/${roleId}` });
}
