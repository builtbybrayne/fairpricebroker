/** Same-origin-only redirect target: a path starting with a single '/'. */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
	if (!next) return fallback;
	if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
	return next;
}
