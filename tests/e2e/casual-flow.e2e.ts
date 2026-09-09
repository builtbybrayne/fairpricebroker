// T3-m1-casual-mode §8 — V4–V9, V12, V12b, V13, V15 driven through the real
// homepage against the dev server (see playwright.dev.config.ts when run
// standalone; the default config builds + previews on :4173).
//
// Flow as revised 8 Sep 2026: both meters are live side by side; each side
// seals its own; both sealed → both look → reveal.
import { expect, test, type Page } from '@playwright/test';

const A = ['312.5', '420.25', '560.75', '640.5'];
const B = ['301.5', '381.25', '521.75', '601.5'];
const A4 = ['12.3456', '18.7891', '24.1234', '31.5678'];
const B4 = ['11.2222', '17.3333', '23.4444', '30.5555'];

async function seal(page: Page, party: 'A' | 'B', values: string[]) {
	const form = page.locator(`form[data-party="${party}"]`);
	await expect(form).toBeVisible();
	const inputs = form.locator('input[type="text"]');
	await expect(inputs).toHaveCount(4);
	for (let i = 0; i < 4; i += 1) await inputs.nth(i).fill(values[i]);
	await form.getByRole('button', { name: /seal and hide/i }).click();
	await expect(form).toHaveAttribute('data-sealed', '');
}

async function expectNoneOf(page: Page, values: string[]) {
	const html = await page.locator('main').innerHTML();
	for (const v of values) expect(html, `figure ${v} leaked`).not.toContain(v);
}

async function ready(page: Page) {
	await expect(page.locator('[data-casual-state][data-hydrated]')).toBeAttached();
}

async function driveToReveal(page: Page, a = A, b = B) {
	await ready(page);
	await expect(page.locator('[data-casual-state="entry"]')).toBeVisible();
	// both meters are live from the start, with example figures in them
	await expect(page.locator('form[data-party="A"] input[type="text"]')).toHaveCount(4);
	await expect(page.locator('form[data-party="B"] input[type="text"]')).toHaveCount(4);
	await seal(page, 'A', a);
	// A is behind its plate: no figure of A's anywhere, and B's meter is still open
	await expect(page.locator('[data-casual-state="a-sealed"]')).toBeVisible();
	await expectNoneOf(page, a);
	await expect(page.locator('form[data-party="A"] [data-meter-sealed]')).toBeVisible();
	// V5: no control on the handed-over phone reveals A or the outcome
	await expect(page.getByRole('button', { name: /show|reveal|unseal/i })).toHaveCount(0);
	await seal(page, 'B', b);
	await expect(page.locator('[data-state-screen="both-look-now"]')).toBeVisible();
	await expectNoneOf(page, [...a, ...b]);
	// V6: reveal markers absent before continue
	await expect(page.locator('[data-state-screen="reveal"]')).toHaveCount(0);
	await page.getByRole('button', { name: /reveal the fair price/i }).click();
	await expect(page.locator('[data-state-screen="reveal"]')).toBeVisible();
}

test('V4–V7: figures hidden through handover, outcome only at both-look, numbers hidden by default', async ({
	page
}) => {
	await page.goto('/');
	const t0 = Date.now();
	await driveToReveal(page);
	// V8: under sixty seconds end to end
	expect(Date.now() - t0).toBeLessThan(60_000);
	// V7: raw figures absent until "show the numbers"
	await expectNoneOf(page, [...A, ...B]);
	await expect(page.locator('[data-fair-price]')).toBeVisible();
	await page.getByRole('button', { name: /show the numbers/i }).click();
	const shown = await page.locator('[data-numbers-shown]').innerText();
	for (const v of [...A, ...B]) expect(shown).toContain(Number(v).toFixed(2));
});

test('either side may seal first; the step row follows', async ({ page }) => {
	await page.goto('/');
	await ready(page);
	await expect(page.locator('.steps')).toHaveAttribute('data-step', '1');
	await seal(page, 'B', B);
	await expect(page.locator('[data-casual-state="b-sealed"]')).toBeVisible();
	await expect(page.locator('.steps')).toHaveAttribute('data-step', '2');
	await expectNoneOf(page, B);
	await seal(page, 'A', A);
	await expect(page.locator('.steps')).toHaveAttribute('data-step', '3');
	await page.getByRole('button', { name: /reveal the fair price/i }).click();
	await expect(page.locator('[data-state-screen="reveal"]')).toBeVisible();
});

test('V9: inbound ref is posted and the share link carries a fresh ref', async ({ page }) => {
	const inbound = 'abcd234efg';
	const bodies: unknown[] = [];
	page.on('request', (r) => {
		if (r.url().endsWith('/api/casual/reconcile')) bodies.push(r.postDataJSON());
	});
	await page.goto(`/?ref=${inbound}`);
	await driveToReveal(page);
	expect(bodies).toHaveLength(1);
	expect((bodies[0] as { ref: string }).ref).toBe(inbound);
	const share = await page.locator('[data-share-url]').inputValue();
	expect(share).toMatch(/\?ref=[a-z2-7]{10}$/);
	expect(share).not.toContain(inbound);
});

test('V12: transport failure preserves the key; retry succeeds with the same key', async ({
	page
}) => {
	const keys: string[] = [];
	let failOnce = true;
	await page.route('**/api/casual/reconcile', async (route) => {
		keys.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey);
		if (failOnce) {
			failOnce = false;
			await route.abort();
			return;
		}
		await route.continue();
	});
	await page.goto('/');
	await ready(page);
	await seal(page, 'A', A);
	await seal(page, 'B', B);
	await expect(page.locator('[data-state-screen="transport-error"]')).toBeVisible();
	await expectNoneOf(page, [...A, ...B]);
	await page.getByRole('button', { name: /try again/i }).click();
	await expect(page.locator('[data-state-screen="both-look-now"]')).toBeVisible();
	await page.getByRole('button', { name: /reveal the fair price/i }).click();
	await expect(page.locator('[data-state-screen="reveal"]')).toBeVisible();
	expect(keys).toHaveLength(2);
	expect(keys[0]).toBe(keys[1]);
});

test('V12b: a malformed inbound ref is discarded silently and retried with ref null', async ({
	page
}) => {
	const bodies: { ref: string | null; idempotencyKey: string }[] = [];
	const statuses: number[] = [];
	page.on('request', (r) => {
		if (r.url().endsWith('/api/casual/reconcile')) bodies.push(r.postDataJSON());
	});
	page.on('response', (r) => {
		if (r.url().endsWith('/api/casual/reconcile')) statuses.push(r.status());
	});
	await page.goto('/?ref=abc123');
	await driveToReveal(page);
	expect(bodies).toHaveLength(2);
	expect(bodies[0].ref).toBe('abc123');
	expect(statuses[0]).toBe(400);
	expect(bodies[1].ref).toBeNull();
	expect(bodies[1].idempotencyKey).toBe(bodies[0].idempotencyKey);
	await expect(page.locator('[data-state-screen="transport-error"]')).toHaveCount(0);
});

test('V13/V15: mobile viewport, 4-d.p. precision survives to the reveal', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/');
	await driveToReveal(page, A4, B4);
	await expectNoneOf(page, [...A4, ...B4]);
	await page.getByRole('button', { name: /show the numbers/i }).click();
	const shown = await page.locator('[data-numbers-shown]').innerText();
	for (const v of [...A4, ...B4]) expect(shown).toContain(v);
});
