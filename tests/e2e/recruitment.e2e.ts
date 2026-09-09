// T3-m1-recruitment-core §4: V1 happy path, V2 payload safety, V3
// recall/cancel, V5 precision — two browser contexts (recruiter, candidate)
// against the running dev server. V4 (blind template negative) lives in
// src/lib/server/recruitment/partyView.test.ts (a fixture session, since
// the UI cannot create a 'generic' session).
import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const EMPLOYER = ['41250', '46500', '51750', '57800'] as const;
const CANDIDATE = ['42000.1234', '48000.5', '55000', '65000'] as const;
const NO_OVERLAP_CANDIDATE = ['70000', '75000', '80000', '90000'] as const;

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

/** Recruiter signs in, creates a check, submits the budget; returns the invite URL. */
async function recruiterToLink(
	browser: Browser,
	employer: readonly string[] = EMPLOYER
): Promise<{
	ctx: BrowserContext;
	page: Page;
	email: string;
	candidateEmail: string;
	sessionId: string;
	inviteUrl: string;
}> {
	const email = `e2e-rec-${randomUUID().slice(0, 8)}@example.test`;
	const candidateEmail = `e2e-cand-${randomUUID().slice(0, 8)}@example.test`;
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await signIn(page, email);
	await expect(page.getByTestId('balance')).toHaveText('20');

	await page
		.getByRole('link', { name: /New salary check|Start your first check/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/app\/new$/);
	await settle(page);
	await page.getByLabel("Candidate's email").fill(candidateEmail);
	await page.getByRole('button', { name: 'Start the check' }).click();
	await expect(page).toHaveURL(/\/app\/s\/[0-9a-f-]{36}$/);
	const sessionId = page.url().split('/').pop()!;
	await settle(page);

	await fillMeter(page, 'Client budget', employer);
	await page.getByRole('button', { name: 'Submit the budget' }).click();
	const urlInput = page.getByTestId('invite-url');
	await expect(urlInput).toBeVisible();
	const inviteUrl = await urlInput.inputValue();
	expect(inviteUrl).toMatch(/\/join\/[A-Za-z0-9_-]{40,}$/);
	return { ctx, page, email, candidateEmail, sessionId, inviteUrl };
}

async function candidateOpens(browser: Browser, inviteUrl: string, sessionId: string) {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(inviteUrl);
	await expect(page).toHaveURL(new RegExp(`/s/${sessionId}/party$`));
	await settle(page);
	return { ctx, page };
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

	// Balance was debited: 20 -> 19.
	await r.page.goto('/app');
	await expect(r.page.getByTestId('balance')).toHaveText('19');
	await expect(r.page.getByTestId('session-row')).toHaveCount(1);
	await r.page.goto(`/app/s/${r.sessionId}`);
	await expect(r.page.getByTestId('candidate-opened')).toHaveText('Not yet');

	// Copy control works (clipboard permission granted to this context).
	await r.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
	await r.page.getByRole('button', { name: 'Copy link' }).click();
	await expect(r.page.getByRole('button', { name: 'Copied' })).toBeVisible();

	const c = await candidateOpens(browser, r.inviteUrl, r.sessionId);

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
	await expect(r.page.getByTestId('candidate-opened')).toHaveText('Yes', { timeout: 15000 });

	await fillMeter(c.page, 'Your meter', CANDIDATE);
	await c.page.getByRole('button', { name: 'Submit my figures' }).click();

	// Candidate lands on the result (lock -> orchestrate -> closed).
	await expect(c.page.getByTestId('fair-salary')).toBeVisible({ timeout: 20000 });
	await expect(c.page.getByTestId('overlap-label')).toHaveText(/In range|A stretch|No overlap/);
	await expect(c.page.getByTestId('party-copy')).not.toBeEmpty();
	assertNoFigures(await c.page.content(), EMPLOYER);
	await c.page.getByTestId('show-numbers').click();
	const ownFigures = await c.page.getByTestId('own-figure').allTextContents();
	expect(ownFigures[0]).toBe('£42,000.1234'); // V5: 4 d.p. survives
	expect(ownFigures[1]).toBe('£48,000.50');
	assertNoFigures(await c.page.content(), EMPLOYER);

	// Recruiter result: figures hidden until the toggle, then both tuples.
	await expect(r.page.getByTestId('fair-salary')).toBeVisible({ timeout: 20000 });
	await expect(r.page.getByTestId('overlap-label')).toHaveText(/In range|A stretch|No overlap/);
	const before = await r.page.content();
	expect(before).not.toContain('42,000.1234');
	expect(before).not.toContain('42000.1234');
	await expect(r.page.getByTestId('numbers')).toHaveCount(0);
	await r.page.getByTestId('show-numbers').click();
	await expect(r.page.getByTestId('numbers')).toBeVisible();
	const emp = await r.page.getByTestId('employer-figure').allTextContents();
	const cand = await r.page.getByTestId('candidate-figure').allTextContents();
	expect(emp).toEqual(['£41,250', '£46,500', '£51,750', '£57,800']);
	expect(cand).toEqual(['£42,000.1234', '£48,000.50', '£55,000', '£65,000']);
	const fairR = await r.page.getByTestId('fair-salary').textContent();
	const fairC = await c.page.getByTestId('fair-salary').textContent();
	expect(fairR).toBe(fairC);
	await expect(r.page.getByTestId('candidate-view')).toBeVisible();

	// Dashboard shows the closed state.
	await r.page.goto('/app');
	await expect(r.page.getByTestId('session-row')).toContainText('Result ready');

	await r.ctx.close();
	await c.ctx.close();
});

