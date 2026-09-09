// T3-m1-recruitment-core §2: the recruitment template as static
// configuration (T2-product-surfaces §2.5). Templates select a
// configuration the server enforces; they have no disclosure power of
// their own (§7 R7). The guidance layer (§7 R9) interprets the engine's
// zone; the engine computes.
//
// COPY DRAFT FOR OPERATOR REVIEW. Every human-facing string in this file
// is a first draft written to the briefs' framing (R9 two-dimensional
// read, R11 pre-entry disclosure, the load-bearing candidate-incentive
// argument from the buildpad canvas notes). Wording lives here, not in
// components — edit it here.
//
// Location note: like `$lib/casual/casualTemplate`, this is pure data
// consumed by both server orchestration (directional mapping, guidance)
// and client surfaces (question copy, disclosure). Only types are imported
// from the engine, so the module carries no server-only code.
import type { Role, Zone } from '$lib/server/engine/types';

export const RECRUITMENT_TEMPLATE_ID = 'recruitment' as const;

export type HostVisibility = 'blind' | 'host-visible';

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
	readonly label: string;
	readonly enteredBy: 'host' | 'invitee';
}

export interface RecruitmentGuidance {
	readonly zone: Zone;
	readonly overlap: OverlapLevel;
	/** R9: whether non-remuneration factors need to be meaningfully in play. */
	readonly nonRemunerationInPlay: boolean;
	/** What the recruiter (host-full) reads. May reference both sides. */
	readonly hostCopy: string;
	/** What the candidate reads. Never carries the client's numbers. */
	readonly partyCopy: string;
}

export interface RecruitmentTemplate {
	readonly id: typeof RECRUITMENT_TEMPLATE_ID;
	readonly name: string;
	readonly hostVisibility: HostVisibility;
	readonly currencyDefault: 'GBP';
	readonly unit: string;
	readonly roles: Readonly<Record<Role, TemplateRole>>;
	readonly questions: Readonly<Record<Role, QuestionSet>>;
	/** R11: shown to the candidate BEFORE any figure is entered. */
	readonly disclosure: { readonly heading: string; readonly body: string };
	/** The load-bearing incentive argument; shown alongside the disclosure. */
	readonly incentive: { readonly heading: string; readonly body: string };
	readonly guidance: (zone: Zone) => RecruitmentGuidance;
}

const GUIDANCE: Readonly<Record<Zone, Omit<RecruitmentGuidance, 'zone'>>> = {
	comfort: {
		overlap: 'in-range',
		nonRemunerationInPlay: false,
		hostCopy:
			"The candidate's expectations and the client's budget sit comfortably together. " +
			'A salary around the fair figure should close this on pay alone. Non-salary factors ' +
			'are a bonus here, not a bridge.',
		partyCopy:
			"Your expectations and this role's budget are in range. Nothing needs bridging on " +
			'salary, so the conversation can move on to the role itself.'
	},
	deal: {
		overlap: 'stretch',
		nonRemunerationInPlay: true,
		hostCopy:
			'There is overlap, but it is a stretch: settling at the fair figure asks one side or ' +
			'both to move towards their limit. Non-salary factors are likely to matter here. Find ' +
			'out which ones count for this candidate (flexibility, equity, progression, the work ' +
			'itself) before you go back to the client.',
		partyCopy:
			"There is a workable range between your expectations and this role's budget, but it " +
			'is a stretch for one side or both. Expect the conversation to include more than ' +
			'salary, and think about which non-salary things matter to you.'
	},
	'no-deal': {
		overlap: 'no-overlap',
		nonRemunerationInPlay: true,
		hostCopy:
			"The candidate's range sits above the client's budget. There is no salary overlap, so " +
			'this placement is unlikely to close on pay. It can still happen if non-salary factors ' +
			'are meaningfully in play on one side or both. If they are not, it is better to know ' +
			'now than after an offer.',
		partyCopy:
			"Your expectations and this role's budget do not currently overlap. That is useful to " +
			'know early. If the role appeals for reasons beyond salary, say so. If it does not, ' +
			'this may not be the one.'
	}
};

export const recruitmentTemplate: RecruitmentTemplate = {
	id: RECRUITMENT_TEMPLATE_ID,
	name: 'Salary alignment',
	hostVisibility: 'host-visible',
	currencyDefault: 'GBP',
	unit: 'annual salary',
	roles: {
		'low-preferring': { label: 'Employer budget', enteredBy: 'host' },
		'high-preferring': { label: 'Candidate', enteredBy: 'invitee' }
	},
	questions: {
		// The recruiter, entering the hiring company's budget for the role.
		'low-preferring': [
			{
				key: 'too-low',
				label: 'Too low',
				prompt: 'What salary would be so low that you would worry about who it could attract?',
				help: 'Below this, the client is not really hiring for this role.'
			},
			{
				key: 'good-value',
				label: 'Good value',
				prompt: 'What salary would feel like good value for the client?',
				help: 'A strong hire at a sensible cost.'
			},
			{
				key: 'stretch',
				label: 'A stretch',
				prompt: 'What salary would start to feel like a stretch for the client?',
				help: 'Still possible, but it would need justifying.'
			},
			{
				key: 'too-high',
				label: 'Too high',
				prompt: 'What salary is beyond what the client would pay for this role?',
				help: 'The point where the client walks away.'
			}
		],
		// The candidate, answering about their own expectations.
		'high-preferring': [
			{
				key: 'would-accept',
				label: 'Would accept',
				prompt: 'What is the lowest salary you would accept for a role you love?',
				help: 'Not what you expect to be offered: the figure for a role that is right in every other way.'
			},
			{
				key: 'fair',
				label: 'Fair',
				prompt: 'What salary would feel fair for this kind of role?',
				help: 'The number you would take without a second thought.'
			},
			{
				key: 'good-result',
				label: 'A good result',
				prompt: 'What salary would feel like a genuinely good result?',
				help: 'You would be pleased, not just satisfied.'
			},
			{
				key: 'too-high',
				label: 'Too high',
				prompt: 'What salary would be so high that you would wonder what the catch is?',
				help: 'The point where the offer itself starts to look odd.'
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
			'It is natural to worry that naming a low number sets a ceiling. Here it does not. Your ' +
			'lowest figure is the salary you would accept for a role you would genuinely love, not ' +
			'what you expect to be offered. Naming it honestly tells the recruiter you are open to ' +
			'the right opportunity, which widens the range of roles you can be matched with. The ' +
			'recruiter also sees your fair and good-result figures, so your floor is never mistaken ' +
			'for your ask. A wider range means more matches; a narrow one means fewer.'
	},
	guidance: (zone) => ({ zone, ...GUIDANCE[zone] })
};

/** Fixed directional mapping: the employer budget is the low-preferring side. */
export const RECRUITMENT_DIRECTION = {
	budget: 'low-preferring',
	candidate: 'high-preferring'
} as const satisfies Record<'budget' | 'candidate', Role>;
