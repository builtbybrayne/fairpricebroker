// T3-m1-data-core §2.7 (T3-m2 vocabulary): stored-result payload classes
// as explicit key allowlists — side / broker-blind / broker-full /
// developer. Casual payloads are built by T3-m1-casual-mode's
// buildCasualResultPayload; this module constructs only stored payloads.
//
// The stored result keeps the ENGINE's keys (input['low-preferring'],
// distances['high-preferring']); a side is mapped onto them here, at the
// edge, through sideToDirection — nowhere else.
import { sideToDirection, type Side } from '$lib/domain/terms';
import type { ReconcileResult } from '$lib/server/engine';
import type { CallerSql } from './db';
import { readRawResult } from './rawResultReader';
import { resolveViewer, type Viewer } from './principal';

export type SafePayload = Record<string, unknown>;

export const PER_SIDE_SAFE_KEYS = [
	'zone',
	'fairPrice',
	'convergenceAchieved',
	'convergedTrivially',
	'meta'
] as const;
export const OWN_DISTANCE_KEY = (side: Side) => `distances.${sideToDirection[side]}` as const;
export const OWN_INPUT_KEY = (side: Side) => `input.${sideToDirection[side]}` as const;
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

function assignByPath(target: SafePayload, path: string, value: unknown): void {
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

export function redact(result: ReconcileResult, viewer: Viewer): SafePayload {
	const out: SafePayload = {};
	const assign = (path: string) => assignByPath(out, path, readByPath(result, path));
	for (const path of PER_SIDE_SAFE_KEYS) assign(path);
	if (viewer.kind === 'side') {
		assign(OWN_DISTANCE_KEY(viewer.side));
		assign(OWN_INPUT_KEY(viewer.side));
	} else if (viewer.kind === 'broker' || viewer.kind === 'developer') {
		assign(OWN_DISTANCE_KEY('buyer'));
		assign(OWN_DISTANCE_KEY('seller'));
	}
	if ((viewer.kind === 'broker' && viewer.full) || viewer.kind === 'developer') {
		for (const path of RAW_INPUT_KEYS) assign(path);
	}
	if (viewer.kind === 'developer') {
		for (const path of DEVELOPER_ONLY_KEYS) assign(path);
	}
	return out;
}

/**
 * Builds the viewer-safe payload for `reconciliationId` for the principal
 * behind `caller` (an authenticated-role transaction carrying the verified
 * JWT claims). The viewer is resolved inside; never accepted from the caller.
 */
export async function constructPayload(
	caller: CallerSql,
	reconciliationId: string
): Promise<SafePayload> {
	const viewer = await resolveViewer(caller, reconciliationId);
	if (viewer.kind === 'none') throw new Error('no resolvable viewer for this reconciliation');
	const result = (await readRawResult(reconciliationId)) as ReconcileResult;
	return redact(result, viewer);
}

/** T2-product-surfaces §9 R11: the pre-entry disclosure fact — does the broker see both sides' figures? */
export async function getBrokerSeesFigures(
	caller: CallerSql,
	reconciliationId: string
): Promise<boolean> {
	const rows = await caller<{ v: boolean }[]>`
		select broker_sees_figures_for(${reconciliationId}::uuid) as v
	`;
	return rows[0].v;
}
