// T3-m1-recruitment-demo §4: the recruiter walkthrough end to end.
// V1 full walkthrough → five demo_stage_answered + one demo_completed.
// V2 abandon after stage 2 → exactly two rows.
// V3 replaying a stage POST (same body, same key) adds no row.
// V4 stage 3 renders disclosure + incentive before any input; stage 4
//    renders the overlap level and the non-remuneration steer.
// Rows are read straight from Postgres (tests/helpers/db.ts imports
// vitest, which cannot load under Playwright).
import { expect, test, type Page } from '@playwright/test';
import postgres, { type Sql } from 'postgres';
import { loadDotEnv } from '../helpers/env';

loadDotEnv();
let sql: Sql;
test.beforeAll(() => {
	sql = postgres(process.env.SUPABASE_DB_URL!, { max: 2, onnotice: () => {} });
});
test.afterAll(async () => {
	await sql.end({ timeout: 5 });
});

const BUDGET = ['40000', '48000', '58000', '65000'];
const CANDIDATE = ['45000', '52000', '60000', '75000'];

async function rowsFor(demoId: string) {
	return sql<{ event_type: string; stage: number }[]>`
		select e.event_type, (e.payload ->> 'stage')::int as stage
		from events e
		where e.reconciliation_id is null
			and e.payload ->> 'demo_id' = ${demoId}
			and coalesce((e.payload ->> 'demo')::boolean, false)
		order by e.id`;
}

async function activationCount() {
	const [r] = await sql<{ n: number }[]>`select count(*)::int as n from activation_events`;
	return r.n;
}

/** The client-minted demoId; it lands on mount, so this also gates on hydration. */
async function demoIdOf(page: Page): Promise<string> {
	const main = page.locator('main[data-demo-id]');
	await expect(main).toHaveAttribute('data-demo-id', /^[0-9a-f-]{36}$/);
	return (await main.getAttribute('data-demo-id'))!;
}

/** Fill the four figures of the meter titled `title` (the number fields). */
async function fillMeter(page: Page, title: string, values: string[]) {
	const meter = page.getByRole('region', { name: title });
	const fields = meter.locator('input[type="text"]');
	await expect(fields).toHaveCount(4);
	for (let i = 0; i < 4; i += 1) await fields.nth(i).fill(values[i]);
}

async function continueAndWait(page: Page, stage: number, label: string) {
	const answered = page.waitForResponse(
		(r) => r.url().endsWith('/api/demo/answer') && r.request().method() === 'POST'
	);
	await page.getByRole('button', { name: label }).click();
	const res = await answered;
	expect(res.ok(), `stage ${stage} answer POST`).toBe(true);
	return res;
}

test('V1: the full walkthrough writes five stage rows and one completion; activation is untouched', async ({
	page
}) => {
	const activationBefore = await activationCount();
	await page.goto('/recruitment/demo?ref=abcdefghij');
	const demoId = await demoIdOf(page);

	// Stage 1: recruiter, budget.
	await expect(page.locator('main')).toHaveAttribute('data-demo-stage', '1');
	await fillMeter(page, 'Employer budget', BUDGET);
	await page.getByRole('button', { name: 'Yes' }).first().click();
	await page.getByLabel('Anything else about this step?').fill('e2e stage 1');
	await continueAndWait(page, 1, 'Send the candidate link');

	// Stage 2: link sent, switch hats.
	await expect(page.locator('main')).toHaveAttribute('data-demo-stage', '2');
	await page.getByRole('button', { name: 'Before' }).click();
	await page.getByRole('button', { name: '4 of 5' }).click();
	await continueAndWait(page, 2, 'Now you’re the candidate');

	// Stage 3: candidate.
	await expect(page.locator('main')).toHaveAttribute('data-demo-stage', '3');
	await fillMeter(page, 'Your expectations', CANDIDATE);
	await page.getByRole('button', { name: '5 of 5' }).click();
	const reconciled = page.waitForResponse((r) => r.url().endsWith('/api/demo/reconcile'));
	await continueAndWait(page, 3, 'See what the recruiter sees');
	expect((await reconciled).ok()).toBe(true);

	// Stage 4: the recruiter's read.
	await expect(page.locator('main')).toHaveAttribute('data-demo-stage', '4');
	await expect(page.locator('[data-overlap-level]')).toHaveText('In range');
	await continueAndWait(page, 4, 'Continue');

	// Stage 5: wrap-up.
	await expect(page.locator('main')).toHaveAttribute('data-demo-stage', '5');
	await page.getByRole('button', { name: 'Per placement' }).click();
	await page.getByLabel('What’s your biggest hesitation?').fill('e2e hesitation');
	await continueAndWait(page, 5, 'Finish');
	await expect(page.locator('main')).toHaveAttribute('data-demo-stage', 'done');

	const rows = await rowsFor(demoId);
	expect(rows.filter((r) => r.event_type === 'demo_stage_answered').map((r) => r.stage)).toEqual([
		1, 2, 3, 4, 5
	]);
	expect(rows.filter((r) => r.event_type === 'demo_completed')).toHaveLength(1);
	expect(await activationCount()).toBe(activationBefore);

	const [refRow] = await sql<{ ref_code: string | null }[]>`
		select payload ->> 'ref_code' as ref_code from events
		where payload ->> 'demo_id' = ${demoId} limit 1`;
	expect(refRow.ref_code).toBe('abcdefghij');
});

