// Reads on one reconciliation for the offerer's and the responding side's
// surfaces (T3-m1-recruitment-core §1, §3, in the T3-m2 vocabulary).
// Everything comes through RLS on the request-scoped client, except one
// fact: whether a given side has SUBMITTED (figures rows are visible only
// to their own side). That is read under the orchestrator login role, after
// the caller has been confirmed as the broker, and only the status word
// leaves this module — never a figure.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	isSide,
	sideToDirection,
	type ReconciliationState,
	type Seat,
	type Side
} from '$lib/domain/terms';
import { roleDb, withAuthenticatedCaller } from '$lib/server/data/db';
import { constructPayload } from '$lib/server/data/payloadConstructor';
import type { Zone } from '$lib/server/engine/types';
import { salaryNegotiationTemplate, type SalaryGuidance } from '$lib/templates/salaryNegotiation';
import type { Tuple } from './figures';

export type { ReconciliationState };

export interface ReconciliationRow {
	id: string;
	state: ReconciliationState;
	currency: string;
	created_at: string;
	vertical: string;
	offer_id: string | null;
	broker_sees_figures: boolean;
}

export async function readReconciliation(
	supabase: SupabaseClient,
	reconciliationId: string
): Promise<ReconciliationRow | null> {
	const { data, error } = await supabase
		.from('reconciliations')
		.select('id, state, currency, created_at, vertical, offer_id, broker_sees_figures')
		.eq('id', reconciliationId)
		.maybeSingle();
	if (error) throw new Error(`reconciliations: ${error.message}`);
	return (data as ReconciliationRow | null) ?? null;
}

export async function isBroker(
	supabase: SupabaseClient,
	reconciliationId: string
): Promise<boolean> {
	const { data, error } = await supabase.rpc('is_broker', {
		p_reconciliation_id: reconciliationId
	});
	if (error) throw new Error(`is_broker: ${error.message}`);
	return data === true;
}

/** The side whose figures the caller enters here, or null when they enter none. */
export async function sideFor(
	supabase: SupabaseClient,
	reconciliationId: string
): Promise<Side | null> {
	const { data, error } = await supabase.rpc('side_for', {
		p_reconciliation_id: reconciliationId
	});
	if (error) throw new Error(`side_for: ${error.message}`);
	return isSide(data) ? data : null;
}

/** R11: the persisted disclosure fact, as the caller (guarded server-side). */
export async function brokerSeesFiguresFor(
	supabase: SupabaseClient,
	reconciliationId: string
): Promise<boolean> {
	const { data, error } = await supabase.rpc('broker_sees_figures_for', {
		p_reconciliation_id: reconciliationId
	});
	if (error) throw new Error(`broker_sees_figures_for: ${error.message}`);
	return data === true;
}

/** R11: only a broker-sees-figures reconciliation renders the pre-entry disclosure. */
export function disclosureRequired(brokerSeesFigures: boolean): boolean {
	return brokerSeesFigures;
}

export interface SeatInvite {
	email: string | null;
	opened: boolean;
	revoked: boolean;
	expired: boolean;
	/** The plaintext link token, present only until the invite is redeemed. */
	token: string | null;
}

/** The invite into one seat of a reconciliation, as the offerer sees it. */
export async function readSeatInvite(
	supabase: SupabaseClient,
	reconciliationId: string,
	seat: Seat
): Promise<SeatInvite | null> {
	const { data, error } = await supabase
		.from('invites')
		.select('email, redeemed_at, revoked_at, expires_at, plaintext_token')
		.eq('reconciliation_id', reconciliationId)
		.eq('seat', seat)
		.maybeSingle();
	if (error) throw new Error(`invites: ${error.message}`);
	if (!data) return null;
	return {
		email: data.email,
		opened: data.redeemed_at !== null,
		revoked: data.revoked_at !== null,
		expired: new Date(data.expires_at).getTime() <= Date.now(),
		token: data.plaintext_token ?? null
	};
}

export type SideProgress = 'not-opened' | 'opened' | 'submitted';

/**
 * Whether the given side has submitted. Caller MUST already have verified
 * `isBroker` (or offer membership). Reads only the status column; figures
 * never leave here.
 */
export async function sideSubmitted(reconciliationId: string, side: Side): Promise<boolean> {
	const rows = await roleDb('orchestrator')<{ status: string }[]>`
		select status from figures
		where reconciliation_id = ${reconciliationId}::uuid and side = ${side}
	`;
	return rows[0]?.status === 'submitted';
}

// Result payloads ---------------------------------------------------------

interface PricePointLike {
	float: number;
	decimal: string;
}

export interface BrokerFullResult {
	zone: Zone;
	fair: string;
	figures: Record<Side, Tuple>;
	guidance: SalaryGuidance;
}

export interface SideResult {
	zone: Zone;
	fair: string;
	own: Tuple;
	guidance: SalaryGuidance;
}

type Claims = { sub: string; email?: string | null };

/** The stored payload keeps the engine's keys; the side maps to a direction here. */
function tupleOf(payload: Record<string, unknown>, side: Side): Tuple | null {
	const input = payload.input as Record<string, { tuple: unknown }> | undefined;
	const t = input?.[sideToDirection[side]]?.tuple;
	if (!Array.isArray(t) || t.length !== 4) return null;
	return t.map(String) as unknown as Tuple;
}

/**
 * The broker-full result for the offerer's page. Throws if the server did
 * not issue the broker-full class (both raw tuples present): this page
 * never renders a broker-blind payload as if it were full.
 */
export async function brokerFullResult(
	claims: Claims,
	reconciliationId: string
): Promise<BrokerFullResult> {
	const payload = await withAuthenticatedCaller(claims, (tx) =>
		constructPayload(tx, reconciliationId)
	);
	const buyer = tupleOf(payload, 'buyer');
	const seller = tupleOf(payload, 'seller');
	if (!buyer || !seller) throw new Error('payload is not broker-full');
	const zone = payload.zone as Zone;
	return {
		zone,
		fair: (payload.fairPrice as PricePointLike).decimal,
		figures: { buyer, seller },
		guidance: salaryNegotiationTemplate.guidance(zone)
	};
}

/** The side result: own tuple, fair figure, zone. Nothing of the other side. */
export async function sideResult(
	claims: Claims,
	reconciliationId: string,
	side: Side
): Promise<SideResult> {
	const payload = await withAuthenticatedCaller(claims, (tx) =>
		constructPayload(tx, reconciliationId)
	);
	const own = tupleOf(payload, side);
	if (!own) throw new Error('payload carries no own tuple');
	const zone = payload.zone as Zone;
	return {
		zone,
		fair: (payload.fairPrice as PricePointLike).decimal,
		own,
		guidance: salaryNegotiationTemplate.guidance(zone)
	};
}