test('V3a: candidate recalls and re-submits; only then does the session lock', async ({
	browser
}) => {
	const email = `e2e-rec-${randomUUID().slice(0, 8)}@example.test`;
	const candidateEmail = `e2e-cand-${randomUUID().slice(0, 8)}@example.test`;
	const rctx = await browser.newContext();
	const r = await rctx.newPage();
	await signIn(r, email);
	await r.goto('/app/new');
	await settle(r);
	await r.getByLabel("Candidate's email").fill(candidateEmail);
	await r.getByRole('button', { name: 'Start the check' }).click();
	await expect(r).toHaveURL(/\/app\/s\/[0-9a-f-]{36}$/);
	const sessionId = r.url().split('/').pop()!;
	await settle(r);

	// Recruiter submits first to obtain the link, then recalls (candidate not in).
	await fillMeter(r, 'Client budget', EMPLOYER);
	await r.getByRole('button', { name: 'Submit the budget' }).click();
	const inviteUrl = await r.getByTestId('invite-url').inputValue();
	await r.getByRole('button', { name: 'Recall and edit the budget' }).click();
	await expect(r.getByRole('button', { name: 'Submit the budget' })).toBeVisible();

	// Candidate submits while the recruiter has not; recalls; re-submits.
	const c = await candidateOpens(browser, inviteUrl, sessionId);
	await fillMeter(c.page, 'Your meter', CANDIDATE);
	await c.page.getByRole('button', { name: 'Submit my figures' }).click();
	await expect(c.page.getByTestId('recall')).toBeVisible();
	await c.page.getByTestId('recall').click();
	await expect(c.page.getByRole('button', { name: 'Submit my figures' })).toBeVisible();
	// The recalled draft is editable and pre-filled.
	const meter = c.page.getByRole('region', { name: 'Your meter' });
	await expect(meter.locator('input[type="text"]').first()).toHaveValue('42000.1234');
	await fillMeter(c.page, 'Your meter', NO_OVERLAP_CANDIDATE);
	await c.page.getByRole('button', { name: 'Submit my figures' }).click();
	await expect(c.page.getByTestId('recall')).toBeVisible();

	// Still open: the recruiter can still edit. Now the recruiter submits -> lock.
	await fillMeter(r, 'Client budget', EMPLOYER);
	await r.getByRole('button', { name: 'Submit the budget' }).click();
	await expect(r.getByTestId('fair-salary')).toBeVisible({ timeout: 20000 });
	await expect(r.getByTestId('overlap-label')).toHaveText('No overlap');
	await expect(c.page.getByTestId('overlap-label')).toHaveText('No overlap', { timeout: 20000 });
	assertNoFigures(await c.page.content(), EMPLOYER);

	await rctx.close();
	await c.ctx.close();
});

test('V3b: recruiter cancels before both submitted; both pages show cancelled and the link dies', async ({
	browser
}) => {
	const r = await recruiterToLink(browser);
	const c = await candidateOpens(browser, r.inviteUrl, r.sessionId);
	await expect(c.page.getByTestId('disclosure')).toBeVisible();

	await r.page.getByRole('button', { name: 'Cancel this check' }).click();
	await expect(r.page.getByRole('heading', { name: 'This check was cancelled' })).toBeVisible();
	await c.page.reload();
	await expect(c.page.getByRole('heading', { name: 'This check was cancelled' })).toBeVisible();

	await r.page.goto('/app');
	await expect(r.page.getByTestId('session-row')).toContainText('Cancelled');

	await r.ctx.close();
	await c.ctx.close();
});

test('the candidate cannot open the recruiter page; a stranger cannot open the party page', async ({
	browser
}) => {
	const r = await recruiterToLink(browser);
	const c = await candidateOpens(browser, r.inviteUrl, r.sessionId);
	const res = await c.ctx.request.get(`/app/s/${r.sessionId}`);
	expect(res.status()).toBe(403);

	const s = await browser.newContext();
	const sp = await s.newPage();
	await signIn(sp, `e2e-stranger-${randomUUID().slice(0, 8)}@example.test`);
	// RLS hides the session row from a non-member, so the page cannot even confirm it exists.
	const res2 = await s.request.get(`/s/${r.sessionId}/party`);
	expect([403, 404]).toContain(res2.status());

	await r.ctx.close();
	await c.ctx.close();
	await s.close();
});
