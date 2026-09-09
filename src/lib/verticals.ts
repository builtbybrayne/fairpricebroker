// The verticals an account can use, and which one a route belongs to (the
// top bar shows the scope; the account home lists them).
export interface Vertical {
	id: 'recruiting' | 'founders';
	name: string;
	/** Where the vertical's own home lives, when it is built. */
	href: string | null;
	ready: boolean;
}

export const VERTICALS: readonly Vertical[] = [
	{ id: 'recruiting', name: 'Recruiting', href: '/app/roles', ready: true },
	{ id: 'founders', name: 'Founders', href: null, ready: false }
];

/** The vertical a route sits in, for the top bar's scope tag. */
export function scopeFor(pathname: string): Vertical['id'] | null {
	if (
		pathname.startsWith('/recruitment') ||
		pathname.startsWith('/app/roles') ||
		pathname.startsWith('/app/r/') ||
		pathname.startsWith('/app/s/') ||
		pathname.startsWith('/app/new') ||
		/^\/s\/[^/]+\/party/.test(pathname)
	) {
		return 'recruiting';
	}
	return null;
}
