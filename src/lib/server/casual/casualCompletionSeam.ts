// T3-m1-casual-mode §6 / seam contract v2: the one data-layer seam casual
// mode needs — `completeCasualPlay`, transactional and idempotent AS A
// WHOLE (same idempotencyKey -> same shareRef, exactly one completion
// event and one share_refs row).
//
// Two implementations of the same interface:
//   - inMemoryCasualPlayCompleter (§6.1) — the self-executing stand-in,
//     used by the unit tests and selectable for demos.
//   - dbCasualPlayCompleter — Stage-2 wiring (§6): delegates to data-core's
//     real advisory-locked transaction in src/lib/server/data/events.ts.
import { randomBytes } from 'node:crypto';
import { completeCasualPlay as dbCompleteCasualPlay } from '$lib/server/data/events';
import { isRefCode, type RefCode } from '$lib/server/refCodes';

export interface CasualPlayCompletion {
	readonly ref: RefCode | null;
	readonly templateId: string;
	readonly idempotencyKey: string;
}

export interface CasualPlayCompleter {
	completeCasualPlay(input: CasualPlayCompletion): Promise<{ shareRef: RefCode }>;
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function mintCandidate(): RefCode {
	let out = '';
	for (const b of randomBytes(10)) out += BASE32[b & 31];
	if (!isRefCode(out)) throw new Error('minted ref failed its own grammar');
	return out;
}

/**
 * §6.1 stand-in. A fresh instance per call so tests get isolated Maps; the
 * module-level `inMemoryCasualPlayCompleter` below is the shared default.
 */
export function createInMemoryCasualPlayCompleter(): CasualPlayCompleter {
	const byKey = new Map<string, RefCode>();
	const issued = new Set<RefCode>();
	return {
		async completeCasualPlay(input) {
			const replay = byKey.get(input.idempotencyKey);
			if (replay !== undefined) return { shareRef: replay };
			// Collision-checked mint: never hand out a ref already issued.
			let shareRef = mintCandidate();
			while (issued.has(shareRef)) shareRef = mintCandidate();
			issued.add(shareRef);
			byKey.set(input.idempotencyKey, shareRef);
			console.info('casual completion event', {
				templateId: input.templateId,
				occurredAt: new Date().toISOString(),
				ref: input.ref,
				shareRef
			});
			return { shareRef };
		}
	};
}

export const inMemoryCasualPlayCompleter: CasualPlayCompleter = createInMemoryCasualPlayCompleter();

/** Stage-2 wiring: the real transactional implementation from data-core. */
export const dbCasualPlayCompleter: CasualPlayCompleter = {
	completeCasualPlay: (input) => dbCompleteCasualPlay(input)
};
