// T3-m1-recruitment-core §2 in the T3-m2-domain-terms vocabulary: the
// salary-negotiation vertical as static configuration (T2-product-surfaces
// §2.5). A vertical selects a configuration the server enforces; it has no
// disclosure power of its own (§7 R7). The guidance layer (§7 R9)
// interprets the engine's zone; the engine computes.
//
// The dictionary (`terms`) names the seats on screen: buyer = Hiring
// Company, seller = Candidate, broker = Recruitment Consultant. The offer
// is buyer-offered: the hiring company's budget stands once, and many
// candidates respond, one reconciliation each.
//
// COPY DRAFT FOR OPERATOR REVIEW. Every human-facing string in this file
// is a first draft written to the briefs' framing (R9 two-dimensional
// read, R11 pre-entry disclosure, the load-bearing candidate-incentive
// argument from the buildpad canvas notes). Wording lives here, not in
// components — edit it here.
//
// Location note: like `$lib/casual/casualTemplate`, this is pure data
// consumed by both server orchestration and client surfaces. Only types are
// imported from the engine, so the module carries no server-only code.
import type { Zone } from '$lib/server/engine/types';
import { vertical, type Side, type VerticalDictionary } from '$lib/domain/terms';

export const SALARY_NEGOTIATION_ID = 'salary-negotiation' as const;

export type OverlapLevel = 'in-range' | 'stretch' | 'no-overlap';

export interface TemplateQuestion {
	readonly key: string;
	/** Two or three words under the meter point. */
	readonly label: string;
	/** The question as the person answering sees it. */
	readonly prompt: string;
	/** Optional one-line help shown beneath the prompt. */
	readonly help?: string;
}

/** The four price points, in the ascending order the engine expects. */
export type QuestionSet = readonly [
	TemplateQuestion,
	TemplateQuestion,
	TemplateQuestion,
	TemplateQuestion
];

export interface TemplateRole {
	/** The meter title for this side's figures. */
	readonly label: string;
	/** Who enters this side's figures: the offerer, or the side responding to the offer. */
	readonly enteredBy: 'offerer' | 'respondent';
}

export interface SalaryGuidance {
	readonly zone: Zone;
	readonly overlap: OverlapLevel;
	/** R9: whether non-remuneration factors need to be meaningfully in play. */
	readonly nonRemunerationInPlay: boolean;
	/** What the broker (broker-full) reads. May reference both sides. */
	readonly brokerCopy: string;
	/** What the responding side reads. Never carries the other side's numbers. */
	readonly sideCopy: string;
}

export interface SalaryNegotiationTemplate {
	readonly id: typeof SALARY_NEGOTIATION_ID;
	/** The vertical dictionary: display names for the seats and the offer. */
	readonly terms: VerticalDictionary;
	readonly name: string;
	/** Which side makes offers here: the hiring company sets a budget. */
	readonly offeredBy: Side;
	/** R7 / R11: the broker sees both sides' figures in this vertical. */
	readonly brokerSeesFigures: boolean;
	readonly currencyDefault: 'GBP';
	readonly unit: string;
	readonly roles: Readonly<Record<Side, TemplateRole>>;
	readonly questions: Readonly<Record<Side, QuestionSet>>;
	/** R11: shown to the responding side BEFORE any figure is entered. */
	readonly disclosure: { readonly heading: string; readonly body: string };
	/** The load-bearing incentive argument; shown alongside the disclosure. */
	readonly incentive: { readonly heading: string; readonly body: string };
	readonly guidance: (zone: Zone) => SalaryGuidance;
}

