// T3-m1-casual-mode §7 / D4: the generic M1 casual template as a static
// config object — hardcoded, not loaded from a template system (custom
// template authoring is a later milestone, T2-product-surfaces §3.7).
//
// Location note: the brief lists this under `src/lib/client/casual/`, but
// the config is pure data consumed by BOTH the server orchestration
// (`CASUAL_TEMPLATE_ID`, the directional mapping) and the client flow
// (question copy, party labels), so it lives in the neutral `src/lib/casual/`
// where either side can import it. Only a type is imported from the engine
// (erased at build time), so this module carries no server-only code.
import type { Role } from '$lib/server/engine/types';

export const CASUAL_TEMPLATE_ID = 'generic-m1-casual' as const;

export type CasualPartyKey = 'A' | 'B';

export type CasualQuestionKey = 'too-cheap' | 'bargain' | 'expensive' | 'too-expensive';

export interface CasualQuestion {
	readonly key: CasualQuestionKey;
	readonly prompt: string;
}

export interface CasualParty {
	readonly label: string;
	/** Fixed directional mapping consumed by handleCasualReconcile (§4 step 1). */
	readonly direction: Role;
}

export interface CasualTemplate {
	readonly id: typeof CASUAL_TEMPLATE_ID;
	/** The canonical Van Westendorp set, in the ascending order the engine expects. */
	readonly questions: readonly [CasualQuestion, CasualQuestion, CasualQuestion, CasualQuestion];
	readonly parties: Readonly<Record<CasualPartyKey, CasualParty>>;
	readonly currency: 'GBP';
}

export const CASUAL_TEMPLATE: CasualTemplate = {
	id: CASUAL_TEMPLATE_ID,
	questions: [
		{ key: 'too-cheap', prompt: 'At what price would it be so cheap you would doubt its quality?' },
		{ key: 'bargain', prompt: 'At what price would it feel like a bargain?' },
		{ key: 'expensive', prompt: 'At what price would it start to feel expensive?' },
		{ key: 'too-expensive', prompt: 'At what price would it be too expensive to consider?' }
	],
	parties: {
		A: { label: 'Party A', direction: 'low-preferring' },
		B: { label: 'Party B', direction: 'high-preferring' }
	},
	currency: 'GBP'
};

/** Party A = low-preferring, Party B = high-preferring (§7). */
export const CASUAL_PARTY_DIRECTION: Readonly<Record<CasualPartyKey, Role>> = {
	A: CASUAL_TEMPLATE.parties.A.direction,
	B: CASUAL_TEMPLATE.parties.B.direction
};
