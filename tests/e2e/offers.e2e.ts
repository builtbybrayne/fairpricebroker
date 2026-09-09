// T3-m1-recruitment-core §4 in the T3-m2 vocabulary: V1 happy path, V2 payload safety, V3
// recall/cancel, V5 precision — two browser contexts (consultant, candidate)
// against the running dev server. V4 (blind template negative) lives in
// src/lib/server/offers/sideView.test.ts (a fixture reconciliation, since
// the UI cannot create a reconciliation in a vertical that is not ready)..
import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const EMPLOYER = ['41250', '46500', '51750', '57800'] as const;
const CANDIDATE = ['42000.1234', '48000.5', '55000', '65000'] as const;
const NO_OVERLAP_CANDIDATE = ['70000', '76000', '81000', '90000'] as const;

/** The dev server hydrates slowly on cold routes; interact only once idle. */
async function settle(page: Page) {
	await page.waitForLoadState('networkidle');
}

async function signIn(page: Page, email: string) {
	await page.goto('/app');
	await expect(page).toHaveURL(/\/signin/);
	await settle(page);
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page).toHaveURL(/\/app$/);
}

async function fillMeter(page: Page, title: string, tuple: readonly string[]) {
	const meter = page.getByRole('region', { name: title });
	const inputs = meter.locator('input[type="text"]');
	await expect(inputs).toHaveCount(4);
	for (let i = 0; i < 4; i++) await inputs.nth(i).fill(tuple[i]);
}

/** Consultant signs in, creates an offer with the budget, adds a candidate; returns the invite URL. */
async function recruiterToLink(
	browser: Browser,
	employer: readonly string[] = EMPLOYER
): Promise<{
	ctx: BrowserContext;
	page: Page;
	email: string;
	candidateEmail: string;
	offerId: string;
	reconciliationId: string;
	inviteUrl: string;
}> {
	const email = `e2e-rec-${randomUUID().slice(0, 8)}@example.test`;
	const candidateEmail = `e2e-cand-${randomUUID().slice(0, 8)}@example.test`;
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await signIn(page, email);
	await expect(page.getByTestId('balance')).toHaveText('8');

	const offerId = await createOffer(page, employer);
	const { reconciliationId, inviteUrl } = await addCandidate(page);
	return { ctx, page, email, candidateEmail, offerId, reconciliationId, inviteUrl };
}

