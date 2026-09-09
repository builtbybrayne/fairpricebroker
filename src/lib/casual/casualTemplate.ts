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
	/** The four price points, in the ascending order the engine expects. */
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

// ---------------------------------------------------------------------------
// Scenarios: the example contexts the homepage meters start from (operator
// ruling 8 Sep 2026: meters open with example figures and a named context,
// and each side's four points are worded for that side). The example
// outcomes are the engine's own results for the example figures, recorded
// so the hero can show them before anyone has played.

export interface CasualPoint {
	readonly key: string;
	/** Two or three words under the point. */
	readonly label: string;
	/** The question behind the point, shown when it is touched. */
	readonly prompt: string;
}

export interface CasualSide {
	readonly title: string;
	readonly points: readonly [CasualPoint, CasualPoint, CasualPoint, CasualPoint];
	readonly example: readonly [number, number, number, number];
}

export interface CasualScenario {
	readonly id: string;
	readonly name: string;
	readonly currency: '£';
	readonly min: number;
	readonly max: number;
	readonly step: number;
	/** The side that prefers a lower price (buyer, payer): Party A. */
	readonly a: CasualSide;
	/** The side that prefers a higher price (seller, receiver): Party B. */
	readonly b: CasualSide;
	/** The engine's outcome for the two example tuples. */
	readonly exampleOutcome: {
		readonly zone: { readonly lo: number; readonly hi: number } | null;
		readonly fair: number;
	};
}

export const CASUAL_SCENARIOS: readonly CasualScenario[] = [
	{
		id: 'bike',
		name: 'A second-hand bike',
		currency: '£',
		min: 0,
		max: 1500,
		step: 5,
		a: {
			title: 'Buying it',
			points: [
				{
					key: 'too-cheap',
					label: 'Suspicious',
					prompt: 'So cheap you would wonder what is wrong with it.'
				},
				{
					key: 'bargain',
					label: 'A bargain',
					prompt: 'You would pay this and feel you had done well.'
				},
				{
					key: 'expensive',
					label: 'Getting dear',
					prompt: 'You would pay it, but you would think twice.'
				},
				{
					key: 'too-expensive',
					label: 'Too much',
					prompt: 'More than you would pay for this bike.'
				}
			],
			example: [120, 220, 380, 500]
		},
		b: {
			title: 'Selling it',
			points: [
				{
					key: 'too-low',
					label: 'Rather keep it',
					prompt: 'So little you would sooner keep the bike.'
				},
				{
					key: 'acceptable',
					label: 'Acceptable',
					prompt: 'You would let it go for this without regret.'
				},
				{ key: 'good', label: 'A good result', prompt: 'You would be pleased to get this.' },
				{
					key: 'too-high',
					label: 'Taking the mick',
					prompt: 'So much that nobody sensible would pay it.'
				}
			],
			example: [180, 280, 420, 600]
		},
		exampleOutcome: { zone: { lo: 280, hi: 380 }, fair: 327.3 }
	},
	{
		id: 'dinner',
		name: 'Dinner for two',
		currency: '£',
		min: 0,
		max: 300,
		step: 1,
		a: {
			title: 'Taking someone out',
			points: [
				{
					key: 'too-cheap',
					label: 'Looks stingy',
					prompt: 'So cheap the evening would look stingy.'
				},
				{ key: 'bargain', label: 'A bargain', prompt: 'A good evening for the money.' },
				{
					key: 'expensive',
					label: 'Getting pricey',
					prompt: 'You would pay it, but you would notice.'
				},
				{
					key: 'too-expensive',
					label: 'Too much',
					prompt: 'More than the evening is worth to you.'
				}
			],
			example: [30, 50, 90, 140]
		},
		b: {
			title: 'Being taken out',
			points: [
				{
					key: 'too-low',
					label: 'An afterthought',
					prompt: 'So little it would feel like an afterthought.'
				},
				{ key: 'fine', label: 'A fine evening', prompt: 'A perfectly good evening.' },
				{ key: 'generous', label: 'Generous', prompt: 'You would feel properly treated.' },
				{
					key: 'too-high',
					label: 'Awkward',
					prompt: 'So much that it would start to feel awkward.'
				}
			],
			example: [25, 45, 80, 120]
		},
		exampleOutcome: { zone: { lo: 50, hi: 80 }, fair: 65.55 }
	},
	{
		id: 'dayrate',
		name: "A day's freelance work",
		currency: '£',
		min: 0,
		max: 2000,
		step: 10,
		a: {
			title: 'Hiring the day',
			points: [
				{ key: 'too-cheap', label: 'Worrying', prompt: 'So cheap you would doubt the work.' },
				{ key: 'good-value', label: 'Good value', prompt: 'A solid day at a sensible price.' },
				{
					key: 'stretch',
					label: 'A stretch',
					prompt: 'Possible, but you would need it justified.'
				},
				{ key: 'too-expensive', label: 'Too much', prompt: 'More than the day is worth to you.' }
			],
			example: [150, 280, 450, 600]
		},
		b: {
			title: 'Doing the day',
			points: [
				{
					key: 'too-low',
					label: 'Not worth it',
					prompt: 'So little you would rather not take the day.'
				},
				{ key: 'acceptable', label: 'Acceptable', prompt: 'You would take the day at this.' },
				{ key: 'good', label: 'A good day', prompt: 'You would be pleased with this rate.' },
				{
					key: 'too-high',
					label: 'Suspicious',
					prompt: 'So high you would wonder what the catch is.'
				}
			],
			example: [200, 320, 480, 700]
		},
		exampleOutcome: { zone: { lo: 320, hi: 450 }, fair: 381.52 }
	}
];

export const DEFAULT_SCENARIO = CASUAL_SCENARIOS[0];

/**
 * The "customise your own" scenario: generic sides and points, a wide
 * range, and a name the pair type themselves (`withCustomTitle`).
 */
export const CUSTOM_SCENARIO: CasualScenario = {
	id: 'custom',
	name: 'Something of your own',
	currency: '£',
	min: 0,
	max: 1000,
	step: 5,
	a: {
		title: 'Paying',
		points: [
			{ key: 'too-cheap', label: 'Too cheap', prompt: 'So cheap you would doubt it.' },
			{
				key: 'bargain',
				label: 'A bargain',
				prompt: 'You would pay this and feel you had done well.'
			},
			{
				key: 'expensive',
				label: 'Getting expensive',
				prompt: 'You would pay it, but you would think twice.'
			},
			{ key: 'too-expensive', label: 'Too much', prompt: 'More than you would pay.' }
		],
		example: [100, 200, 400, 600]
	},
	b: {
		title: 'Being paid',
		points: [
			{ key: 'too-low', label: 'Too little', prompt: 'So little you would rather not.' },
			{ key: 'acceptable', label: 'Acceptable', prompt: 'You would take this without regret.' },
			{ key: 'good', label: 'A good result', prompt: 'You would be pleased with this.' },
			{
				key: 'too-high',
				label: 'Too much to ask',
				prompt: 'So much that nobody sensible would pay it.'
			}
		],
		example: [150, 300, 450, 700]
	},
	exampleOutcome: { zone: { lo: 300, hi: 400 }, fair: 348.26 }
};

export function withCustomTitle(title: string): CasualScenario {
	const t = title.trim();
	return { ...CUSTOM_SCENARIO, name: t === '' ? CUSTOM_SCENARIO.name : t };
}
