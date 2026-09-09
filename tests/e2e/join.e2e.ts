// T3-m1-platform-naive-auth §5 V3/V4: /join/{token} redemption end to end.
// Fixture goes straight to Postgres (tests/helpers/db.ts imports vitest,
// which cannot load under Playwright, so the few lines needed are inlined).
import { randomUUID } from 'node:crypto';
import { expect, test, type Browser } from '@playwright/test';
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

interface Fixture {
	token: string;
	sessionId: string;
	inviteId: string;
	inviteeEmail: string;
}

/** A recruitment session created by a fresh creator, with one email-bound invite. */
async function recruitmentInvite(): Promise<Fixture> {
	const creator = randomUUID();
	const creatorEmail = `e2e-creator-${creator.slice(0, 8)}@example.test`;
	const inviteeEmail = `e2e-invitee-${randomUUID().slice(0, 8)}@example.test`;
	await sql`
		insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at,
		                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
		values (${creator}::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
		        ${creatorEmail}, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
	`;
	const claims = JSON.stringify({ sub: creator, email: creatorEmail, role: 'authenticated' });
	const rows = await sql.begin(async (tx) => {
		await tx`select set_config('request.jwt.claims', ${claims}, true)`;
		await tx.unsafe('set local role authenticated');
		await tx`select grant_launch_credits()`;
		return tx<{ session_id: string; invite_id: string; plaintext_token: string }[]>`
			select session_id, invite_id, plaintext_token from launch_invited_session(
				${randomUUID()}, 'recruitment', 'GBP', 'creator-as-host', null::uuid, 'low-preferring',
				${tx.json([{ role: 'high-preferring', email: inviteeEmail }])})
		`;
	});
	const [r] = rows;
	return {
		token: r.plaintext_token,
		sessionId: r.session_id,
		inviteId: r.invite_id,
		inviteeEmail
	};
}

async function inviteRow(inviteId: string) {
	const [row] = await sql<{ redeemed_at: string | null; participants: number }[]>`
		select i.redeemed_at,
		       (select count(*)::int from session_participants p where p.invite_id = i.id) as participants
		from invites i where i.id = ${inviteId}::uuid`;
	return row;
}

/** GET /join/{token} without following the redirect, sharing the context's cookies. */
async function openJoin(
	browser: Browser,
	token: string,
	ctx?: Awaited<ReturnType<Browser['newContext']>>
) {
	const context = ctx ?? (await browser.newContext());
	const res = await context.request.get(`/join/${token}`, { maxRedirects: 0 });
	return { context, res };
}

test('V3: a fresh email-bound invite signs the browser in, redeems, and redirects; a second context gets the dead-link page; the redeemer can re-enter', async ({
	browser
}) => {
	const f = await recruitmentInvite();
	expect((await inviteRow(f.inviteId)).redeemed_at).toBeNull();

	const { context: a, res } = await openJoin(browser, f.token);
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe(`/s/${f.sessionId}/party`);

	const after = await inviteRow(f.inviteId);
	expect(after.redeemed_at).not.toBeNull();
	expect(after.participants).toBe(1);

	// The browser context is now signed in as the invite's email.
	const pageA = await a.newPage();
	await pageA.goto('/app');
	await expect(pageA.getByTestId('email')).toHaveText(f.inviteeEmail);
	await expect(pageA.getByTestId('balance')).toHaveText('8');

	// A different browser context opening the same link sees the dead-link page.
	const b = await browser.newContext();
	const pageB = await b.newPage();
	await pageB.goto(`/join/${f.token}`);
	await expect(pageB.locator('h1')).toHaveText("This link isn't live");
	const bCookies = await b.cookies();
	expect(bCookies.filter((c) => c.name.startsWith('sb-'))).toHaveLength(0);

	// Re-entry by the redeemer still redirects to the party surface.
	const again = await openJoin(browser, f.token, a);
	expect(again.res.status()).toBe(303);
	expect(again.res.headers()['location']).toBe(`/s/${f.sessionId}/party`);
	expect((await inviteRow(f.inviteId)).participants).toBe(1);

	await a.close();
	await b.close();
});

test('V4: an expired invite shows the dead-link page and leaves redeemed_at null', async ({
	page
}) => {
	const f = await recruitmentInvite();
	await sql`update invites set expires_at = now() - interval '1 minute' where id = ${f.inviteId}::uuid`;
	await page.goto(`/join/${f.token}`);
	await expect(page.locator('h1')).toHaveText("This link isn't live");
	expect((await inviteRow(f.inviteId)).redeemed_at).toBeNull();
});

test('V4: a revoked invite shows the dead-link page and leaves redeemed_at null', async ({
	page
}) => {
	const f = await recruitmentInvite();
	await sql`update invites set revoked_at = now() where id = ${f.inviteId}::uuid`;
	await page.goto(`/join/${f.token}`);
	await expect(page.locator('h1')).toHaveText("This link isn't live");
	expect((await inviteRow(f.inviteId)).redeemed_at).toBeNull();
});

test('V4: an unknown token shows the dead-link page', async ({ page }) => {
	await page.goto('/join/not-a-real-token');
	await expect(page.locator('h1')).toHaveText("This link isn't live");
});

test('sign-in page: an email and Continue reach /app with 8 credits; sign-out returns home', async ({
	page
}) => {
	const email = `e2e-signin-${randomUUID().slice(0, 8)}@example.test`;
	await page.goto('/app');
	await expect(page).toHaveURL(/\/signin\?next=%2Fapp/);
	await page.waitForLoadState('networkidle'); // typing before hydration would be discarded
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page).toHaveURL(/\/app$/);
	await expect(page.getByTestId('email')).toHaveText(email);
	await expect(page.getByTestId('balance')).toHaveText('8');
	await page.getByTestId('account-menu').click();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.goto('/app');
	await expect(page).toHaveURL(/\/signin/);
});