/** From the dashboard: new offer with title + budget; returns the offer id. */
async function createOffer(page: Page, employer: readonly string[] = EMPLOYER): Promise<string> {
	await page
		.getByRole('link', { name: /New opportunity|Start your first opportunity/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/app\/offers\/new$/);
	await settle(page);
	await page.getByLabel('Opportunity title').fill('Senior product designer');
	await fillMeter(page, 'Hiring Company budget', employer);
	await page.getByRole('button', { name: 'Create the opportunity' }).click();
	await expect(page).toHaveURL(/\/app\/o\/[0-9a-f-]{36}$/);
	await settle(page);
	return page.url().split('/').pop()!;
}

/** On the offer page: generate one link; returns the new row's reconciliation id and link. */
async function addCandidate(page: Page): Promise<{ reconciliationId: string; inviteUrl: string }> {
	const before = await page.getByTestId('response-row').count();
	await page.getByTestId('generate-link').click();
	await expect(page.getByTestId('response-row')).toHaveCount(before + 1);
	const row = page.getByTestId('response-row').nth(before);
	const inviteUrl = await row.getByTestId('invite-url').inputValue();
	expect(inviteUrl).toMatch(/\/join\/[A-Za-z0-9_-]{40,}$/);
	const reconciliationId = (await row.getAttribute('data-reconciliation-id'))!;
	return { reconciliationId, inviteUrl };
}

async function candidateOpens(
	browser: Browser,
	inviteUrl: string,
	reconciliationId: string,
	email = `e2e-cand-${randomUUID().slice(0, 8)}@example.test`
) {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(inviteUrl);
	// An unbound link asks who is opening it, then signs them in and redeems.
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Your email').fill(email);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page).toHaveURL(new RegExp(`/rec/${reconciliationId}$`));
	await settle(page);
	return { ctx, page, email };
}

function assertNoFigures(html: string, figures: readonly string[]) {
	for (const f of figures) {
		const plain = Number(f);
		// Raw decimal, the formatted 2–4 d.p. rendering, and the integer form.
		for (const needle of [f, plain.toLocaleString('en-GB'), plain.toFixed(2), String(plain)]) {
			expect(html, `DOM must not contain employer figure ${needle}`).not.toContain(needle);
		}
	}
}

test('V1 + V2 + V5: full happy path with payload safety and 4-d.p. round trip', async ({
	browser
}) => {
	const r = await recruiterToLink(browser);

	// Copy control works on the offer page (clipboard permission granted to this context).
	await r.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
	await r.page.getByRole('button', { name: 'Copy' }).click();
	await expect(r.page.getByRole('button', { name: 'Copied' })).toBeVisible();

	// Balance was debited: 8 -> 7. One offer row in the offers list.
	await r.page.goto('/app/offers');
	await expect(r.page.getByTestId('balance')).toHaveText('7');
	await expect(r.page.getByTestId('offer-row')).toHaveCount(1);
	await r.page.goto(`/app/rec/${r.reconciliationId}`);
	await expect(r.page.getByTestId('respondent-opened')).toHaveText('Not yet');

	const c = await candidateOpens(browser, r.inviteUrl, r.reconciliationId, r.candidateEmail);

	// The offer page learns who opened the link; the link can no longer be copied.
	await r.page.goto(`/app/o/${r.offerId}`);
	await expect(r.page.getByTestId('response-row').first()).toContainText(r.candidateEmail);
	await expect(r.page.getByTestId('invite-url')).toHaveCount(0);
	await r.page.goto(`/app/rec/${r.reconciliationId}`);

	// R11: disclosure and incentive precede any input, in DOM order.
	const disclosure = c.page.getByTestId('disclosure');
	await expect(disclosure).toBeVisible();
	await expect(disclosure).toContainText('Who sees your answers');
	await expect(disclosure).toContainText('Why a lower first figure helps you');
	await expect(c.page.getByTestId('incentive')).toContainText('never mistaken for your ask');
	const order = await c.page.evaluate(() => {
		const d = document.querySelector('[data-testid="disclosure"]')!;
		const first = document.querySelector('[data-testid="entry-form"] input')!;
		return d.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING ? 'ok' : 'bad';
	});
	expect(order).toBe('ok');

	// V2 (entry state): no employer figure on the candidate page.
	assertNoFigures(await c.page.content(), EMPLOYER);

	// Recruiter sees the link opened.
	await expect(r.page.getByTestId('respondent-opened')).toHaveText('Yes', { timeout: 15000 });

	await fillMeter(c.page, 'Your meter', CANDIDATE);
	await c.page.getByRole('button', { name: 'Submit my figures' }).click();

	// Candidate lands on the result (lock -> orchestrate -> closed).
	await expect(c.page.getByTestId('fair-salary')).toBeVisible({ timeout: 20000 });
	await expect(c.page.getByTestId('overlap-label')).toHaveText(/In range|A stretch|No overlap/);
	await expect(c.page.getByTestId('side-copy')).not.toBeEmpty();
	assertNoFigures(await c.page.content(), EMPLOYER);
	await c.page.getByTestId('show-numbers').click();
	const ownFigures = await c.page.getByTestId('own-figure').allTextContents();
	expect(ownFigures[0]).toBe('£42,000.1234'); // V5: 4 d.p. survives
	expect(ownFigures[1]).toBe('£48,000.50');
	assertNoFigures(await c.page.content(), EMPLOYER);

	// Consultant result: figures hidden until the toggle, then both tuples.
	await expect(r.page.getByTestId('fair-salary')).toBeVisible({ timeout: 20000 });
	await expect(r.page.getByTestId('overlap-label')).toHaveText(/In range|A stretch|No overlap/);
	const before = await r.page.content();
	expect(before).not.toContain('42,000.1234');
	expect(before).not.toContain('42000.1234');
	await expect(r.page.getByTestId('numbers')).toHaveCount(0);
	await r.page.getByTestId('show-numbers').click();
	await expect(r.page.getByTestId('numbers')).toBeVisible();
	const emp = await r.page.getByTestId('offerer-figure').allTextContents();
	const cand = await r.page.getByTestId('respondent-figure').allTextContents();
	expect(emp).toEqual(['£41,250', '£46,500', '£51,750', '£57,800']);
	expect(cand).toEqual(['£42,000.1234', '£48,000.50', '£55,000', '£65,000']);
	const fairR = await r.page.getByTestId('fair-salary').textContent();
	const fairC = await c.page.getByTestId('fair-salary').textContent();
	expect(fairR).toBe(fairC);
	await expect(r.page.getByTestId('respondent-view')).toBeVisible();

	// The offers list shows the closed state.
	await r.page.goto('/app/offers');
	await expect(r.page.getByTestId('offer-row')).toContainText('Result ready');

	await r.ctx.close();
	await c.ctx.close();
});

test('V3a: the offer budget can change until a candidate answers; the candidate can recall until then', async ({
	browser
}) => {
	const r = await recruiterToLink(browser);

	// Consultant edits the budget on the offer page; the open reconciliation follows.
	await r.page.getByTestId('edit-figures').click();
	await fillMeter(r.page, 'Hiring Company budget', ['30000', '34000', '38000', '41000']);
	await r.page.getByRole('button', { name: 'Save the budget' }).click();
	await expect(r.page.getByTestId('edit-figures')).toBeVisible({ timeout: 15000 });

	// Candidate answers with a range that no longer overlaps that budget.
	const c = await candidateOpens(browser, r.inviteUrl, r.reconciliationId);
	await fillMeter(c.page, 'Your meter', NO_OVERLAP_CANDIDATE);
	await c.page.getByRole('button', { name: 'Submit my figures' }).click();
	await expect(c.page.getByTestId('fair-salary')).toBeVisible({ timeout: 20000 });
	await expect(c.page.getByTestId('overlap-label')).toHaveText('No overlap');
	assertNoFigures(await c.page.content(), ['30000', '34000', '38000', '41000']);

	// The offer page shows the result against the edited budget.
	await r.page.reload();
	await expect(r.page.getByTestId('response-progress')).toHaveText('Result ready', {
		timeout: 15000
	});
	await expect(r.page.getByText('No overlap')).toBeVisible();

	// A second link on the same offer is its own reconciliation.
	const c2 = await addCandidate(r.page);
	expect(c2.reconciliationId).not.toBe(r.reconciliationId);
	await expect(r.page.locator('tr[data-testid="response-row"]')).toHaveCount(2);
	const opened = await candidateOpens(browser, c2.inviteUrl, c2.reconciliationId);
	await expect(opened.page.getByTestId('disclosure')).toBeVisible();
	// The first candidate's result and figures never reach the second.
	assertNoFigures(await opened.page.content(), NO_OVERLAP_CANDIDATE);

	await r.ctx.close();
	await c.ctx.close();
	await opened.ctx.close();
});

test('V3b: the consultant tags a candidate with a tag they invent; the tag is theirs alone', async ({
	browser
}) => {
	const r = await recruiterToLink(browser);
	// The link stays visible (so links can be told apart) and copyable until opened.
	await expect(r.page.getByTestId('invite-url')).toHaveCount(1);
	await r.page.getByTestId('tag-input').first().fill('Shortlist');
	await r.page.getByTestId('tag-input').first().press('Enter');
	await expect(r.page.getByTestId('response-tags').first()).toContainText('Shortlist');
	// It is offered again for the next link.
	await expect(r.page.locator('#known-tags option[value="Shortlist"]')).toHaveCount(1);
	await r.page.getByRole('button', { name: 'Remove tag Shortlist' }).click();
	await expect(r.page.getByTestId('response-tags').first()).not.toContainText('Shortlist');

	// Once the candidate opens the link it can no longer be copied; the row names them instead.
	const c = await candidateOpens(browser, r.inviteUrl, r.reconciliationId);
	await r.page.reload();
	await expect(r.page.getByTestId('invite-url')).toHaveCount(0);
	await expect(r.page.getByTestId('response-row').first()).toContainText(c.email);

	await r.ctx.close();
	await c.ctx.close();
});

test('the candidate cannot open the consultant page; a stranger cannot open the side page', async ({
	browser
}) => {
	const r = await recruiterToLink(browser);
	const c = await candidateOpens(browser, r.inviteUrl, r.reconciliationId);
	const res = await c.ctx.request.get(`/app/rec/${r.reconciliationId}`);
	expect(res.status()).toBe(403);

	const s = await browser.newContext();
	const sp = await s.newPage();
	await signIn(sp, `e2e-stranger-${randomUUID().slice(0, 8)}@example.test`);
	// RLS hides the reconciliation row from a non-member, so the page cannot even confirm it exists.
	const res2 = await s.request.get(`/rec/${r.reconciliationId}`);
	expect([403, 404]).toContain(res2.status());

	await r.ctx.close();
	await c.ctx.close();
	await s.close();
});
