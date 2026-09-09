// T3-m1-recruitment-demo §1: the five stages of the recruiter walkthrough
// as static content. Framing copy and directed questions are the seed
// spec's, used as written:
// reference/fair-pricebroker-canvas/documents/recruiter-demo-build-spec-and-outreach.md
//
// Closed questions render as yes/no, a 1–5 scale, or a short choice list;
// open questions render as free text. Every stage carries one comment box.
import type { DemoStage } from '$lib/server/demo/demoAnswers';

export type DemoHat = 'recruiter' | 'candidate';

export type DirectedQuestion =
	| { readonly key: string; readonly kind: 'yesno'; readonly prompt: string }
	| {
			readonly key: string;
			readonly kind: 'scale';
			readonly prompt: string;
			readonly low: string;
			readonly high: string;
	  }
	| {
			readonly key: string;
			readonly kind: 'choice';
			readonly prompt: string;
			readonly options: readonly string[];
	  }
	| { readonly key: string; readonly kind: 'text'; readonly prompt: string };

export interface DemoStageContent {
	readonly stage: DemoStage;
	readonly hat: DemoHat;
	/** Short name for the progress rail. */
	readonly name: string;
	readonly heading: string;
	/** Framing copy, one paragraph per entry, verbatim from the seed spec. */
	readonly framing: readonly string[];
	readonly questions: readonly DirectedQuestion[];
}

export const DEMO_STAGE_CONTENT: readonly DemoStageContent[] = [
	{
		stage: 1,
		hat: 'recruiter',
		name: 'Budget',
		heading: 'Enter the employer’s budget',
		framing: [
			'You’re about to play both sides of the workflow — first as the recruiter, then as the candidate. This is a demo, so use any numbers you like.',
			'In real use, this is where you enter the salary budget your client has given you for the role. This stays private — the candidate never sees it.'
		],
		questions: [
			{
				key: 'knows-budget',
				kind: 'yesno',
				prompt:
					'Do you typically know the employer’s full salary budget at this stage of the process?'
			},
			{
				key: 'comfortable-entering-budget',
				kind: 'yesno',
				prompt: 'Would you feel comfortable entering a client’s budget into a third-party tool?'
			}
		]
	},
	{
		stage: 2,
		hat: 'recruiter',
		name: 'Link sent',
		heading: 'The candidate link is sent',
		framing: [
			'In real use, you’d send the candidate a private link at this point — before or instead of the salary conversation on your first call. They complete their side independently.',
			'Now switch hats. You’re the candidate. A recruiter has sent you this link and asked you to answer a few quick questions about your salary expectations.'
		],
		questions: [
			{
				key: 'send-timing',
				kind: 'choice',
				prompt: 'Would you send this before or after a first call with the candidate?',
				options: ['Before', 'After']
			},
			{
				key: 'candidate-completion-likelihood',
				kind: 'scale',
				prompt: 'How likely do you think a candidate would be to complete this?',
				low: 'Very unlikely',
				high: 'Very likely'
			},
			{
				key: 'candidate-reluctance',
				kind: 'text',
				prompt: 'What might make a candidate suspicious of or reluctant to use it?'
			}
		]
	},
	{
		stage: 3,
		hat: 'candidate',
		name: 'Candidate',
		heading: 'Answer as the candidate',
		framing: [
			'The questions are framed so that answering honestly is in your interest as a candidate. Naming a lower floor doesn’t hurt you — it signals that you’re open to the right opportunity and increases your chances of a match.',
			'Answer as a candidate would, based on whatever role you’re imagining.'
		],
		questions: [
			{
				key: 'incentive-convincing',
				kind: 'scale',
				prompt:
					'Does the argument that naming a lower salary earns more matches feel convincing to you?',
				low: 'Not at all',
				high: 'Completely'
			},
			{
				key: 'candidates-honest',
				kind: 'yesno',
				prompt: 'Do you think candidates would answer honestly?'
			}
		]
	},
	{
		stage: 4,
		hat: 'recruiter',
		name: 'Overlap',
		heading: 'What the recruiter sees',
		framing: [
			'Two things: how much the salary ranges overlap, and whether non-salary factors — flexibility, equity, culture, purpose — need to be meaningfully in play to make this work.',
			'This is the signal that replaces the standoff.'
		],
		questions: [
			{
				key: 'output-clear',
				kind: 'yesno',
				prompt: 'Is this output clear enough to act on?'
			},
			{
				key: 'non-salary-changes-approach',
				kind: 'yesno',
				prompt:
					'Does knowing whether non-salary factors need to be in play change how you’d approach this placement?'
			},
			{
				key: 'beyond-phone-call',
				kind: 'yesno',
				prompt: 'Does this give you something you couldn’t get from a phone call?'
			}
		]
	},
	{
		stage: 5,
		hat: 'recruiter',
		name: 'Wrap-up',
		heading: 'That’s the full workflow',
		framing: ['Before you go, a few quick questions about what you just experienced.'],
		questions: [
			{
				key: 'would-use',
				kind: 'yesno',
				prompt: 'Would you use this in your current workflow?'
			},
			{
				key: 'biggest-hesitation',
				kind: 'text',
				prompt: 'What’s your biggest hesitation?'
			},
			{
				key: 'would-pay-model',
				kind: 'choice',
				prompt:
					'Would you pay for this — and if so, what model makes sense: per placement, monthly subscription, or credits?',
				options: ['Per placement', 'Monthly subscription', 'Credits', 'I wouldn’t pay for this']
			}
		]
	}
];

export function stageContent(stage: DemoStage): DemoStageContent {
	return DEMO_STAGE_CONTENT[stage - 1];
}

/** Overlap level as the recruiter reads it on the result. */
export const OVERLAP_LABEL = {
	'in-range': 'In range',
	stretch: 'A stretch',
	'no-overlap': 'No overlap'
} as const;