const GUIDANCE: Readonly<Record<Zone, Omit<SalaryGuidance, 'zone'>>> = {
	comfort: {
		overlap: 'in-range',
		nonRemunerationInPlay: false,
		brokerCopy:
			"The candidate's expectations and the client's budget sit comfortably together. " +
			'A salary around the fair figure should close this on pay alone. Non-salary factors ' +
			'are a bonus here, not a bridge.',
		sideCopy:
			"Your expectations and this role's budget are in range. Nothing needs bridging on " +
			'salary, so the conversation can move on to the role itself.'
	},
	deal: {
		overlap: 'stretch',
		nonRemunerationInPlay: true,
		brokerCopy:
			'There is overlap, but it is a stretch: settling at the fair figure asks one side or ' +
			'both to move towards their limit. Non-salary factors are likely to matter here. Find ' +
			'out which ones count for this candidate (flexibility, equity, progression, the work ' +
			'itself) before you go back to the client.',
		sideCopy:
			"There is a workable range between your expectations and this role's budget, but it " +
			'is a stretch for one side or both. Expect the conversation to include more than ' +
			'salary, and think about which non-salary things matter to you.'
	},
	'no-deal': {
		overlap: 'no-overlap',
		nonRemunerationInPlay: true,
		brokerCopy:
			"The candidate's range sits above the client's budget. There is no salary overlap, so " +
			'this placement is unlikely to close on pay. It can still happen if non-salary factors ' +
			'are meaningfully in play on one side or both. If they are not, it is better to know ' +
			'now than after an offer.',
		sideCopy:
			"Your expectations and this role's budget do not currently overlap. That is useful to " +
			'know early. If the role appeals for reasons beyond salary, say so. If it does not, ' +
			'this may not be the one.'
	}
};

const terms = vertical(SALARY_NEGOTIATION_ID);

export const salaryNegotiationTemplate: SalaryNegotiationTemplate = {
	id: SALARY_NEGOTIATION_ID,
	terms,
	name: terms.name,
	offeredBy: terms.defaultOfferer,
	brokerSeesFigures: terms.brokerSeesFigures,
	currencyDefault: 'GBP',
	unit: 'annual salary',
	roles: {
		buyer: { label: `${terms.buyer} budget`, enteredBy: 'offerer' },
		seller: { label: terms.seller, enteredBy: 'respondent' }
	},
	questions: {
		// The buyer: the hiring company's budget for the role, entered by the
		// consultant acting for it.
		buyer: [
			{
				key: 'not-credible',
				label: 'Not credible',
				prompt: 'What salary would be too low to be credible for this role?',
				help: 'Below this, nobody would believe the client was serious about the hire.'
			},
			{
				key: 'good-value',
				label: 'Good value',
				prompt: 'What salary would feel like good value for the client?',
				help: 'A strong hire at a sensible cost.'
			},
			{
				key: 'great-candidate',
				label: 'For a great candidate',
				prompt: 'What would the client pay for a great candidate?',
				help: 'Above the norm, and justified by the person.'
			},
			{
				key: 'out-of-budget',
				label: 'Simply out of budget',
				prompt: 'What salary is simply out of budget for this role?',
				help: 'The point where the client walks away.'
			}
		],
		// The seller: the candidate, answering about their own expectations.
		seller: [
			{
				key: 'too-low',
				label: 'Simply too low',
				prompt: 'What salary would be simply too low, whatever the role?',
				help: 'Below this you would not take the job.'
			},
			{
				key: 'awesome-opportunity',
				label: 'Would accept for an awesome opportunity',
				prompt: 'What salary would you accept for an awesome opportunity?',
				help: 'A role that is right in every other way; not what you expect to be offered.'
			},
			{
				key: 'ideal',
				label: 'Ideal outcome',
				prompt: 'What salary would be the ideal outcome?',
				help: 'You would be delighted.'
			},
			{
				key: 'unrealistic',
				label: 'Too unrealistic',
				prompt: 'What salary would be too unrealistic to ask for?',
				help: 'Beyond what anyone would pay for this role.'
			}
		]
	},
	disclosure: {
		heading: 'Who sees your answers',
		body:
			'The recruiter who sent you this link will see the four figures you enter. You will not ' +
			"see the employer's budget. Your figures are shown to the recruiter only; how they use " +
			'them in the conversation with the employer is between you and them. Please read the ' +
			'note below before you enter anything.'
	},
	incentive: {
		heading: 'Why a lower first figure helps you',
		body:
			'It is natural to worry that a low number sets a ceiling. Here it does not. Your first ' +
			'figure is simply the salary below which you would not take the job; your second is what ' +
			'you would accept for an awesome opportunity, not what you expect to be offered. Naming ' +
			'both honestly tells the recruiter you are open to the right role, which widens the range ' +
			'of roles you can be matched with. The recruiter also sees your ideal outcome, so your ' +
			'floor is never mistaken for your ask. A wider range means more matches; a narrow one ' +
			'means fewer.'
	},
	guidance: (zone) => ({ zone, ...GUIDANCE[zone] })
};
