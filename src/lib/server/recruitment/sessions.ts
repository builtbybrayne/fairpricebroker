// Recruiter-side reads for the invited recruitment composition
// (T3-m1-recruitment-core §1, §3). Everything the recruiter sees comes
// through RLS on the request-scoped client, except the candidate's
// submission STATUS (party_positions rows are visible only to their own
// party): that one fact is read under the orchestrator login role, after
// the caller has been confirmed as the session host, and only the status
// word leaves this module — never a figure.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cookies } from '@sveltejs/kit';
import { roleDb, withAuthenticatedCaller } from '$lib/server/data/db';
import { constructInvitedPayload } from '$lib/server/data/payloadConstructor';
import type { Role, Zone } from '$lib/server/engine/types';
import { recruitmentTemplate, type RecruitmentGuidance } from '$lib/templates/recruitment';
import type { Tuple } from './positions';

export type SessionState = 'open' | 'locked' | 'closed' | 'cancelled';

export interface SessionRow {
	id: string;
	state: SessionState;
	currency: string;
	created_at: string;
	template_id: string;
	host_visibility: 'blind' | 'host-visible';
}

export interface SessionListItem {
	id: string;
	state: SessionState;
	currency: string;
	createdAt: string;
	candidateEmail: string | null;
}

export async function listRecruiterSessions(supabase: SupabaseClient): Promise<SessionListItem[]> {
	const { data, error } = await supabase
		.from('sessions')
		.select('id, state, currency, created_at, invites(role, email)')
		.eq('template_id', recruitmentTemplate.id)
		.order('created_at', { ascending: false });
	if (error) throw new Error(`sessions: ${error.message}`);
	return (data ?? []).map((s) => ({
		id: s.id,
		state: s.state,
		currency: s.currency,
		createdAt: s.created_at,
		candidateEmail:
			(s.invites as { role: string; email: string | null }[] | null)?.find(
				(i) => i.role === 'high-preferring'
			)?.email ?? null
	}));
}

export async function readSession(
	supabase: SupabaseClient,
	sessionId: string
): Promise<SessionRow | null> {
	const { data, error } = await supabase
		.from('sessions')
		.select('id, state, currency, created_at, template_id, host_visibility')
		.eq('id', sessionId)
		.maybeSingle();
	if (error) throw new Error(`sessions: ${error.message}`);
	return (data as SessionRow | null) ?? null;
}

export async function isHost(supabase: SupabaseClient, sessionId: string): Promise<boolean> {
	const { data, error } = await supabase.rpc('is_session_host', { p_session_id: sessionId });
	if (error) throw new Error(`is_session_host: ${error.message}`);
	return data === true;
}

export async function roleFor(supabase: SupabaseClient, sessionId: string): Promise<Role | null> {
	const { data, error } = await supabase.rpc('session_role_for', { p_session_id: sessionId });
	if (error) throw new Error(`session_role_for: ${error.message}`);
	return (data as Role | null) ?? null;
}

/** R11: the persisted visibility fact, as the caller (guarded server-side). */
export async function visibilityFor(
	supabase: SupabaseClient,
	sessionId: string
): Promise<'blind' | 'host-visible'> {
	const { data, error } = await supabase.rpc('request_visibility_disclosure', {
		session_id: sessionId
	});
	if (error) throw new Error(`request_visibility_disclosure: ${error.message}`);
	return data as 'blind' | 'host-visible';
}

/** R11: only a host-visible session renders the pre-entry disclosure. */
export function disclosureRequired(visibility: 'blind' | 'host-visible'): boolean {
	return visibility === 'host-visible';
}

export interface CandidateInvite {
	email: string | null;
	opened: boolean;
	revoked: boolean;
	expired: boolean;
}

export async function readCandidateInvite(
	supabase: SupabaseClient,
	sessionId: string
): Promise<CandidateInvite | null> {
	const { data, error } = await supabase
		.from('invites')
		.select('email, redeemed_at, revoked_at, expires_at')
		.eq('session_id', sessionId)
		.eq('role', 'high-preferring')
		.maybeSingle();
	if (error) throw new Error(`invites: ${error.message}`);
	if (!data) return null;
	return {
		email: data.email,
		opened: data.redeemed_at !== null,
		revoked: data.revoked_at !== null,
		expired: new Date(data.expires_at).getTime() <= Date.now()
	};
}

