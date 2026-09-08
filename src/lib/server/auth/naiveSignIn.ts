// T3-m1-platform-naive-auth §3.2: preview sign-in. Type an email, you're
// in — no password, no email sent. The server mints a real GoTrue magic
// link and consumes it itself on the request-scoped client, so the
// browser ends up with an ordinary Supabase session (Deviation D1-naive).
//
// This is the ONLY module that may read SUPABASE_SERVICE_ROLE_KEY (§2, V5).
//
// GoTrue path, verified against the pinned local GoTrue (v2.195.0, 8 Sep
// 2026): admin.generateLink({ type: 'magiclink' }) creates a missing user
// itself — no admin.createUser needed — BUT for that first, unconfirmed
// user it returns `verification_type: 'signup'` (a confirmation token),
// and verifyOtp with type 'magiclink' rejects it ("Email link is invalid
// or has expired"). Passing the returned verification_type through works
// for both the first and every later sign-in.
import { createClient, type EmailOtpType, type SupabaseClient } from '@supabase/supabase-js';
import { error, type RequestEvent } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + lowercase; null when the result is not a plain email. */
export function normaliseEmail(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const email = raw.trim().toLowerCase();
	return EMAIL_RE.test(email) ? email : null;
}

let adminClient: SupabaseClient | undefined;
function admin(): SupabaseClient {
	if (!adminClient) {
		const url = publicEnv.PUBLIC_SUPABASE_URL;
		const key = privateEnv.SUPABASE_SERVICE_ROLE_KEY;
		if (!url || !key) throw new Error('Supabase admin credentials not set');
		adminClient = createClient(url, key, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
	}
	return adminClient;
}

export async function naiveSignIn(
	event: Pick<RequestEvent, 'locals'>,
	rawEmail: string
): Promise<{ userId: string }> {
	const email = normaliseEmail(rawEmail);
	if (!email) throw error(400, 'Enter a valid email address');

	const { data: link, error: linkError } = await admin().auth.admin.generateLink({
		type: 'magiclink',
		email
	});
	if (linkError || !link.properties?.hashed_token) {
		throw error(500, `Could not start sign-in: ${linkError?.message ?? 'no token'}`);
	}

	const supabase = event.locals.supabase;
	const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
		token_hash: link.properties.hashed_token,
		type: link.properties.verification_type as EmailOtpType
	});
	if (verifyError || !verified.user) {
		throw error(500, `Could not complete sign-in: ${verifyError?.message ?? 'no user'}`);
	}

	const { error: identityError } = await supabase.rpc('ensure_identity');
	if (identityError) throw error(500, `ensure_identity: ${identityError.message}`);
	const { error: grantError } = await supabase.rpc('grant_launch_credits');
	if (grantError) throw error(500, `grant_launch_credits: ${grantError.message}`);

	return { userId: verified.user.id };
}