test('V2: abandoning after stage 2 leaves exactly two rows', async ({ page }) => {
	await page.goto('/recruitment/demo');
	const demoId = await demoIdOf(page);
	await fillMeter(page, 'Employer budget', BUDGET);
	await continueAndWait(page, 1, 'Send the candidate link');
	await continueAndWait(page, 2, 'Now you’re the candidate');
	await expect(page.locator('main')).toHaveAttribute('data-demo-stage', '3');
	await page.close();

	const rows = await rowsFor(demoId);
	expect(rows).toHaveLength(2);
	expect(rows.map((r) => [r.event_type, r.stage])).toEqual([
		['demo_stage_answered', 1],
		['demo_stage_answered', 2]
	]);
});

test('V3: replaying a stage POST with the same idempotency key adds no row', async ({ page }) => {
	await page.goto('/recruitment/demo');
	const demoId = await demoIdOf(page);
	await fillMeter(page, 'Employer budget', BUDGET);
	const res = await continueAndWait(page, 1, 'Send the candidate link');
	const body = res.request().postData();
	expect(body).toBeTruthy();
	expect(JSON.parse(body!).demoId).toBe(demoId);

	expect((await rowsFor(demoId)).length).toBe(1);
	const replay = await page.request.post('/api/demo/answer', {
		data: JSON.parse(body!),
		headers: { 'content-type': 'application/json' }
	});
	expect(replay.ok()).toBe(true);
	expect((await rowsFor(demoId)).length).toBe(1);
});

test('V4: stage 3 shows the disclosure and incentive before any input; stage 4 shows overlap and the non-remuneration steer', async ({
	page
}) => {
	await page.goto('/recruitment/demo');
	await demoIdOf(page);
	await fillMeter(page, 'Employer budget', BUDGET);
	await continueAndWait(page, 1, 'Send the candidate link');
	await continueAndWait(page, 2, 'Now you’re the candidate');

	// Stage 3: the preamble precedes the first input in document order.
	const preamble = page.locator('[data-candidate-preamble]');
	await expect(preamble).toContainText('Who sees your answers');
	await expect(preamble).toContainText(
		'The recruiter who sent you this link will see the four figures you enter.'
	);
	await expect(preamble).toContainText('Why a lower first figure helps you');
	await expect(preamble).toContainText('A wider range means more matches');
	const order = await page.evaluate(() => {
		const pre = document.querySelector('[data-candidate-preamble]')!;
		const firstInput = document.querySelector('form input, form textarea, form button')!;
		return pre.compareDocumentPosition(firstInput) & Node.DOCUMENT_POSITION_FOLLOWING;
	});
	expect(order).toBeTruthy();

	await fillMeter(page, 'Your expectations', CANDIDATE);
	await continueAndWait(page, 3, 'See what the recruiter sees');

	// Stage 4: overlap level + steer, and the candidate view beside it.
	await expect(page.locator('[data-overlap-level]')).toHaveText('In range');
	await expect(page.locator('[data-non-remuneration]')).toHaveText('Not needed to close');
	await expect(page.locator('[data-broker-copy]')).toContainText(
		'Non-salary factors are a bonus here'
	);
	await expect(page.locator('[data-side-copy]')).toContainText('Nothing needs bridging on salary');
	await expect(page.getByRole('img', { name: /Employer budget/ })).toBeVisible();
});
