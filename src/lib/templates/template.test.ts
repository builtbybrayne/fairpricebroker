// T3-m1-recruitment-core §2 / T2-product-surfaces §7 R9, §9 R11, in the
// T3-m2-domain-terms vocabulary: the salary-negotiation template's shape,
// dictionary and guidance mapping.
import { describe, expect, it } from 'vitest';
import type { Zone } from '$lib/server/engine/types';
import { SIDES, sideToDirection, vertical } from '$lib/domain/terms';
import { salaryNegotiationTemplate } from './salaryNegotiation';

const ZONES: readonly Zone[] = ['comfort', 'deal', 'no-deal'];

describe('salary-negotiation template', () => {
	it('is the broker-sees-figures salary vertical, buyer-offered, with the dictionary attached', () => {
		expect(salaryNegotiationTemplate.id).toBe('salary-negotiation');
		expect(salaryNegotiationTemplate.terms).toBe(vertical('salary-negotiation'));
		expect(salaryNegotiationTemplate.name).toBe('Salary Negotiation');
		expect(salaryNegotiationTemplate.brokerSeesFigures).toBe(true);
		expect(salaryNegotiationTemplate.offeredBy).toBe('buyer');
		expect(salaryNegotiationTemplate.currencyDefault).toBe('GBP');
		expect(salaryNegotiationTemplate.unit).toBe('annual salary');
		expect(salaryNegotiationTemplate.roles.buyer.enteredBy).toBe('offerer');
		expect(salaryNegotiationTemplate.roles.seller.enteredBy).toBe('respondent');
		expect(salaryNegotiationTemplate.roles.buyer.label).toBe('Hiring Company budget');
		expect(salaryNegotiationTemplate.roles.seller.label).toBe('Candidate');
	});

	it('names the seats through the dictionary, never a literal', () => {
		const t = salaryNegotiationTemplate.terms;
		expect(t.buyer).toBe('Hiring Company');
		expect(t.seller).toBe('Candidate');
		expect(t.offer).toBe('Opportunity');
		expect(t.broker).toBe('Recruitment Consultant');
		// The buyer prefers a lower salary: the engine boundary holds.
		expect(sideToDirection[salaryNegotiationTemplate.offeredBy]).toBe('low-preferring');
	});

	it('asks four ascending, non-empty, distinctly keyed questions of each side', () => {
		for (const side of SIDES) {
			const qs = salaryNegotiationTemplate.questions[side];
			expect(qs).toHaveLength(4);
			expect(new Set(qs.map((q) => q.key)).size).toBe(4);
			for (const q of qs) expect(q.prompt.trim().length).toBeGreaterThan(0);
		}
		// Operator wording (9 Sep 2026): the candidate's lowest is the floor, the
		// second is what they would accept for an awesome opportunity.
		expect(salaryNegotiationTemplate.questions.seller[0].label).toMatch(/simply too low/i);
		expect(salaryNegotiationTemplate.questions.seller[1].prompt).toMatch(/awesome opportunity/i);
	});

	it('carries non-empty R11 disclosure and the load-bearing incentive copy', () => {
		expect(salaryNegotiationTemplate.disclosure.heading.trim()).not.toBe('');
		expect(salaryNegotiationTemplate.disclosure.body).toMatch(/recruiter .* will see/i);
		expect(salaryNegotiationTemplate.incentive.heading.trim()).not.toBe('');
		expect(salaryNegotiationTemplate.incentive.body).toMatch(/open/i);
		expect(salaryNegotiationTemplate.incentive.body).toMatch(/match/i);
	});

	it('maps every engine zone to the R9 two-dimensional read', () => {
		const expected: Record<Zone, { overlap: string; nonRemunerationInPlay: boolean }> = {
			comfort: { overlap: 'in-range', nonRemunerationInPlay: false },
			deal: { overlap: 'stretch', nonRemunerationInPlay: true },
			'no-deal': { overlap: 'no-overlap', nonRemunerationInPlay: true }
		};
		for (const zone of ZONES) {
			const g = salaryNegotiationTemplate.guidance(zone);
			expect(g.zone).toBe(zone);
			expect(g.overlap).toBe(expected[zone].overlap);
			expect(g.nonRemunerationInPlay).toBe(expected[zone].nonRemunerationInPlay);
			expect(g.brokerCopy.trim().length).toBeGreaterThan(0);
			expect(g.sideCopy.trim().length).toBeGreaterThan(0);
			// The responding side's copy never carries the other side's numbers.
			expect(g.sideCopy).not.toMatch(/\d/);
		}
	});
});
