// T3-m1-recruitment-core §2 / T2-product-surfaces §7 R9, §9 R11: the
// recruitment template's shape and guidance mapping.
import { describe, expect, it } from 'vitest';
import type { Zone } from '$lib/server/engine/types';
import { RECRUITMENT_DIRECTION, recruitmentTemplate } from './recruitment';

const ZONES: readonly Zone[] = ['comfort', 'deal', 'no-deal'];

describe('recruitment template', () => {
	it('is the host-visible salary template with the employer budget on the low-preferring side', () => {
		expect(recruitmentTemplate.id).toBe('recruitment');
		expect(recruitmentTemplate.hostVisibility).toBe('host-visible');
		expect(recruitmentTemplate.currencyDefault).toBe('GBP');
		expect(recruitmentTemplate.unit).toBe('annual salary');
		expect(recruitmentTemplate.roles['low-preferring'].enteredBy).toBe('host');
		expect(recruitmentTemplate.roles['high-preferring'].enteredBy).toBe('invitee');
		expect(RECRUITMENT_DIRECTION).toEqual({
			budget: 'low-preferring',
			candidate: 'high-preferring'
		});
	});

	it('asks four ascending, non-empty, distinctly keyed questions of each side', () => {
		for (const role of ['low-preferring', 'high-preferring'] as const) {
			const qs = recruitmentTemplate.questions[role];
			expect(qs).toHaveLength(4);
			expect(new Set(qs.map((q) => q.key)).size).toBe(4);
			for (const q of qs) expect(q.prompt.trim().length).toBeGreaterThan(0);
		}
		// The candidate's lowest is "what I'd accept for a role I love".
		expect(recruitmentTemplate.questions['high-preferring'][0].prompt).toMatch(/role you love/i);
	});

	it('carries non-empty R11 disclosure and the load-bearing incentive copy', () => {
		expect(recruitmentTemplate.disclosure.heading.trim()).not.toBe('');
		expect(recruitmentTemplate.disclosure.body).toMatch(/recruiter .* will see/i);
		expect(recruitmentTemplate.incentive.heading.trim()).not.toBe('');
		expect(recruitmentTemplate.incentive.body).toMatch(/open/i);
		expect(recruitmentTemplate.incentive.body).toMatch(/match/i);
	});

	it('maps every engine zone to the R9 two-dimensional read', () => {
		const expected: Record<Zone, { overlap: string; nonRemunerationInPlay: boolean }> = {
			comfort: { overlap: 'in-range', nonRemunerationInPlay: false },
			deal: { overlap: 'stretch', nonRemunerationInPlay: true },
			'no-deal': { overlap: 'no-overlap', nonRemunerationInPlay: true }
		};
		for (const zone of ZONES) {
			const g = recruitmentTemplate.guidance(zone);
			expect(g.zone).toBe(zone);
			expect(g.overlap).toBe(expected[zone].overlap);
			expect(g.nonRemunerationInPlay).toBe(expected[zone].nonRemunerationInPlay);
			expect(g.hostCopy.trim().length).toBeGreaterThan(0);
			expect(g.partyCopy.trim().length).toBeGreaterThan(0);
			// Candidate copy never carries the client's numbers or names a figure.
			expect(g.partyCopy).not.toMatch(/\d/);
		}
	});
});
