// Position entry for an invited session, as the signed-in party through
// the request-scoped Supabase client (RLS admits the party's own row).
// Thin adapters over the guarded functions so the agent doorway can wrap
// the same calls later (T3-m1-recruitment-core §5).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '$lib/server/engine/types';
import { claimAndOrchestrate } from '$lib/server/data/orchestrator';

export type Tuple = readonly [string, string, string, string];

/** Up to nine integer digits and four decimals; commas and spaces tolerated. */
const DECIMAL_RE = /^\d{1,9}(\.\d{1,4})?$/;

export type ParsedTuple = { ok: true; tuple: Tuple } | { ok: false; error: string };

export function parseTuple(raw: readonly (FormDataEntryValue | null)[]): ParsedTuple {
	const cleaned = raw.map((v) => (typeof v === 'string' ? v.replace(/[,\s]/g, '') : ''));
	if (cleaned.some((v) => v === '')) return { ok: false, error: 'All four figures are needed.' };
	if (cleaned.some((v) => !DECIMAL_RE.test(v))) {
		return { ok: false, error: 'Figures must be plain numbers with up to four decimal places.' };
	}
	const nums = cleaned.map(Number);
	if (nums[0] <= 0) return { ok: false, error: 'Figures must be above zero.' };
	for (let i = 1; i < 4; i++) {
		if (!(nums[i] > nums[i - 1])) {
			return { ok: false, error: 'Each figure must be higher than the one before it.' };
		}
	}
	return { ok: true, tuple: cleaned as unknown as Tuple };
}

export interface OwnPosition {
	status: 'draft' | 'submitted' | 'recalled';
	tuple: Tuple;
}

/** The caller's own row, if any (RLS returns only the caller's direction). */
export async function readOwnPosition(
	supabase: SupabaseClient,
	sessionId: string
): Promise<OwnPosition | null> {
	const { data, error } = await supabase
		.from('party_positions')
		.select('status, v1, v2, v3, v4')
		.eq('session_id', sessionId)
		.maybeSingle();
	if (error) throw new Error(`party_positions: ${error.message}`);
	if (!data) return null;
	return {
		status: data.status,
		tuple: [String(data.v1), String(data.v2), String(data.v3), String(data.v4)]
	};
}

/** Insert-or-update the caller's row, then submit; orchestrates on lock. */
export async function savePositionAndSubmit(
	supabase: SupabaseClient,
	sessionId: string,
	direction: Role,
	tuple: Tuple
): Promise<'open' | 'locked'> {
	const existing = await readOwnPosition(supabase, sessionId);
	const values = { v1: tuple[0], v2: tuple[1], v3: tuple[2], v4: tuple[3] };
	if (existing) {
		if (existing.status === 'submitted') throw new Error('already-submitted');
		const { error } = await supabase
			.from('party_positions')
			.update(values)
			.eq('session_id', sessionId)
			.eq('direction', direction);
		if (error) throw new Error(`save: ${error.message}`);
	} else {
		const { error } = await supabase
			.from('party_positions')
			.insert({ session_id: sessionId, direction, ...values });
		if (error) throw new Error(`save: ${error.message}`);
	}
	const { data, error } = await supabase.rpc('submit_position', { session_id: sessionId });
	if (error) throw new Error(`submit: ${error.message}`);
	const outcome = data as 'open' | 'locked';
	if (outcome === 'locked') await claimAndOrchestrate(sessionId);
	return outcome;
}

export async function recallPosition(supabase: SupabaseClient, sessionId: string): Promise<void> {
	const { error } = await supabase.rpc('recall_position', { session_id: sessionId });
	if (error) throw new Error(`recall: ${error.message}`);
}

export async function cancelSession(supabase: SupabaseClient, sessionId: string): Promise<void> {
	const { error } = await supabase.rpc('cancel_session', { session_id: sessionId });
	if (error) throw new Error(`cancel: ${error.message}`);
}

/** The guarded function's message, without the PostgREST wrapping. */
export function friendlyError(e: unknown): string {
	const msg = e instanceof Error ? e.message : String(e);
	const known: Record<string, string> = {
		'already-submitted':
			'These figures are already in. Recall them first if you need to change them.',
		'not-submitted': 'There is nothing to recall.',
		'other-party-submitted':
			'The other side has already submitted, so this can no longer be recalled.',
		'session-not-open': 'This check is no longer open.',
		'both-submitted': 'Both sides are in; this check can no longer be cancelled.',
		'no-position': 'Enter the four figures first.'
	};
	for (const key of Object.keys(known)) if (msg.includes(key)) return known[key];
	return msg;
}
