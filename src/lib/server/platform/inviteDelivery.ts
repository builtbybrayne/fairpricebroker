// T3-m1-platform-naive-auth §3.6: invite delivery without email. The
// creator copies this URL and sends it themselves; no provider client
// exists in this lane.
export function buildJoinUrl(origin: string, plaintextToken: string): string {
	return `${origin.replace(/\/+$/, '')}/join/${encodeURIComponent(plaintextToken)}`;
}
