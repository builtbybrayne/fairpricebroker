// Preview sign-in gate. The /signin page lets anyone become any account
// (T3-m1-platform-naive-auth Deviation D2), so on a shared URL it is only
// open to addresses named in PREVIEW_SIGNIN_ALLOWLIST (comma-separated;
// an entry may be a full address or "*@domain" for a whole domain).
// "*" opens it to everyone (local dev); unset or blank closes it. The
// /join path is NOT gated: its server-minted session is bound to the
// invite's own email (Deviation D1) and is what makes invites work.
export function isPreviewSigninAllowed(email: string, allowlist: string | undefined): boolean {
	const raw = (allowlist ?? '').trim();
	if (!raw) return false;
	if (raw === '*') return true;
	const wanted = email.trim().toLowerCase();
	const domain = wanted.slice(wanted.lastIndexOf('@') + 1);
	return raw
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean)
		.some((entry) => (entry.startsWith('*@') ? entry.slice(2) === domain : entry === wanted));
}
