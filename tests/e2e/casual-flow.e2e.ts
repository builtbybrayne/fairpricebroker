// T3-m1-casual-mode §8 — V4–V9, V12, V12b, V13, V15 driven through the real
// homepage against the dev server (see playwright.dev.config.ts when run
// standalone; the default config builds + previews on :4173).
import { expect, test, type Page } from '@playwright/test';

const A = ['312.5', '420.25', '560.75', '640.5'];
const B = ['301.5', '381.25', '521.75', '601.5'];
const A4 = ['12.3456', '18.7891', '24.1234', '31.5678'];
const B4 = ['11.2222', '17.3333', '23.4444', '30.5555'];

async function fill(page: Page, party: 'A' | 'B', values: string[]) {
	const form = page.locator(`form[data-party="${party}"]`);
	await expect(form).toBeVisible();
	const inputs = form.locator('input.row__number');
	for (let i = 0; i < 4; i += 1) await inputs.nth(i).fill(values[i]);
	await form.getByRole('button', { name: /seal my meter/i }).click();
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
	await page.getByRole('button', { name: 'Set your meter' }).first().click();
	await expect(page.locator('[data-casual-state="party-a-entry"]')).toBeVisible();
	await fill(page, 'A', a);
	await expect(page.locator('[data-state-screen="a-confirm-hide"]')).toBeVisible();
	await expectNoneOf(page, a);
	await page.getByRole('button', { name: /hide them and hand over/i }).click();
	await expect(page.locator('[data-state-screen="handover"]')).toBeVisible();
	await expectNoneOf(page, a);
	await page.getByRole('button', { name: /i have the phone/i }).click();
	await expect(page.locator('form[data-party="B"]')).toBeVisible();
	await expectNoneOf(page, a);
	// V5: no control on B's screen references A or a reveal action
	await expect(page.getByRole('button', { name: /show|reveal|party a/i })).toHaveCount(0);
	await fill(page, 'B', b);
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
	for (const v of [...A, ...B])
		expect(shown).toContain(
			Number(v)
				.toFixed(2)
				.replace(/^(\d+)\.(\d+)$/, '$1.$2')
		);
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
	await page.getByRole('button', { name: 'Set your meter' }).first().click();
	await fill(page, 'A', A);
	await page.getByRole('button', { name: /hide them and hand over/i }).click();
	await page.getByRole('button', { name: /i have the phone/i }).click();
	await fill(page, 'B', B);
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
