// T3-m1-data-core §2.7: stored-session payload classes as explicit key
// allowlists. Casual payloads are built by T3-m1-casual-mode's
// buildCasualResultPayload; this brief constructs only stored-session
// payloads (party / blind-host / host-full / developer).
import type { ReconcileResult, Role } from '$lib/server/engine';
import type { CallerSql } from './db';
import { readRawResult } from './rawResultReader';
import { resolveInvitedViewer, type InvitedViewer } from './principal';

export type RoleSafePayload = Record<string, unknown>;

export const PER_PARTY_SAFE_KEYS = [
	'zone',
	'fairPrice',
	'convergenceAchieved',
	'convergedTrivially',
	'meta'
] as const;
export const OWN_DISTANCE_KEY = (role: Role) => `distances.${role}` as const;
export const OWN_INPUT_KEY = (role: Role) => `input.${role}` as const;
export const RAW_INPUT_KEYS = ['input.low-preferring', 'input.high-preferring'] as const;
export const DEVELOPER_ONLY_KEYS = [
	'hasComfortZone',
	'overlap',
	'overlapLow',
	'overlapHigh',
	'dealLow',
	'dealHigh',
	'gap',
	'layers',
	'honesty.low-preferring',
	'honesty.high-preferring',
	'curves'
] as const;

function readByPath(obj: unknown, path: string): unknown {
	return path.split('.').reduce<unknown>((acc, key) => {
		if (acc === null || typeof acc !== 'object') return undefined;
		return (acc as Record<string, unknown>)[key];
	}, obj);
}

function assignByPath(target: RoleSafePayload, path: string, value: unknown): void {
	if (value === undefined) return;
	const parts = path.split('.');
	let cursor: Record<string, unknown> = target;
	for (const part of parts.slice(0, -1)) {
		const next = cursor[part];
		if (next === undefined || next === null || typeof next !== 'object') {
			cursor[part] = {};
		}
		cursor = cursor[part] as Record<string, unknown>;
	}
	cursor[parts[parts.length - 1]] = value;
}

export function redactInvited(result: ReconcileResult, viewer: InvitedViewer): RoleSafePayload {
	const out: RoleSafePayload = {};
	const assign = (path: string) => assignByPath(out, path, readByPath(result, path));
	for (const path of PER_PARTY_SAFE_KEYS) assign(path);
	if (viewer.kind === 'party') {
		assign(OWN_DISTANCE_KEY(viewer.role));
		assign(OWN_INPUT_KEY(viewer.role));
	} else if (viewer.kind === 'host' || viewer.kind === 'developer') {
		assign(OWN_DISTANCE_KEY('low-preferring'));
		assign(OWN_DISTANCE_KEY('high-preferring'));
	}
	if ((viewer.kind === 'host' && viewer.hostFull) || viewer.kind === 'developer') {
		for (const path of RAW_INPUT_KEYS) assign(path);
	}
	if (viewer.kind === 'developer') {
		for (const path of DEVELOPER_ONLY_KEYS) assign(path);
	}
	return out;
}

/**
 * Builds the role-safe payload for `sessionId` for the principal behind
 * `caller` (an authenticated-role transaction carrying the verified JWT
 * claims). The viewer is resolved inside; never accepted from the caller.
 */
export async function constructInvitedPayload(
	caller: CallerSql,
	sessionId: string
): Promise<RoleSafePayload> {
	const viewer = await resolveInvitedViewer(caller, sessionId);
	if (viewer.kind === 'none') throw new Error('no resolvable role for this session');
	const result = (await readRawResult(sessionId)) as ReconcileResult;
	return redactInvited(result, viewer);
}

/** T2-product-surfaces §9 R11 pre-entry disclosure fact. */
export async function getVisibilityDisclosure(
	caller: CallerSql,
	sessionId: string
): Promise<'blind' | 'host-visible'> {
	const rows = await caller<{ v: 'blind' | 'host-visible' }[]>`
		select request_visibility_disclosure(${sessionId}::uuid) as v
	`;
	return rows[0].v;
}