export type CandidateStatus = 'not-opened' | 'opened' | 'submitted';

/**
 * Whether the candidate has submitted. Caller MUST already have verified
 * `isHost`. Reads only the status column; figures never leave here.
 */
export async function candidateSubmitted(sessionId: string): Promise<boolean> {
	const rows = await roleDb('orchestrator')<{ status: string }[]>`
		select status from party_positions
		where session_id = ${sessionId}::uuid and direction = 'high-preferring'
	`;
	return rows[0]?.status === 'submitted';
}

// The plaintext invite token exists only in the launch response. It is
// handed to the recruiter's session page through a short-lived, path-
// scoped cookie so a redirect can carry it without it appearing in a URL
// or being persisted; the hash is all the database has.
const TOKEN_COOKIE_TTL_SECONDS = 60 * 60;

function tokenCookieName(sessionId: string): string {
	return `fp-invite-${sessionId}`;
}

export function stashInviteToken(cookies: Cookies, sessionId: string, token: string): void {
	cookies.set(tokenCookieName(sessionId), token, {
		path: `/app/s/${sessionId}`,
		httpOnly: true,
		sameSite: 'lax',
		maxAge: TOKEN_COOKIE_TTL_SECONDS
	});
}

export function readInviteToken(cookies: Cookies, sessionId: string): string | null {
	return cookies.get(tokenCookieName(sessionId)) ?? null;
}

export function forgetInviteToken(cookies: Cookies, sessionId: string): void {
	cookies.delete(tokenCookieName(sessionId), { path: `/app/s/${sessionId}` });
}

// Result payloads ---------------------------------------------------------

interface PricePointLike {
	float: number;
	decimal: string;
}

export interface HostFullResult {
	zone: Zone;
	fair: string;
	employer: Tuple;
	candidate: Tuple;
	guidance: RecruitmentGuidance;
}

export interface PartyResult {
	zone: Zone;
	fair: string;
	own: Tuple;
	guidance: RecruitmentGuidance;
}

type Claims = { sub: string; email?: string | null };

function tupleOf(payload: Record<string, unknown>, role: Role): Tuple | null {
	const input = payload.input as Record<Role, { tuple: unknown }> | undefined;
	const t = input?.[role]?.tuple;
	if (!Array.isArray(t) || t.length !== 4) return null;
	return t.map(String) as unknown as Tuple;
}

/**
 * The host-full result for the recruiter. Throws if the server did not
 * issue the host-full class (both raw tuples present): this page never
 * renders a blind-host payload as if it were full.
 */
export async function hostFullResult(claims: Claims, sessionId: string): Promise<HostFullResult> {
	const payload = await withAuthenticatedCaller(claims, (tx) =>
		constructInvitedPayload(tx, sessionId)
	);
	const employer = tupleOf(payload, 'low-preferring');
	const candidate = tupleOf(payload, 'high-preferring');
	if (!employer || !candidate) throw new Error('payload is not host-full');
	const zone = payload.zone as Zone;
	return {
		zone,
		fair: (payload.fairPrice as PricePointLike).decimal,
		employer,
		candidate,
		guidance: recruitmentTemplate.guidance(zone)
	};
}

/** The party result: own tuple, fair figure, zone. Nothing of the other side. */
export async function partyResult(
	claims: Claims,
	sessionId: string,
	role: Role
): Promise<PartyResult> {
	const payload = await withAuthenticatedCaller(claims, (tx) =>
		constructInvitedPayload(tx, sessionId)
	);
	const own = tupleOf(payload, role);
	if (!own) throw new Error('payload carries no own tuple');
	const zone = payload.zone as Zone;
	return {
		zone,
		fair: (payload.fairPrice as PricePointLike).decimal,
		own,
		guidance: recruitmentTemplate.guidance(zone)
	};
}
