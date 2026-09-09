// Figures entry for a reconciliation, as the signed-in side through the
// request-scoped Supabase client (RLS admits the side's own row only).
// Thin adapters over the guarded functions so the agent doorway can wrap
// the same calls later (T3-m1-recruitment-core §5), in the T3-m2 vocabulary:
// a side enters figures; submit locks when both sides are in.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FiguresStatus, Side } from '$lib/domain/terms';
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

export interface OwnFigures {
	status: FiguresStatus;
	tuple: Tuple;
}

/** The caller's own row, if any (RLS returns only the caller's side). */
export async function readOwnFigures(
	supabase: SupabaseClient,
	reconciliationId: string
): Promise<OwnFigures | null> {
	const { data, error } = await supabase
		.from('figures')
		.select('status, v1, v2, v3, v4')
		.eq('reconciliation_id', reconciliationId)
		.maybeSingle();
	if (error) throw new Error(`figures: ${error.message}`);
	if (!data) return null;
	return {
		status: data.status,
		tuple: [String(data.v1), String(data.v2), String(data.v3), String(data.v4)]
	};
}

/** Insert-or-update the caller's row, then submit; orchestrates on lock. */
export async function saveFiguresAndSubmit(
	supabase: SupabaseClient,
	reconciliationId: string,
	side: Side,
	tuple: Tuple
): Promise<'open' | 'locked'> {
	const existing = await readOwnFigures(supabase, reconciliationId);
	const values = { v1: tuple[0], v2: tuple[1], v3: tuple[2], v4: tuple[3] };
	if (existing) {
		if (existing.status === 'submitted') throw new Error('already-submitted');
		const { error } = await supabase
			.from('figures')
			.update(values)
			.eq('reconciliation_id', reconciliationId)
			.eq('side', side);
		if (error) throw new Error(`save: ${error.message}`);
	} else {
		const { error } = await supabase
			.from('figures')
			.insert({ reconciliation_id: reconciliationId, side, ...values });
		if (error) throw new Error(`save: ${error.message}`);
	}
	const { data, error } = await supabase.rpc('submit_figures', {
		p_reconciliation_id: reconciliationId
	});
	if (error) throw new Error(`submit: ${error.message}`);
	const outcome = data as 'open' | 'locked';
	if (outcome === 'locked') await claimAndOrchestrate(reconciliationId);
	return outcome;
}

export async function recallFigures(
	supabase: SupabaseClient,
	reconciliationId: string
): Promise<void> {
	const { error } = await supabase.rpc('recall_figures', {
		p_reconciliation_id: reconciliationId
	});
	if (error) throw new Error(`recall: ${error.message}`);
}

export async function cancelReconciliation(
	supabase: SupabaseClient,
	reconciliationId: string
): Promise<void> {
	const { error } = await supabase.rpc('cancel_reconciliation', {
		p_reconciliation_id: reconciliationId
	});
	if (error) throw new Error(`cancel: ${error.message}`);
}

/** The guarded function's message, without the PostgREST wrapping. */
export function friendlyError(e: unknown): string {
	const msg = e instanceof Error ? e.message : String(e);
	const known: Record<string, string> = {
		'already-submitted':
			'These figures are already in. Recall them first if you need to change them.',
		'not-submitted': 'There is nothing to recall.',
		'other-side-submitted':
			'The other side has already submitted, so this can no longer be recalled.',
		'reconciliation-not-open': 'This check is no longer open.',
		'both-submitted': 'Both sides are in; this check can no longer be cancelled.',
		'no-figures': 'Enter the four figures first.',
		'not-a-side': 'You are not entering figures for a side of this check.'
	};
	for (const key of Object.keys(known)) if (msg.includes(key)) return known[key];
	return msg;
}
